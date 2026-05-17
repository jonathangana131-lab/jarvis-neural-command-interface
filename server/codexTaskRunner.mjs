import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isPathAllowed } from './config.mjs';

export class CodexTaskRunner {
  constructor(config, eventBus, memoryStore, memoryExtractor, taskStore) {
    this.config = config;
    this.eventBus = eventBus;
    this.memoryStore = memoryStore;
    this.memoryExtractor = memoryExtractor;
    this.taskStore = taskStore;
    this.tasks = new Map();
    this.queuePaused = false;
  }

  list() {
    const rows = new Map();
    for (const task of this.taskStore?.list() ?? []) {
      rows.set(task.id, task);
    }
    for (const task of this.tasks.values()) {
      rows.set(task.id, this.#publicTask(task));
    }
    return [...rows.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 40);
  }

  get(id) {
    const task = this.tasks.get(id);
    return task ? this.#publicTask(task) : this.taskStore?.get(id) ?? null;
  }

  cancel(id) {
    const task = this.tasks.get(id);
    if (!task) {
      const persisted = this.taskStore?.get(id);
      if (persisted) {
        if (persisted.status === 'queued') {
          const cancelled = {
            ...persisted,
            status: 'cancelled',
            phase: 'done',
            finishedAt: new Date().toISOString(),
            memorySkipped: [{
              reason: 'Queued task was cancelled before it ran.',
              content: persisted.prompt,
              confidence: 0
            }]
          };
          const publicTask = this.taskStore.upsert(cancelled);
          this.eventBus.emit('task.finished', publicTask);
          return publicTask;
        }
        return persisted;
      }
      const error = new Error('Task not found.');
      error.status = 404;
      throw error;
    }
    if (task.status !== 'running') {
      return this.#publicTask(task);
    }

    task.status = 'cancelled';
    task.phase = 'done';
    task.finishedAt = new Date().toISOString();
    task.exitCode = null;
    task.memorySkipped = [{
      reason: 'Task was cancelled before memory extraction completed.',
      content: task.prompt,
      confidence: 0
    }];
    if (task.child) {
      this.#killTaskProcess(task.child);
    }
    const publicTask = this.#persistTask(task);
    this.tasks.delete(id);
    this.eventBus.emit('task.finished', publicTask);
    this.#drainQueue();
    return publicTask;
  }

  start({ prompt, workspace }) {
    const cwd = path.resolve(workspace || this.config.defaultWorkspace);
    const cleanPrompt = String(prompt ?? '').trim();
    if (!cleanPrompt) {
      const error = new Error('Task prompt is required.');
      error.status = 400;
      throw error;
    }
    if (!isPathAllowed(this.config, cwd)) {
      const error = new Error(`Workspace is outside the allowlist: ${cwd}`);
      error.status = 403;
      throw error;
    }
    this.#assertPromptAllowed(cleanPrompt);

    const id = crypto.randomUUID();
    const outputMessagePath = this.#outputMessagePath(id);
    const task = {
      id,
      prompt: cleanPrompt,
      workspace: cwd,
      status: 'queued',
      phase: 'queued',
      output: '',
      logs: '',
      outputMessagePath,
      rememberedMemoryIds: [],
      createdMemoryIds: [],
      memorySkipped: [],
      filesChanged: [],
      commandsRun: [],
      testsRun: [],
      createdAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null
    };
    const publicTask = this.#persistTask(task);
    this.eventBus.emit('task.queued', publicTask);
    this.#drainQueue();
    return publicTask;
  }

  retry(id) {
    const task = this.get(id);
    if (!task) {
      const error = new Error('Task not found.');
      error.status = 404;
      throw error;
    }
    return this.start({ prompt: task.prompt, workspace: task.workspace });
  }

  pauseQueue() {
    this.queuePaused = true;
    this.eventBus.emit('queue.changed', this.queueStatus());
    return this.queueStatus();
  }

  resumeQueue() {
    this.queuePaused = false;
    this.eventBus.emit('queue.changed', this.queueStatus());
    this.#drainQueue();
    return this.queueStatus();
  }

  queueStatus() {
    return {
      paused: this.queuePaused,
      runningTaskId: [...this.tasks.keys()][0] ?? null
    };
  }

  #drainQueue() {
    if (this.queuePaused || this.tasks.size > 0) {
      return;
    }
    const queued = this.taskStore?.nextQueued();
    if (!queued) {
      return;
    }
    Promise.resolve(this.#runQueuedTask(queued)).catch((error) => {
      console.error('[codexTaskRunner] queued task failed:', error?.message ?? error);
    });
  }

  async #runQueuedTask(queued) {
    const provider = this.config.localModel?.provider;

    if (provider === 'opencode') {
      return this.#runOpenCodeApiTask(queued);
    }

    const relevantMemories = await this.memoryStore.relevantForAsync({ prompt: queued.prompt, workspace: queued.workspace, limit: 6 });
    const executionPrompt = buildPromptWithMemories(queued.prompt, relevantMemories);
    const outputMessagePath = this.#outputMessagePath(queued.id);
    const task = {
      ...queued,
      status: 'running',
      phase: 'planning',
      output: '',
      logs: '',
      outputMessagePath,
      rememberedMemoryIds: relevantMemories.map((memory) => memory.id),
      createdMemoryIds: [],
      memorySkipped: [],
      filesChanged: [],
      commandsRun: [],
      testsRun: [],
      finishedAt: null,
      exitCode: null
    };
    this.#rememberPromptIntent(task);
    this.tasks.set(task.id, task);
    this.#persistTask(task);
    this.eventBus.emit('task.started', this.#publicTask(task));
    const args = buildCodexExecArgs({
      model: this.config.codex.model,
      reasoningEffort: this.config.codex.reasoningEffort,
      ephemeral: this.config.codex.ephemeral,
      cwd: task.workspace,
      outputMessagePath
    });
    const child = this.#spawnCodex(args, task.workspace);
    child.stdin?.end(executionPrompt);
    task.child = child;

    const stdoutParser = createCodexJsonOutputParser();
    const append = (text) => {
      if (!text) {
        return;
      }
      task.phase = inferPhaseFromText(task.phase, text);
      task.output += text;
      task.output = task.output.slice(-24000);
      this.#persistTask(task);
      this.eventBus.emit('task.output', { id: task.id, chunk: text, output: task.output, phase: task.phase });
    };
    const appendLog = (text) => {
      if (!text) {
        return;
      }
      task.logs += text;
      task.logs = task.logs.slice(-64000);
    };

    child.stdout.on('data', (chunk) => {
      const raw = chunk.toString();
      appendLog(raw);
      for (const text of stdoutParser.push(raw)) {
        append(text);
      }
    });
    child.stderr.on('data', (chunk) => {
      const raw = chunk.toString();
      appendLog(raw);
      append(cleanCodexDiagnosticChunk(raw));
    });
    child.on('error', (error) => {
      task.status = 'failed';
      task.phase = 'done';
      task.output += `\n${error.message}`;
      task.logs += `\n${error.stack ?? error.message}`;
      task.finishedAt = new Date().toISOString();
      task.memorySkipped = [{
        reason: 'Codex task failed before memory extraction.',
        content: error.message,
        confidence: 0
      }];
      const publicTask = this.#persistTask(task);
      this.tasks.delete(task.id);
      this.eventBus.emit('task.finished', publicTask);
      this.#drainQueue();
    });
    child.on('exit', async (code) => {
      if (task.status !== 'running') {
        return;
      }
      for (const text of stdoutParser.flush()) {
        append(text);
      }
      task.status = code === 0 ? 'completed' : 'failed';
      task.phase = 'done';
      task.exitCode = code;
      task.finishedAt = new Date().toISOString();
      const finalMessage = this.#readFinalMessage(task);
      if (finalMessage) {
        task.output = finalMessage;
      } else {
        task.output = summarizeCodexOutput(task.output, task.status);
      }
      const artifacts = inferTaskArtifacts(task.output, task.logs);
      task.filesChanged = artifacts.filesChanged;
      task.commandsRun = artifacts.commandsRun;
      task.testsRun = artifacts.testsRun;
      this.#rememberAssistantOutcome(task);
      task.memorySkipped = [{
        reason: 'Memory extraction is running in the background.',
        content: task.output.slice(0, 180),
        confidence: 0
      }];
      const publicTask = this.#persistTask(task);
      this.tasks.delete(task.id);
      this.eventBus.emit('task.finished', publicTask);
      this.#drainQueue();
      void this.#extractTaskMemories(task);
    });

    setTimeout(() => {
      if (task.status === 'running') {
        task.status = 'timed_out';
        task.phase = 'done';
        task.finishedAt = new Date().toISOString();
        task.memorySkipped = [{
          reason: 'Task timed out before memory extraction.',
          content: task.prompt,
          confidence: 0
        }];
        this.#killTaskProcess(child);
        const publicTask = this.#persistTask(task);
        this.tasks.delete(task.id);
        this.eventBus.emit('task.finished', publicTask);
        this.#drainQueue();
      }
    }, this.config.codex.maxTaskRuntimeMs);
  }

  async #runOpenCodeApiTask(queued) {
    const relevantMemories = await this.memoryStore.relevantForAsync({ prompt: queued.prompt, workspace: queued.workspace, limit: 6 });
    const executionPrompt = buildPromptWithMemories(queued.prompt, relevantMemories, { materializeArtifacts: true });
    const task = {
      ...queued,
      status: 'running',
      phase: 'planning',
      output: '',
      logs: '',
      outputMessagePath: '',
      rememberedMemoryIds: relevantMemories.map((memory) => memory.id),
      createdMemoryIds: [],
      memorySkipped: [],
      filesChanged: [],
      commandsRun: [],
      testsRun: [],
      finishedAt: null,
      exitCode: null
    };
    this.#rememberPromptIntent(task);
    this.tasks.set(task.id, task);
    this.#persistTask(task);
    this.eventBus.emit('task.started', this.#publicTask(task));

    const apiKey = process.env.OPENCODE_API_KEY;
    const endpoint = this.config.localModel?.endpoint || 'https://opencode.ai/zen/v1';
    const model = this.config.localModel?.model || 'minimax-m2.5-free';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.codex.maxTaskRuntimeMs);

    const append = (text) => {
      if (!text) return;
      task.phase = inferPhaseFromText(task.phase, text);
      task.output += text;
      task.output = task.output.slice(-24000);
      this.#persistTask(task);
      
      // Emit task.output event for frontend animation feedback
      this.eventBus.emit('task.output', { id: task.id, chunk: text, output: task.output, phase: task.phase });
    };

    const emitPhase = (phase, text) => {
      task.phase = phase;
      this.#persistTask(task);
      this.eventBus.emit('task.output', { id: task.id, chunk: text, output: task.output, phase });
    };

    try {
      emitPhase('planning', 'Connecting to OpenCode Zen and preparing streamed response.');
      const content = await runChatCompletion({
        endpoint,
        apiKey,
        model,
        prompt: executionPrompt,
        signal: controller.signal,
        onChunk: (chunk) => {
          task.phase = 'streaming';
          append(chunk);
        },
        onFallback: () => emitPhase('thinking', 'Streaming unavailable; waiting for complete model response.')
      });
      clearTimeout(timeout);

      if (!task.output.trim() && content) {
        append(content);
      }
      task.phase = 'editing';
      const materialized = materializeModelArtifacts({
        task,
        content: task.output,
        artifactBaseDir: 'jarvis-artifacts'
      });
      if (materialized.filesChanged.length > 0) {
        task.filesChanged = materialized.filesChanged;
        task.commandsRun = [
          `materialized ${materialized.filesChanged.length} artifact file(s) to ${materialized.rootRelative}`
        ];
        task.testsRun = [];
        task.output = appendArtifactSummary(task.output, materialized);
        this.eventBus.emit('task.output', {
          id: task.id,
          chunk: `\nCreated ${materialized.filesChanged.length} artifact file(s) in ${materialized.rootRelative}\n`,
          output: task.output,
          phase: 'editing'
        });
      } else {
        const artifacts = inferTaskArtifacts(task.output, task.logs);
        task.filesChanged = artifacts.filesChanged;
        task.commandsRun = artifacts.commandsRun;
        task.testsRun = artifacts.testsRun;
      }
      this.#persistTask(task);
      
      task.status = 'completed';
      task.phase = 'done';
      task.exitCode = 0;
      task.finishedAt = new Date().toISOString();
      this.#rememberAssistantOutcome(task);
      task.memorySkipped = [{
        reason: 'Memory extraction is running in the background.',
        content: task.output.slice(0, 180),
        confidence: 0
      }];
      const publicTask = this.#persistTask(task);
      this.tasks.delete(task.id);
      this.eventBus.emit('task.finished', publicTask);
      this.#drainQueue();
      void this.#extractTaskMemories(task);
    } catch (error) {
      clearTimeout(timeout);
      task.status = 'failed';
      task.phase = 'done';
      task.output += `\nError: ${error.message}`;
      task.output = task.output.slice(-24000);
      task.exitCode = 1;
      task.finishedAt = new Date().toISOString();
      task.memorySkipped = [{ reason: error.message, content: executionPrompt.slice(0, 180), confidence: 0 }];
      
      // Emit task.output event for frontend animation feedback
      this.eventBus.emit('task.output', { id: task.id, chunk: `\nError: ${error.message}`, output: task.output, phase: 'done' });
      
      const publicTask = this.#persistTask(task);
      this.tasks.delete(task.id);
      this.eventBus.emit('task.finished', publicTask);
      this.#drainQueue();
    }
  }

  #outputMessagePath(id) {
    const dir = path.resolve(this.config.dataDir ?? this.config.rootDir, 'task-output');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${id}.txt`);
  }

  #readFinalMessage(task) {
    if (!task.outputMessagePath || !fs.existsSync(task.outputMessagePath)) {
      return '';
    }
    return fs.readFileSync(task.outputMessagePath, 'utf8').trim();
  }

  async #extractTaskMemories(task) {
    try {
      const extracted = await this.memoryExtractor.extractFromTask(task);
      task.memorySkipped = extracted.skipped ?? [];
      for (const memory of extracted.memories) {
        const inserted = this.memoryStore.create({
          ...memory,
          scope: 'project',
          workspace: task.workspace
        });
        if (inserted?.id) {
          pushUnique(task.createdMemoryIds, inserted.id);
        }
      }
      if (task.createdMemoryIds.length === 0 && task.memorySkipped.length === 0) {
        task.memorySkipped = [{
          reason: 'No durable memory extracted.',
          content: task.output.slice(0, 180),
          confidence: 0
        }];
      }
    } catch (error) {
      task.memorySkipped = [{
        reason: `Memory extraction failed: ${error.message}`,
        content: task.output.slice(0, 180),
        confidence: 0
      }];
    }
    const publicTask = this.#persistTask(task);
    this.eventBus.emit('task.updated', publicTask);
  }

#spawnCodex(args, cwd) {
    const provider = this.config.localModel?.provider;
    
    if (provider === 'opencode' || provider === 'ollama' || provider === 'lmstudio') {
      return this.#spawnApiModel(provider, args, cwd);
    }
    
    if (process.platform === 'win32') {
      const commandLine = [this.config.codex.command, ...args].map(quoteCmdArg).join(' ');
      return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', commandLine], {
        cwd,
        shell: false,
        windowsHide: true,
        env: this.#childEnv(),
        stdio: ['pipe', 'pipe', 'pipe']
      });
    }

    return spawn(this.config.codex.command, args, {
      cwd,
      shell: false,
      env: this.#childEnv()
    });
  }

  #spawnApiModel(provider, baseArgs, cwd) {
    const model = this.config.localModel?.model;
    const config = { ...process.env };
    
    if (provider === 'opencode') {
      config.OPENAI_API_KEY = process.env.OPENCODE_API_KEY || '';
      config.OPENAI_BASE_URL = this.config.localModel?.endpoint?.replace('/v1', '') || 'https://opencode.ai/zen';
    } else if (provider === 'ollama') {
      config.OPENAI_BASE_URL = this.config.localModel?.endpoint?.replace('/v1', '')?.replace('/api', '') || 'http://127.0.0.1:11434';
    } else if (provider === 'lmstudio') {
      config.OPENAI_BASE_URL = this.config.localModel?.endpoint?.replace('/v1', '') || 'http://127.0.0.1:1234';
    }
    
    const modelArg = baseArgs.findIndex(a => a === '--model');
    if (modelArg > -1 && model) {
      baseArgs[modelArg + 1] = model;
    } else if (model) {
      baseArgs.splice(0, 0, '--model', model);
    }
    
    if (process.platform === 'win32') {
      const commandLine = [this.config.codex.command, ...baseArgs].map(quoteCmdArg).join(' ');
      return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', commandLine], {
        cwd,
        shell: false,
        windowsHide: true,
        env: config,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    }

    return spawn(this.config.codex.command, baseArgs, { cwd, shell: false, env: config });
  }

  #childEnv() {
    return {
      ...process.env,
      CODEX_DISABLE_ANALYTICS: '1',
      CODEX_DISABLE_TELEMETRY: '1'
    };
  }

  #killTaskProcess(child) {
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore'
      });
      return;
    }
    child.kill();
  }

  #assertPromptAllowed(prompt) {
    const lower = prompt.toLowerCase();
    for (const phrase of this.config.codex.blockedPhrases) {
      if (lower.includes(String(phrase).toLowerCase())) {
        const error = new Error(`Blocked autonomous task phrase: ${phrase}`);
        error.status = 403;
        throw error;
      }
    }
  }

  #rememberPromptIntent(task) {
    const inserted = this.memoryStore.create({
      kind: 'conversation',
      title: titleFromTaskPrompt(task.prompt),
      content: `User mission intent: ${summarizeText(task.prompt, 420)}`,
      importance: 4,
      confidence: 0.92,
      source: 'conversation',
      scope: 'project',
      workspace: task.workspace
    });
    if (inserted?.id) {
      pushUnique(task.createdMemoryIds, inserted.id);
    }
  }

  #rememberAssistantOutcome(task) {
    if (task.status !== 'completed') {
      return;
    }
    const files = (task.filesChanged ?? []).slice(0, 6);
    const verification = (task.testsRun?.length ?? 0) > 0
      ? ` Verified with ${task.testsRun.slice(0, 3).join(', ')}.`
      : '';
    const fileSummary = files.length > 0 ? ` Created files: ${files.join(', ')}.` : '';
    const outputSummary = summarizeText(stripArtifactBlocks(task.output), 520);
    const inserted = this.memoryStore.create({
      kind: 'task',
      title: `Completed: ${titleFromTaskPrompt(task.prompt).replace(/^Mission: /, '')}`,
      content: `Jarvis completed the mission "${summarizeText(task.prompt, 140)}".${fileSummary}${verification} Result: ${outputSummary}`,
      importance: files.length > 0 ? 5 : 4,
      confidence: 0.88,
      source: 'codex-task',
      scope: 'project',
      workspace: task.workspace
    });
    if (inserted?.id) {
      pushUnique(task.createdMemoryIds, inserted.id);
    }
  }

  #persistTask(task) {
    const publicTask = this.#publicTask(task);
    return this.taskStore?.upsert(publicTask) ?? publicTask;
  }

  #publicTask(task) {
    return {
      id: task.id,
      prompt: task.prompt,
      workspace: task.workspace,
      status: task.status,
      phase: task.phase ?? inferPhaseFromStatus(task.status),
      output: task.output,
      logs: task.logs ?? '',
      createdAt: task.createdAt,
      finishedAt: task.finishedAt,
      exitCode: task.exitCode,
      rememberedMemoryIds: task.rememberedMemoryIds ?? [],
      createdMemoryIds: task.createdMemoryIds ?? [],
      memorySkipped: task.memorySkipped ?? [],
      filesChanged: task.filesChanged ?? [],
      commandsRun: task.commandsRun ?? [],
      testsRun: task.testsRun ?? []
    };
  }
}

export function buildPromptWithMemories(prompt, memories = [], options = {}) {
  const relevant = memories
    .filter((memory) => memory && memory.content)
    .slice(0, 6);

  const parts = [];
  if (relevant.length > 0) {
    const context = relevant
      .map((memory) => `- [${memory.kind}] ${memory.title}: ${memory.content}`)
      .join('\n');
    parts.push(
      'Relevant remembered context:',
      context,
      '',
      'Use the remembered context only when it is directly relevant. Do not mention it unless it affects the answer.',
      ''
    );
  }

  if (options.materializeArtifacts) {
    parts.push(buildArtifactAuthoringInstructions(), '');
  }

  parts.push('Current request:', prompt);
  return parts.join('\n');
}

export function buildCodexExecArgs({ model, reasoningEffort, ephemeral, cwd, outputMessagePath }) {
  return [
    'exec',
    ...(model ? ['--model', String(model)] : []),
    ...(ephemeral ? ['--ephemeral'] : []),
    '--json',
    '-c',
    "approval_policy='never'",
    ...(reasoningEffort ? ['-c', `model_reasoning_effort='${String(reasoningEffort).replace(/'/g, '')}'`] : []),
    '-c',
    "model_reasoning_summary='none'",
    '--sandbox',
    'workspace-write',
    '--skip-git-repo-check',
    '--cd',
    cwd,
    '--output-last-message',
    outputMessagePath,
    '-'
  ];
}

