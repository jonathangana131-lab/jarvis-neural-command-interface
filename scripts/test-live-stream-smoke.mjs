import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-live-smoke-'));
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
      'cache-control': 'no-cache',
      connection: 'keep-alive'
    });
    const chunks = ['stream ', 'token ', 'update ', 'complete.'];
    for (const chunk of chunks) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      await delay(35);
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
    model: 'mock-stream-model',
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
    OPENCODE_API_KEY: 'mock-key',
    OPENAI_API_KEY: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitFor(`http://127.0.0.1:${appPort}/api/config`, 15000);
  const first = await runTask(appPort, workspace, 'first live smoke message');
  const second = await runTask(appPort, workspace, 'second live smoke message');

  for (const [label, task] of [['first', first], ['second', second]]) {
    if (task.status !== 'completed') {
      throw new Error(`${label} task did not complete: ${task.status}`);
    }
    if (!task.output.includes('stream token update complete.')) {
      throw new Error(`${label} task did not capture streamed output: ${task.output}`);
    }
  }

  console.log('live stream smoke passed');
} finally {
  await stopChild(server);
  await closeServer(mockServer);
  removeTempRoot(tempRoot);
}

async function runTask(port, workspacePath, prompt) {
  const response = await fetch(`http://127.0.0.1:${port}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, workspace: workspacePath })
  });
  const data = await response.json();
  if (!response.ok || !data.task?.id) {
    throw new Error(data.error ?? `Task create failed with ${response.status}`);
  }
  return waitForTask(port, data.task.id);
}

async function waitForTask(port, taskId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20000) {
    const response = await fetch(`http://127.0.0.1:${port}/api/tasks/${taskId}`);
    const data = await response.json();
    if (['completed', 'failed', 'timed_out', 'cancelled'].includes(data.task?.status)) {
      return data.task;
    }
    await delay(120);
  }
  throw new Error(`Task ${taskId} timed out. Server output:\n${serverOutput}`);
}

async function waitFor(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await delay(100);
    }
  }
  throw new Error(`Timed out waiting for ${url}. Server output:\n${serverOutput}`);
}

function listen(serverInstance) {
  return new Promise((resolve) => {
    serverInstance.listen(0, '127.0.0.1', () => {
      resolve(serverInstance.address().port);
    });
  });
}

function closeServer(serverInstance) {
  return new Promise((resolve) => {
    serverInstance.close(() => resolve());
  });
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.killed) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
    child.kill();
    setTimeout(() => resolve(), 3000).unref();
  });
}

function removeTempRoot(target) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
      return;
    } catch (error) {
      if (attempt === 4) {
        console.warn(`Unable to remove temporary smoke directory ${target}: ${error.message}`);
      }
    }
  }
}

async function freePort() {
  const serverInstance = http.createServer();
  const port = await listen(serverInstance);
  serverInstance.close();
  return port;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
