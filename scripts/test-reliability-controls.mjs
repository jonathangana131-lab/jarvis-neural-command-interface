import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-reliability-controls-'));
const workspace = path.join(tempRoot, 'workspace');
const dataDir = path.join(tempRoot, 'data');
const configPath = path.join(tempRoot, 'jarvis.config.json');
fs.mkdirSync(workspace, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

const mockServer = http.createServer(async (req, res) => {
  if (req.url === '/v1/models') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ data: [{ id: 'mock-stream-model' }] }));
    return;
  }
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    await readBody(req);
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache'
    });
    for (const chunk of ['quick ', 'task ', 'complete.']) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      await delay(20);
    }
    res.end('data: [DONE]\n\n');
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

const mockPort = await listen(mockServer);
const appPort = await freePort();
fs.writeFileSync(configPath, JSON.stringify({
  assistantName: 'Jarvis Neural Command Interface',
  workspaceAllowlist: [workspace],
  defaultWorkspace: workspace,
  memory: {
    automatic: true,
    databasePath: 'memory.sqlite',
    extractor: 'local-rules',
    minConfidence: 0.68
  },
  localModel: {
    provider: 'opencode',
    endpoint: `http://127.0.0.1:${mockPort}/v1`,
    model: 'mock-stream-model'
  },
  codex: {
    command: 'codex.cmd',
    model: 'gpt-5.5',
    reasoningEffort: 'low',
    ephemeral: true,
    maxTaskRuntimeMs: 30000,
    blockedPhrases: []
  }
}, null, 2));

const server = spawn(process.execPath, ['--experimental-sqlite', 'server/index.mjs'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: {
    ...process.env,
    PORT: String(appPort),
    JARVIS_CONFIG: configPath,
    JARVIS_DATA_DIR: dataDir,
    JARVIS_SECRET_DIR: dataDir,
    OPENCODE_API_KEY: 'mock-key',
    OPENAI_API_KEY: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
server.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  output += chunk.toString();
});

try {
  await waitFor(`http://127.0.0.1:${appPort}/api/config`, 15000);
  await postJson(appPort, '/api/queue/pause', {});
  const first = await postJson(appPort, '/api/tasks', { prompt: 'first queued quick task', workspace, quick: true });
  const second = await postJson(appPort, '/api/tasks', { prompt: 'second queued standard task', workspace });
  assert.equal(first.task.taskMode, 'quick', 'quick task mode should be persisted at dispatch');
  let queue = await getJson(appPort, '/api/queue');
  assert.equal(queue.queue.paused, true, 'queue should be paused');
  assert.equal(queue.queue.queuedCount, 2, 'queue should expose queued task count');
  assert.equal(queue.queue.nextTaskId, first.task.id, 'queue should expose next task');
  assert.match(queue.queue.reason, /paused/i, 'queue should explain why tasks are waiting');

  const cancelled = await postJson(appPort, `/api/tasks/${first.task.id}/cancel`, {});
  assert.equal(cancelled.task.status, 'cancelled', 'queued task cancel should work');
  queue = await getJson(appPort, '/api/queue');
  assert.equal(queue.queue.queuedCount, 1, 'queue count should update after cancel');

  await postJson(appPort, '/api/queue/resume', {});
  const finished = await waitForTask(appPort, second.task.id);
  assert.equal(finished.status, 'completed', 'resumed queued task should complete');
  assert.equal(finished.taskMode, 'standard', 'standard task mode should be persisted');
  assert.ok(finished.timing?.queuedAt, 'task should include queued timing');
  assert.ok(finished.timing?.providerCheckStartedAt, 'task should include provider check timing');
  assert.ok(finished.timing?.providerCheckFinishedAt, 'task should include provider check completion timing');
  assert.ok(finished.timing?.startedAt, 'task should include started timing');
  assert.ok(finished.timing?.firstOutputAt, 'task should include first output timing');
  assert.ok(finished.timing?.finishedAt, 'task should include finished timing');

  const packageInfo = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../package.json'), 'utf8'));
  const expectedVersion = packageInfo.version;

  const diagnostics = await getJson(appPort, '/api/diagnostics');
  assert.equal(diagnostics.install.version, expectedVersion, 'diagnostics should expose install version');
  assert.equal(typeof diagnostics.queue.reason, 'string', 'diagnostics should expose queue reason');
  const bundle = await getJson(appPort, '/api/diagnostics/bundle');
  assert.ok(fs.existsSync(bundle.path), 'diagnostic bundle should be written');
  assert.ok(bundle.size > 100, 'diagnostic bundle should contain useful content');
  const repair = await postJson(appPort, '/api/recovery/repair-install', {});
  assert.equal(repair.install.version, expectedVersion, 'repair install should report install status');
  assert.equal(typeof repair.cleanup.removedCount, 'number', 'repair install should report cleanup count');

  console.log('reliability controls tests passed');
} finally {
  await stopChild(server);
  await closeServer(mockServer);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

async function waitForTask(port, taskId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    const data = await getJson(port, `/api/tasks/${taskId}`);
    if (['completed', 'failed', 'timed_out', 'cancelled'].includes(data.task.status)) {
      return data.task;
    }
    await delay(100);
  }
  throw new Error(`Task ${taskId} timed out. App output:\n${output}`);
}

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function closeServer(server) {
  server.close();
  await once(server, 'close');
}

async function freePort() {
  const server = http.createServer();
  const port = await listen(server);
  await closeServer(server);
  return port;
}

async function waitFor(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}. App output:\n${output}`);
}

async function getJson(port, pathName) {
  const response = await fetch(`http://127.0.0.1:${port}${pathName}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? `GET ${pathName} failed`);
  }
  return data;
}

async function postJson(port, pathName, body) {
  const response = await fetch(`http://127.0.0.1:${port}${pathName}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? `POST ${pathName} failed`);
  }
  return data;
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

async function stopChild(child) {
  if (!child || child.killed) return;
  child.kill();
  await Promise.race([
    once(child, 'exit'),
    delay(3000).then(() => {
      try {
        child.kill('SIGKILL');
      } catch {}
    })
  ]);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