async function runChatCompletion({ endpoint, apiKey, model, prompt, signal, onChunk, onFallback }) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  const streamResponse = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: true
    }),
    signal
  });

  if (!streamResponse.ok) {
    onFallback?.();
    return runJsonChatCompletion({ endpoint, headers, model, prompt, signal });
  }

  const contentType = streamResponse.headers.get('content-type') ?? '';
  if (!streamResponse.body || !/event-stream|stream/i.test(contentType)) {
    onFallback?.();
    const data = await streamResponse.json();
    return extractChatCompletionText(data);
  }

  let content = '';
  for await (const chunk of readChatCompletionStream(streamResponse.body)) {
    content += chunk;
    onChunk?.(chunk);
  }
  return content;
}

async function runJsonChatCompletion({ endpoint, headers, model, prompt, signal }) {
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false
    }),
    signal
  });
  if (!response.ok) {
    throw new Error(`OpenCode API error: ${response.status} ${response.statusText}`);
  }
  return extractChatCompletionText(await response.json());
}

async function* readChatCompletionStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const text = parseChatCompletionStreamLine(line);
        if (text) {
          yield text;
        }
      }
    }
    buffer += decoder.decode();
    for (const line of buffer.split(/\r?\n/)) {
      const text = parseChatCompletionStreamLine(line);
      if (text) {
        yield text;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function parseChatCompletionStreamLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return '';
  }
  const data = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
  if (!data || data === '[DONE]') {
    return '';
  }
  try {
    const event = JSON.parse(data);
    return extractStreamEventText(event);
  } catch {
    return '';
  }
}

