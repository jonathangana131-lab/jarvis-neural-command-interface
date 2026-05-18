import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { isPathAllowed, loadConfig, publicConfig } from './config.mjs';
import { EventBus } from './eventBus.mjs';
import { Embedder } from './embeddings.mjs';
import { MemoryExtractor } from './memoryExtractor.mjs';
import { MemoryStore } from './memoryStore.mjs';
import { CodexTaskRunner } from './codexTaskRunner.mjs';
import { TaskStore } from './taskStore.mjs';

const app = express();
const config = loadConfig();
const packageInfo = JSON.parse(fs.readFileSync(path.resolve(config.rootDir, 'package.json'), 'utf8'));
const logPath = path.resolve(config.dataDir, 'jarvis.log');
initLocalLogging(logPath);
const eventBus = new EventBus();
const memoryExtractor = new MemoryExtractor(config.memory);
const embedder = new Embedder({
  cacheDir: path.resolve(config.dataDir, 'transformers-cache')
});
const memoryStore = new MemoryStore(config.memory.databasePath, eventBus, { embedder });
const taskStore = new TaskStore(config.memory.databasePath);
const taskRunner = new CodexTaskRunner(config, eventBus, memoryStore, memoryExtractor, taskStore);
const localModelStatePath = path.resolve(config.dataDir, 'local-model.json');
const secretDir = path.resolve(process.env.JARVIS_SECRET_DIR ?? config.dataDir);
const modelSecretPath = path.resolve(secretDir, 'model-secrets.json');
const opencodeFreeModels = [
  'minimax-m2.5-free',
  'big-pickle',
  'ling-2.6-flash',
  'hy3-preview-free',
  'nemotron-3-super-free'
];
loadModelSecrets(modelSecretPath);
loadLocalModelState(config, localModelStatePath);

app.use(express.json({ limit: '1mb' }));

app.get('/api/config', (_req, res) => {
  res.json({
    ...publicConfig(config),
    appVersion: packageInfo.version,
    modelKey: modelKeyStatus(),
    memoryCount: memoryStore.count()
  });
});

app.get('/api/health', async (_req, res) => {
  const codex = await checkCodexStatus(config.codex.command);
  const localModel = await listLocalModels(config.localModel?.provider, config.localModel?.endpoint);
  res.json({
    app: {
      version: packageInfo.version,
      dataDir: config.dataDir,
      logPath
    },
    backend: {
      available: true,
      startedAt,
      port
    },
    modelKey: modelKeyStatus(),
    localModel,
    memory: {
      databasePath: config.memory.databasePath,
      exists: fs.existsSync(config.memory.databasePath),
      count: memoryStore.count(),
      embeddings: {
        disabled: embedder.disabled,
        dim: embedder.dim,
        lastError: embedder.lastError
      }
    },
    codex,
    queue: taskRunner.queueStatus()
  });
});

