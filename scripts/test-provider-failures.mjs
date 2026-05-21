import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { CodexTaskRunner } from '../server/codexTaskRunner.mjs';
import { checkProviderHealth } from '../server/providerHealth.mjs';
import { TaskStore } from '../server/taskStore.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-provider-failures-'));
const workspace = path.join(tempRoot, 'workspace');
const dataDir = path.join(tempRoot, 'data');
fs.mkdirSync(workspace, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
process.env.OPENCODE_API_KEY = 'mock-key';

try {
  await assertProviderFailure({
    name: 'opencode-auth',
    selectedModel: 'mock-stream-model',
    models: ['mock-stream-model'],
    chatStatus: 401,
    chatBody: { error: { message: 'Unauthorized API key' } },
    expectedKind: 'auth'
  });

  await assertProviderFailure({
    name: 'opencode-rate-limit',
    selectedModel: 'mock-stream-model',
    models: ['mock-stream-model'],
    chatStatus: 429,
    chatBody: { error: { message: 'Too many requests' } },
    expectedKind: 'rate_limit'
  });

  await assertProviderFailure({
    name: 'opencode-model-missing',
    selectedModel: 'missing-model',
    models: ['available-model'],
    chatStatus: 200,
    chatBody: { choices: [{ message: { content: 'should not run' } }] },
    expectedKind: 'model_missing'
  });

  await assertSuccessfulMockStream();
  console.log('provider failure tests passed');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

async function assertProviderFailure({ name, selectedModel, models, chatStatus, chatBody, expectedKind }) {
  const server = createMockOpenCodeServer({ models, chatStatus, chatBody });
  const port = await listen(server);
  const taskStore = new TaskStore(path.join(dataDir, `${name}.sqlite`));
  const runner = createRunner({
    taskStore,
    model: selectedModel,
    endpoint: `http://127.0.0.1:${port}/v1`
  });
  try {
    const task = runner.start({ prompt: `${name} prompt`, workspace });
    const finished = await waitForTask(runner, task.id);
    assert.equal(finished.status, 'failed', `${name} should fail cleanly`);
    assert.equal(finished.failureKind, expectedKind, `${name} should classify provider failure`);
    assert.equal(finished.providerUsed, 'opencode', `${name} should record OpenCode as the provider`);
    assert.match(finished.failureAction ?? '', /Codex|Settings|provider scan|Diagnostics/i, `${name} should expose a recovery action`);
    assert.doesNotMatch(finished.output, /"error"\s*:/i, `${name} should not dump raw provider JSON`);
  } finally {
    taskStore.close();
    await close(server);
  }
}

async function assertSuccessfulMockStream() {
  const server = createMockOpenCodeServer({
    models: ['mock-stream-model'],
    chatStatus: 200,
    streamChunks: ['stream ', 'artifact ', 'complete']
  });
  const port = await listen(server);
  const taskStore = new TaskStore(path.join(dataDir, 'opencode-success.sqlite'));
  const runner = createRunner({
    taskStore,
    model: 'mock-stream-model',
    endpoint: `http://127.0.0.1:${port}/v1`
  });
  try {
    const task = runner.start({ prompt: 'mock success prompt', workspace });
    const finished = await waitForTask(runner, task.id);
    assert.equal(finished.status, 'completed', 'mock OpenCode stream should complete');
    assert.equal(finished.providerUsed, 'opencode', 'successful mock should record provider');
    assert.equal(finished.failureKind, null, 'successful mock should clear failure kind');
    assert.match(finished.output, /stream artifact complete/, 'streamed chunks should materialize into output');
  } finally {
    taskStore.close();
    await close(server);
  }
}

function createRunner({ taskStore, endpoint, model }) {
  const config = {
    rootDir: path.resolve(import.meta.dirname, '..'),
    dataDir,
    defaultWorkspace: workspace,
    workspaceAllowlist: [workspace],
    memory: { automatic: true, databasePath: path.join(dataDir, 'memory.sqlite') },
    localModel: {
      provider: 'opencode',
      endpoint,
      model
    },
    codex: {
      command: 'codex-command-disabled-for-provider-test',
      model: 'gpt-5.5',
      reasoningEffort: 'low',
      ephemeral: true,
      maxTaskRuntimeMs: 5000,
      blockedPhrases: []
    }
  };
  return new CodexTaskRunner(
    config,
    { emit() {} },
    {
      relevantForKeyword() {
        return [];
      },
      create() {
        return { id: Math.floor(Math.random() * 100000) + 1 };
      }
    },
    {
      async extractFromTask() {
        return { memories: [], skipped: [] };
      }
    },
    taskStore,
    {
      getProviderHealth: ({ force } = {}) => checkProviderHealth({
        provider: config.localModel.provider,
        endpoint: config.localModel.endpoint,
        model: config.localModel.model,
        apiKey: process.env.OPENCODE_API_KEY,
        timeoutMs: force ? 1000 : 1000,
        codexStatus: async () => ({ available: false, detail: 'Codex disabled for provider tests.' })
      }),
      getCodexStatus: async () => ({ available: false, detail: 'Codex disabled for provider tests.' })
    }
  );
}

function createMockOpenCodeServer({ models, chatStatus, chatBody, streamChunks = [] }) {
  return http.createServer(async (req, res) => {
    if (req.url === '/v1/models') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ data: models.map((id) => ({ id })) }));
      return;
    }
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      await readBody(req);
      if (streamChunks.length > 0) {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache'
        });
        for (const chunk of streamChunks) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
        }
        res.end('data: [DONE]\n\n');
        return;
      }
      res.writeHead(chatStatus, { 'content-type': 'application/json' });
      res.end(JSON.stringify(chatBody));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
}

async function waitForTask(runner, id) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const task = runner.get(id);
    if (task && ['completed', 'failed', 'timed_out', 'cancelled'].includes(task.status)) {
      return task;
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for task ${id}`);
}

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function close(server) {
  server.close();
  await once(server, 'close');
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