function extractChatCompletionText(data) {
  return textFromContent(data?.choices?.[0]?.message?.content)
    || textFromContent(data?.choices?.[0]?.text)
    || textFromContent(data?.output_text)
    || '';
}

function extractStreamEventText(event) {
  const choice = event?.choices?.[0];
  return textFromContent(choice?.delta?.content)
    || textFromContent(choice?.delta?.reasoning_content)
    || textFromContent(choice?.message?.content)
    || textFromContent(choice?.text)
    || textFromContent(event?.delta?.text)
    || textFromContent(event?.delta)
    || textFromContent(event?.output_text)
    || textFromContent(event?.content)
    || '';
}

function textFromContent(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(textFromContent).join('');
  }
  if (value && typeof value === 'object') {
    return textFromContent(value.text)
      || textFromContent(value.content)
      || textFromContent(value.value)
      || '';
  }
  return '';
}

export function createCodexJsonOutputParser() {
  let buffer = '';
  return {
    push(chunk) {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      return lines.map(parseCodexJsonLine).filter(Boolean);
    },
    flush() {
      if (!buffer) {
        return [];
      }
      const text = parseCodexJsonLine(buffer);
      buffer = '';
      return text ? [text] : [];
    }
  };
}

function parseCodexJsonLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const event = JSON.parse(trimmed);
    if (event?.type === 'item.completed' && event.item?.type === 'agent_message') {
      return `${String(event.item.text ?? '').trim()}\n`;
    }
    if (event?.type === 'error') {
      return `Codex error: ${String(event.message ?? event.error ?? 'Unknown error')}\n`;
    }
  } catch {
    return cleanCodexDiagnosticChunk(trimmed);
  }
  return '';
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[ \t"&<>|^]/.test(text)) {
    return text;
  }
  return `"${text.replace(/(["^&<>|])/g, '^$1')}"`;
}