app.get('/api/update-check', async (_req, res) => {
  try {
    const response = await fetch('https://api.github.com/repos/jonathangana131-lab/jarvis-neural-command-interface/releases/latest', {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Jarvis-Neural-Command-Interface'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const release = await response.json();
    const latestVersion = String(release.tag_name ?? '').replace(/^v/i, '');
    res.json({
      currentVersion: packageInfo.version,
      latestVersion,
      updateAvailable: compareVersions(latestVersion, packageInfo.version) > 0,
      url: release.html_url,
      downloadUrl: release.assets?.find((asset) => String(asset.name ?? '').endsWith('.exe'))?.browser_download_url ?? release.html_url,
      name: release.name ?? release.tag_name,
      publishedAt: release.published_at
    });
  } catch (error) {
    res.json({
      currentVersion: packageInfo.version,
      latestVersion: packageInfo.version,
      updateAvailable: false,
      url: null,
      downloadUrl: null,
      name: null,
      publishedAt: null,
      error: error instanceof Error ? error.message : 'Unable to check for updates.'
    });
  }
});

app.get('/api/logs', (_req, res) => {
  res.json({
    path: logPath,
    tail: readLogTail(logPath, 24000)
  });
});

app.get('/api/codex/status', async (_req, res) => {
  res.json(await checkCodexStatus(config.codex.command));
});

app.get('/api/model-key/status', (_req, res) => {
  res.json(modelKeyStatus());
});

app.post('/api/model-key', (req, res, next) => {
  try {
    const apiKey = String(req.body?.apiKey ?? '').trim();
    if (!apiKey) {
      const error = new Error('OpenCode API key is required.');
      error.status = 400;
      throw error;
    }
    saveModelSecret(modelSecretPath, apiKey);
    process.env.OPENCODE_API_KEY = apiKey;
    res.json(modelKeyStatus());
  } catch (error) {
    next(error);
  }
});

app.delete('/api/model-key', (_req, res, next) => {
  try {
    if (fs.existsSync(modelSecretPath)) {
      fs.rmSync(modelSecretPath, { force: true });
    }
    delete process.env.OPENCODE_API_KEY;
    res.json(modelKeyStatus());
  } catch (error) {
    next(error);
  }
});

app.get('/api/local-models', async (req, res) => {
  const provider = normalizeProvider(req.query.provider ?? config.localModel?.provider);
  const endpoint = String(req.query.endpoint ?? config.localModel?.endpoint ?? defaultEndpoint(provider)).trim();
  res.json(await listLocalModels(provider, endpoint));
});

app.post('/api/local-model-selection', (req, res, next) => {
  try {
    const provider = normalizeProvider(req.body?.provider);
    const endpoint = String(req.body?.endpoint ?? defaultEndpoint(provider)).trim() || defaultEndpoint(provider);
    const model = String(req.body?.model ?? defaultModel(provider)).trim() || defaultModel(provider);
    config.localModel = { provider, endpoint, model };
    if (provider === 'codex') {
      config.codex.model = model;
    }
    fs.mkdirSync(path.dirname(localModelStatePath), { recursive: true });
    fs.writeFileSync(localModelStatePath, JSON.stringify(config.localModel, null, 2));
    res.json({ localModel: config.localModel });
  } catch (error) {
    next(error);
  }
});

function isSubpath(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function openLocalPath(target) {
  if (process.platform === 'win32') {
    spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'start', '', target], {
      windowsHide: true,
      stdio: 'ignore'
    }).unref();
    return;
  }
  if (process.platform === 'darwin') {
    spawn('open', [target], { stdio: 'ignore' }).unref();
    return;
  }
  spawn('xdg-open', [target], { stdio: 'ignore' }).unref();
}

app.get('/api/diagnostics', async (_req, res) => {
  const codex = await checkCodexStatus(config.codex.command);
  const localModel = await listLocalModels(config.localModel?.provider, config.localModel?.endpoint);
  res.json({
    codex,
    localModel,
    modelKey: modelKeyStatus(),
    voice: {
      speechRecognition: 'browser',
      microphone: 'browser',
      detail: 'Voice capability is verified in the renderer because microphone APIs are browser-scoped.'
    },
    config: publicConfig(config),
    sqlite: {
      databasePath: config.memory.databasePath,
      exists: fs.existsSync(config.memory.databasePath),
      memoryCount: memoryStore.count(),
      taskCount: taskRunner.list().length
    },
    queue: taskRunner.queueStatus()
  });
});

app.get('/api/events', (req, res) => {
  eventBus.connect(req, res);
});

app.get('/api/memories', (req, res) => {
  res.json({
    memories: memoryStore.list({
      query: req.query.q,
      scope: req.query.scope,
      workspace: req.query.workspace,
      limit: req.query.limit ? Number(req.query.limit) : 80
    }),
    count: memoryStore.count()
  });
});

app.post('/api/memories', (req, res) => {
  const memory = memoryStore.create(req.body ?? {});
  res.status(201).json({ memory, count: memoryStore.count() });
});

app.put('/api/memories/:id', (req, res) => {
  const memory = memoryStore.update(Number(req.params.id), req.body ?? {});
  if (!memory) {
    res.status(404).json({ error: 'Memory not found.' });
    return;
  }
  res.json({ memory, count: memoryStore.count() });
});

app.delete('/api/memories/:id', (req, res) => {
  const memory = memoryStore.delete(Number(req.params.id));
  if (!memory) {
    res.status(404).json({ error: 'Memory not found.' });
    return;
  }
  res.json({ memory, count: memoryStore.count() });
});

app.post('/api/memories/reset', (_req, res) => {
  const deleted = memoryStore.resetVisible();
  res.json({ deleted, count: memoryStore.count() });
});

app.get('/api/memory/edges', (req, res, next) => {
  try {
    const threshold = req.query.threshold === undefined ? undefined : Number(req.query.threshold);
    const limit = req.query.limit === undefined ? undefined : Math.max(0, Math.min(2000, Number(req.query.limit)));
    const summary = memoryStore.similarityEdges({
      ...(Number.isFinite(threshold) ? { threshold } : {}),
      ...(Number.isFinite(limit) ? { limit } : {})
    });
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.get('/api/memory/search', async (req, res, next) => {
  try {
    const limit = req.query.limit === undefined ? 20 : Math.max(1, Math.min(100, Number(req.query.limit)));
    const threshold = req.query.threshold === undefined ? undefined : Number(req.query.threshold);
    const results = await memoryStore.semanticSearch({
      query: req.query.q,
      scope: req.query.scope,
      workspace: req.query.workspace,
      limit,
      ...(Number.isFinite(threshold) ? { threshold } : {})
    });
    res.json({ results, count: results.length, available: results.length > 0 || !embedder.disabled });
  } catch (error) {
    next(error);
  }
});

app.get('/api/memory/duplicates', (req, res, next) => {
  try {
    const threshold = req.query.threshold === undefined ? undefined : Number(req.query.threshold);
    const limit = req.query.limit === undefined ? undefined : Math.max(1, Math.min(200, Number(req.query.limit)));
    const summary = memoryStore.nearDuplicates({
      ...(Number.isFinite(threshold) ? { threshold } : {}),
      ...(Number.isFinite(limit) ? { limit } : {})
    });
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.get('/api/memory/embeddings/status', (_req, res) => {
  res.json(memoryStore.embeddingsReady());
});

app.post('/api/remember', async (req, res, next) => {
  try {
    const extracted = await memoryExtractor.extractFromText(req.body?.text, req.body?.source);
    const memories = uniqueById(extracted.memories.map((memory) => memoryStore.create(memory)).filter(Boolean));
    res.status(201).json({ memories, skipped: extracted.skipped, count: memoryStore.count() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tasks', (_req, res) => {
  res.json({ tasks: taskRunner.list() });
});

app.get('/api/queue', (_req, res) => {
  res.json({ queue: taskRunner.queueStatus() });
});

app.get('/api/tasks/:id', (req, res) => {
  const task = taskRunner.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }
  res.json({ task });
});

app.post('/api/tasks', (req, res, next) => {
  try {
    const task = taskRunner.start(req.body ?? {});
    res.status(202).json({ task });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks/:id/cancel', (req, res, next) => {
  try {
    const task = taskRunner.cancel(req.params.id);
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks/:id/retry', (req, res, next) => {
  try {
    const task = taskRunner.retry(req.params.id);
    res.status(202).json({ task });
  } catch (error) {
    next(error);
  }
});

app.post('/api/artifacts/open', (req, res, next) => {
  try {
    const workspace = path.resolve(String(req.body?.workspace ?? config.defaultWorkspace));
    const relativePath = String(req.body?.path ?? '').trim();
    if (!relativePath) {
      const error = new Error('Artifact path is required.');
      error.status = 400;
      throw error;
    }
    if (!isPathAllowed(config, workspace)) {
      const error = new Error(`Workspace is outside the allowlist: ${workspace}`);
      error.status = 403;
      throw error;
    }

    const target = path.resolve(workspace, relativePath);
    if (!isSubpath(workspace, target)) {
      const error = new Error('Artifact path resolved outside the workspace.');
      error.status = 403;
      throw error;
    }
    if (!fs.existsSync(target)) {
      const error = new Error(`Artifact does not exist: ${relativePath}`);
      error.status = 404;
      throw error;
    }

    openLocalPath(target);
    res.json({ ok: true, path: target });
  } catch (error) {
    next(error);
  }
});

app.post('/api/queue/pause', (_req, res) => {
  res.json({ queue: taskRunner.pauseQueue() });
});

app.post('/api/queue/resume', (_req, res) => {
  res.json({ queue: taskRunner.resumeQueue() });
});

const distDir = path.resolve(config.rootDir, 'dist');
if (fs.existsSync(path.resolve(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.resolve(distDir, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    error: error.message || 'Unexpected server error.'
  });
});

const port = Number(process.env.PORT ?? 8787);
const startedAt = new Date().toISOString();
app.listen(port, '127.0.0.1', () => {
  console.log(`Jarvis Neural Command Interface backend listening on http://127.0.0.1:${port}`);
});

function initLocalLogging(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };
  const write = (level, args) => {
    const line = `[${new Date().toISOString()}] ${level} ${args.map(formatLogArg).join(' ')}\n`;
    fs.appendFile(targetPath, line, () => {});
  };
  console.log = (...args) => {
    write('INFO', args);
    original.log(...args);
  };
  console.warn = (...args) => {
    write('WARN', args);
    original.warn(...args);
  };
  console.error = (...args) => {
    write('ERROR', args);
    original.error(...args);
  };
}

function formatLogArg(value) {
  if (value instanceof Error) {
    return value.stack ?? value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readLogTail(targetPath, maxBytes) {
  if (!fs.existsSync(targetPath)) {
    return '';
  }
  const stat = fs.statSync(targetPath);
  const length = Math.min(maxBytes, stat.size);
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(targetPath, 'r');
  try {
    fs.readSync(fd, buffer, 0, length, stat.size - length);
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString('utf8');
}

function compareVersions(a, b) {
  const left = String(a ?? '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = String(b ?? '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function uniqueById(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.id)) {
      return false;
    }
    seen.add(row.id);
    return true;
  });
}

function checkCodexStatus(command) {
  return new Promise((resolve) => {
    const child = spawnVersionCommand(command);
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', (error) => {
      resolve({ command, available: false, detail: error.message });
    });
    child.on('exit', (code) => {
      resolve({
        command,
        available: code === 0,
        detail: output.trim() || (code === 0 ? 'Codex command is available.' : `Codex exited with code ${code}.`)
      });
    });
  });
}

function spawnVersionCommand(command) {
  if (process.platform === 'win32') {
    const commandLine = [command, '--version'].map(quoteCmdArg).join(' ');
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', commandLine], {
      shell: false,
      windowsHide: true,
      env: process.env
    });
  }

  return spawn(command, ['--version'], {
    shell: false,
    env: process.env
  });
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[ \t"&<>|^]/.test(text)) {
    return text;
  }
  return `"${text.replace(/(["^&<>|])/g, '^$1')}"`;
}

function loadLocalModelState(config, statePath) {
  try {
    if (!fs.existsSync(statePath)) {
      return;
    }
    const saved = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const provider = normalizeProvider(saved.provider);
    config.localModel = {
      provider,
      endpoint: String(saved.endpoint ?? defaultEndpoint(provider)).trim(),
      model: String(saved.model ?? defaultModel(provider)).trim()
    };
    config.codex.model = config.localModel.model;
  } catch (error) {
    console.warn(`Unable to load local model settings: ${error.message}`);
  }
}

function loadModelSecrets(secretPath) {
  try {
    if (!fs.existsSync(secretPath)) {
      return;
    }
    const saved = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
    const apiKey = String(saved?.opencodeApiKey ?? '').trim();
    if (apiKey) {
      process.env.OPENCODE_API_KEY = apiKey;
    }
  } catch (error) {
    console.warn(`Unable to load model secret settings: ${error.message}`);
  }
}

function saveModelSecret(secretPath, apiKey) {
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  fs.writeFileSync(secretPath, JSON.stringify({ opencodeApiKey: apiKey }, null, 2));
}

function modelKeyStatus() {
  return {
    present: Boolean(process.env.OPENCODE_API_KEY),
    source: fs.existsSync(modelSecretPath)
      ? 'userData'
      : process.env.OPENCODE_API_KEY ? 'environment' : 'missing'
  };
}

function normalizeProvider(provider) {
  const value = String(provider ?? '').toLowerCase();
  if (value === 'ollama') {
    return 'ollama';
  }
  if (value === 'lmstudio') {
    return 'lmstudio';
  }
  if (value === 'codex') {
    return 'codex';
  }
  return 'opencode';
}

function defaultEndpoint(provider) {
  const normalized = normalizeProvider(provider);
  if (normalized === 'ollama') {
    return 'http://127.0.0.1:11434';
  }
  if (normalized === 'lmstudio') {
    return 'http://127.0.0.1:1234/v1';
  }
  if (normalized === 'codex') {
    return '';
  }
  return 'https://opencode.ai/zen/v1';
}

function defaultModel(provider) {
  const normalized = normalizeProvider(provider);
  if (normalized === 'codex') return 'gpt-5.5';
  if (normalized === 'opencode') return 'minimax-m2.5-free';
  return '';
}

async function listLocalModels(providerInput, endpointInput) {
  const provider = normalizeProvider(providerInput);
  const endpoint = String(endpointInput ?? defaultEndpoint(provider)).trim() || defaultEndpoint(provider);
  if (provider === 'opencode' && !process.env.OPENCODE_API_KEY) {
    return {
      provider,
      endpoint,
      available: false,
      models: opencodeFreeModels,
      detail: 'Missing OpenCode API key. Save a key to scan live models.'
    };
  }
  const baseUrl = endpoint.replace(/\/+$/, '');
  const target = provider === 'ollama' ? `${baseUrl}/api/tags` : `${baseUrl}/models`;
  try {
    const headers = provider === 'opencode' && process.env.OPENCODE_API_KEY
      ? { Authorization: `Bearer ${process.env.OPENCODE_API_KEY}` }
      : undefined;
    const response = await fetch(target, { headers, signal: AbortSignal.timeout(3500) });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? data?.error ?? `${response.status} ${response.statusText}`);
    }
    const models = provider === 'ollama'
      ? (data.models ?? []).map((model) => model.name).filter(Boolean)
      : (data.data ?? []).map((model) => model.id).filter(Boolean);
    const sortedModels = provider === 'opencode' ? prioritizeOpencodeModels(models) : models;
    return {
      provider,
      endpoint,
      available: true,
      models: sortedModels,
      detail: sortedModels.length > 0 ? `${sortedModels.length} model${sortedModels.length === 1 ? '' : 's'} detected.` : 'Server is online, but no models were reported.'
    };
  } catch (error) {
    if (provider === 'opencode') {
      return {
        provider,
        endpoint,
        available: false,
        models: opencodeFreeModels,
        detail: `${error instanceof Error ? error.message : 'OpenCode Zen is not reachable.'} Showing preset free models.`
      };
    }
    return {
      provider,
      endpoint,
      available: false,
      models: [],
      detail: error instanceof Error ? error.message : 'Local model server is not reachable.'
    };
  }
}

function prioritizeOpencodeModels(models) {
  const unique = [...new Set([...opencodeFreeModels, ...models])];
  return unique.sort((a, b) => {
    const aFree = opencodeFreeModels.indexOf(a);
    const bFree = opencodeFreeModels.indexOf(b);
    if (aFree !== -1 || bFree !== -1) {
      return (aFree === -1 ? 999 : aFree) - (bFree === -1 ? 999 : bFree);
    }
    return a.localeCompare(b);
  });
}
