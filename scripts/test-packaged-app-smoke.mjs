import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const exePath = path.resolve(process.argv[2] ?? 'release/win-unpacked/Jarvis Neural Command Interface.exe');
if (!fs.existsSync(exePath)) {
  throw new Error(`Packaged app executable not found: ${exePath}`);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-packaged-smoke-'));
const appData = path.join(tempRoot, 'roaming');
fs.mkdirSync(appData, { recursive: true });

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
    for (const chunk of ['packaged ', 'stream ', 'message ', 'complete.']) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      await delay(40);
    }
    res.end('data: [DONE]\n\n');
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

const mockPort = await listen(mockServer);
const appPort = await freePort();

const appProcess = spawn(exePath, [], {
  env: {
    ...process.env,
    APPDATA: appData,
    PORT: String(appPort),
    OPENCODE_API_KEY: 'mock-key',
    OPENAI_API_KEY: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
appProcess.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
appProcess.stderr.on('data', (chunk) => {
  output += chunk.toString();
});

try {
  const config = await waitForJson(`http://127.0.0.1:${appPort}/api/config`, 45000);
  fs.mkdirSync(config.defaultWorkspace, { recursive: true });
  await postJson(appPort, '/api/model-key', { apiKey: 'mock-key' });
  const saved = await postJson(appPort, '/api/local-model-selection', {
    provider: 'opencode',
    endpoint: `http://127.0.0.1:${mockPort}/v1`,
    model: 'mock-stream-model'
  });
  if (saved.localModel?.endpoint !== `http://127.0.0.1:${mockPort}/v1`) {
    throw new Error(`Packaged app did not save first-run model settings: ${JSON.stringify(saved.localModel)}`);
  }

  const first = await runTask(appPort, config.defaultWorkspace, 'first packaged smoke message');
  const second = await runTask(appPort, config.defaultWorkspace, 'second packaged smoke message');
  for (const [label, task] of [['first', first], ['second', second]]) {
    if (task.status !== 'completed') {
      throw new Error(`${label} packaged task did not complete: ${task.status}`);
    }
    if (!task.output.includes('packaged stream message complete.')) {
      throw new Error(`${label} packaged task output was not streamed correctly: ${task.output}`);
    }
  }
  console.log('packaged app smoke passed');
} finally {
  await stopChild(appProcess);
  await closeServer(mockServer);
  removeTempRoot(tempRoot);
}

async function runTask(port, workspacePath, prompt) {
  const data = await postJson(port, '/api/tasks', { prompt, workspace: workspacePath });
  if (!data.task?.id) {
    throw new Error('Task create did not return an id.');
  }
  return waitForTask(port, data.task.id);
}

async function postJson(port, pathname, body) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? `${pathname} failed with ${response.status}`);
  }
  return data;
}

async function waitForTask(port, taskId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 25000) {
    const response = await fetch(`http://127.0.0.1:${port}/api/tasks/${taskId}`);
    const data = await response.json();
    if (['completed', 'failed', 'timed_out', 'cancelled'].includes(data.task?.status)) {
      return data.task;
    }
    await delay(150);
  }
  throw new Error(`Task ${taskId} timed out. App output:\n${output}`);
}

async function waitForJson(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {
      await delay(200);
    }
  }
  throw new Error(`Timed out waiting for ${url}. App output:\n${output}`);
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

async function freePort() {
  const serverInstance = http.createServer();
  const port = await listen(serverInstance);
  await closeServer(serverInstance);
  return port;
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.killed) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
    child.kill();
    setTimeout(() => resolve(), 4000).unref();
  });
}

function removeTempRoot(target) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
      return;
    } catch (error) {
      if (attempt === 4) {
        console.warn(`Unable to remove temporary packaged smoke directory ${target}: ${error.message}`);
      }
    }
  }
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