function cleanCodexDiagnosticChunk(text) {
  if (text.includes('<html') || text.includes('challenge-error-text') || text.includes('backend-api/plugins/')) {
    return '';
  }

  const diagnostic = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => !line.includes('/backend-api/codex/analytics-events'))
    .filter((line) => !line.includes('/backend-api/plugins/'))
    .filter((line) => !line.includes('startup websocket prewarm setup failed'))
    .filter((line) => !line.includes('startup remote plugin sync failed'))
    .filter((line) => !line.includes('failed to warm featured plugin ids cache'))
    .filter((line) => !line.includes('ignoring interface.defaultPrompt'))
    .filter((line) => !line.includes('ignoring interface.icon_'))
    .filter((line) => !line.includes('Failed to create shell snapshot for powershell'))
    .filter((line) => !line.includes('WARN codex_core'))
    .filter((line) => !line.includes('WARN codex_mcp'))
    .filter((line) => !/^SUCCESS: The process with PID \d+/i.test(line.trim()))
    .filter((line) => !/^ERROR: The process "\d+" not found\./i.test(line.trim()))
    .join('\n');
  return diagnostic.trim() ? `${diagnostic.trim()}\n` : '';
}

function summarizeCodexOutput(output, status) {
  const text = String(output ?? '');
  const limitMatch = text.match(/You've hit your usage limit\.[\s\S]*?try again at [^.]+/i);
  if (limitMatch) {
    return limitMatch[0].trim();
  }

  const errorLines = text
    .split(/\r?\n/)
    .filter((line) => /^ERROR:/i.test(line.trim()) || /usage limit|invalid_request_error|upgrade/i.test(line))
    .slice(-4);
  if (errorLines.length > 0) {
    return errorLines.join('\n').trim();
  }

  if (status === 'failed') {
    return text.slice(-1800).trim() || 'Codex task failed without output.';
  }

  return text.trim();
}

function inferPhaseFromStatus(status) {
  if (status === 'queued') {
    return 'queued';
  }
  if (status === 'running') {
    return 'planning';
  }
  return 'done';
}

function inferPhaseFromText(currentPhase, text) {
  const combined = `${currentPhase}\n${text}`.toLowerCase();
  if (/\b(test|tests|testing|npm test|vitest|playwright|pytest)\b/.test(combined)) {
    return 'testing';
  }
  if (/\b(edit|edited|patch|write|created|updated|modified|implemented|apply_patch)\b/.test(combined)) {
    return 'editing';
  }
  return currentPhase === 'queued' ? 'planning' : currentPhase;
}

function buildArtifactAuthoringInstructions() {
  return [
    'Artifact authoring contract:',
    '- When the request asks you to create or modify an app, game, website, component, script, config, or project file, return complete file contents using this exact format:',
    '<<FILE:relative/path.ext>>',
    'complete file contents',
    '<<END_FILE>>',
    '- Use relative paths only. Do not use absolute paths, parent directory segments, or paths outside the project.',
    '- For a standalone browser game or web app, prefer index.html, style.css, and script.js. The host app will place them in a generated artifact folder.',
    '- Include all code needed to run the artifact. Do not merely describe what to write.',
    '- Keep any prose summary outside the file blocks and after the files when possible.',
    '- Do not wrap file contents in markdown fences unless the fence characters are literally part of the file.'
  ].join('\n');
}

export function materializeModelArtifacts({ task, content, artifactBaseDir = 'jarvis-artifacts' }) {
  const blocks = parseModelArtifactBlocks(content);
  if (blocks.length === 0) {
    return {
      root: '',
      rootRelative: '',
      filesChanged: [],
      skipped: []
    };
  }

  const slug = slugifyTaskPrompt(task.prompt);
  const taskSuffix = String(task.id ?? crypto.randomUUID()).replace(/[^a-f0-9-]/gi, '').slice(0, 8) || crypto.randomUUID().slice(0, 8);
  const workspace = path.resolve(task.workspace);
  const rootRelative = path.join(artifactBaseDir, `${slug}-${taskSuffix}`);
  const root = path.resolve(workspace, rootRelative);
  const filesChanged = [];
  const skipped = [];

  fs.mkdirSync(root, { recursive: true });
  const used = new Set();
  for (const block of blocks.slice(0, 40)) {
    const safePath = sanitizeArtifactPath(block.path, defaultArtifactPathFor(block, used.size));
    if (!safePath) {
      skipped.push({ path: block.path, reason: 'Invalid or unsafe artifact path.' });
      continue;
    }
    if (used.has(safePath)) {
      skipped.push({ path: block.path, reason: `Duplicate artifact path after normalization: ${safePath}` });
      continue;
    }
    used.add(safePath);

    const target = path.resolve(root, safePath);
    if (!isSubpath(root, target)) {
      skipped.push({ path: block.path, reason: 'Resolved outside the artifact folder.' });
      continue;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, normalizeFileContent(block.content), 'utf8');
    filesChanged.push(path.relative(workspace, target));
  }

  if (filesChanged.length === 0) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // Best effort cleanup only.
    }
  }

  return {
    root,
    rootRelative,
    filesChanged,
    skipped
  };
}

export function parseModelArtifactBlocks(content) {
  const text = String(content ?? '');
  return parseStrictArtifactBlocks(text)
    .concat(parseMarkdownArtifactBlocks(text))
    .concat(parseWholeDocumentArtifact(text));
}

function parseStrictArtifactBlocks(text) {
  const blocks = [];
  const pattern = /<<FILE:([^>\r\n]+)>>\s*([\s\S]*?)\s*<<END_FILE>>/gi;
  for (const match of text.matchAll(pattern)) {
    blocks.push({
      path: match[1].trim(),
      content: match[2] ?? '',
      source: 'file-block'
    });
  }
  return blocks;
}

function parseMarkdownArtifactBlocks(text) {
  if (/<<FILE:/i.test(text)) {
    return [];
  }

  const blocks = [];
  const used = new Set();
  const pattern = /```([^\r\n`]*)\r?\n([\s\S]*?)```/g;
  for (const match of text.matchAll(pattern)) {
    const info = String(match[1] ?? '').trim();
    const code = match[2] ?? '';
    const before = text.slice(Math.max(0, match.index - 260), match.index);
    const inferredPath = inferMarkdownCodePath(info, before, code, used, blocks.length);
    if (!inferredPath) {
      continue;
    }
    const safePath = sanitizeArtifactPath(inferredPath, defaultArtifactPathFor({ content: code }, blocks.length));
    if (!safePath || used.has(safePath)) {
      continue;
    }
    used.add(safePath);
    blocks.push({
      path: safePath,
      content: code,
      source: 'markdown-fence'
    });
  }
  return blocks;
}

function parseWholeDocumentArtifact(text) {
  const trimmed = text.trim();
  if (!trimmed || /<<FILE:/i.test(trimmed) || /```/.test(trimmed)) {
    return [];
  }
  if (/^<!doctype html>/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return [{ path: 'index.html', content: trimmed, source: 'whole-html' }];
  }
  return [];
}

function inferMarkdownCodePath(info, before, code, used, index) {
  const directPath = extractPathFromText(info) || extractPathFromText(before);
  if (directPath) {
    return directPath;
  }

  const language = info.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9+#.-]/g, '') ?? '';
  if (index === 0 && (/^<!doctype html>/i.test(code.trim()) || /^<html[\s>]/i.test(code.trim()))) {
    return 'index.html';
  }
  if (language === 'html') {
    return used.has('index.html') ? `page-${index + 1}.html` : 'index.html';
  }
  if (language === 'css') {
    return used.has('style.css') ? `style-${index + 1}.css` : 'style.css';
  }
  if (['js', 'javascript', 'mjs'].includes(language)) {
    return used.has('script.js') ? `script-${index + 1}.js` : 'script.js';
  }
  if (['ts', 'typescript'].includes(language)) {
    return used.has('script.ts') ? `script-${index + 1}.ts` : 'script.ts';
  }
  if (['json'].includes(language)) {
    return used.has('data.json') ? `data-${index + 1}.json` : 'data.json';
  }
  if (['md', 'markdown'].includes(language)) {
    return used.has('README.md') ? `notes-${index + 1}.md` : 'README.md';
  }
  return '';
}

function extractPathFromText(text) {
  const value = String(text ?? '');
  const patterns = [
    /\b(?:path|file|filename)\s*[:=]\s*`?([A-Za-z0-9_.\-\/\\ ]+\.[A-Za-z0-9]+)`?/i,
    /(?:^|\n)\s*(?:#{1,6}\s*)?`?([A-Za-z0-9_.\-\/\\ ]+\.[A-Za-z0-9]+)`?\s*$/i,
    /\b([A-Za-z0-9_.\-\/\\]+\/[A-Za-z0-9_.\-\/\\]+\.[A-Za-z0-9]+)\b/
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return '';
}

function sanitizeArtifactPath(input, fallback = '') {
  const raw = String(input || fallback || '').trim();
  if (!raw) {
    return '';
  }

  let clean = raw
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\\/g, '/')
    .replace(/^[A-Za-z]:\//, '')
    .replace(/^\/+/, '')
    .replace(/^\.\/+/, '');

  clean = clean.replace(/^jarvis-artifacts\/[^/]+\/?/i, '');
  clean = clean.replace(/^jarvis-artifacts\/?/i, '');

  const normalized = path.posix.normalize(clean);
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../') || path.posix.isAbsolute(normalized)) {
    return '';
  }
  if (!/\.[A-Za-z0-9]{1,12}$/.test(normalized)) {
    return '';
  }
  return normalized;
}

function defaultArtifactPathFor(block, index) {
  const content = String(block?.content ?? '').trim();
  if (/^<!doctype html>/i.test(content) || /^<html[\s>]/i.test(content)) {
    return index === 0 ? 'index.html' : `page-${index + 1}.html`;
  }
  if (/^\s*[{[]/.test(content)) {
    return index === 0 ? 'data.json' : `data-${index + 1}.json`;
  }
  return index === 0 ? 'artifact.txt' : `artifact-${index + 1}.txt`;
}

function normalizeFileContent(content) {
  return `${String(content ?? '').replace(/^\r?\n/, '').replace(/\s+$/, '')}\n`;
}

function slugifyTaskPrompt(prompt) {
  const slug = String(prompt ?? 'artifact')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return slug || 'artifact';
}

function isSubpath(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function appendArtifactSummary(output, materialized) {
  const lines = [
    '',
    'Artifact files created:',
    ...materialized.filesChanged.map((file) => `- ${file}`)
  ];
  if (materialized.skipped.length > 0) {
    lines.push('', 'Skipped unsafe artifact paths:');
    lines.push(...materialized.skipped.slice(0, 8).map((item) => `- ${item.path || '(empty)'}: ${item.reason}`));
  }
  return `${String(output ?? '').trimEnd()}\n${lines.join('\n')}`;
}

function stripArtifactBlocks(output) {
  return String(output ?? '')
    .replace(/<<FILE:[^>\r\n]+>>\s*[\s\S]*?\s*<<END_FILE>>/gi, '[artifact file omitted]')
    .replace(/```[\s\S]*?```/g, '[code block omitted]')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeText(text, limit) {
  const cleaned = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= limit) {
    return cleaned;
  }
  return `${cleaned.slice(0, Math.max(0, limit - 1)).trimEnd()}...`;
}

function titleFromTaskPrompt(prompt) {
  const title = summarizeText(prompt, 72)
    .replace(/[.!?]+$/g, '')
    .trim();
  return `Mission: ${title || 'Untitled task'}`;
}

function pushUnique(values, value) {
  if (value !== undefined && value !== null && !values.includes(value)) {
    values.push(value);
  }
}

function inferTaskArtifacts(output, logs) {
  const text = `${output}\n${logs}`;
  const filesChanged = uniqueMatches(text, /(?:^|\s)([A-Za-z]:\\[^\s<>"']+\.(?:ts|tsx|js|mjs|cjs|json|css|html|md|sqlite|toml|yml|yaml))/g)
    .concat(uniqueMatches(text, /\b((?:src|server|scripts|electron|dist|release|data)\/[^\s<>"']+\.[A-Za-z0-9]+)/g))
    .slice(0, 24);
  const commandsRun = uniqueMatches(text, /`([^`]*(?:npm|node|npx|codex|tsc|vite|electron-builder|playwright)[^`]*)`/g)
    .concat(uniqueMatches(text, /\b((?:npm|node|npx|codex|tsc|vite|electron-builder|playwright)\s+[^\r\n]+)/g))
    .map((command) => command.trim())
    .filter((command) => command.length <= 180)
    .slice(0, 24);
  const testsRun = commandsRun
    .filter((command) => /\b(test|build|playwright|tsc|vite build|package:win)\b/i.test(command))
    .slice(0, 12);
  return {
    filesChanged: [...new Set(filesChanged)],
    commandsRun: [...new Set(commandsRun)],
    testsRun: [...new Set(testsRun)]
  };
}

function uniqueMatches(text, pattern) {
  const values = [];
  for (const match of text.matchAll(pattern)) {
    const value = match[1]?.replace(/[),.;]+$/g, '').trim();
    if (value && !values.includes(value)) {
      values.push(value);
    }
  }
  return values;
}
