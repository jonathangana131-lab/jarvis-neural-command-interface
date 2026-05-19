import fs from 'node:fs';
import crypto from 'node:crypto';
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
  if (req.url === '/github/releases/latest') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      tag_name: 'v9.9.9',
      name: 'Mock update',
      html_url: `http://127.0.0.1:${mockPort}/release`,
      published_at: new Date().toISOString(),
      assets: [{
        name: 'Jarvis-Neural-Command-Interface-Setup-9.9.9.exe',
        size: mockInstaller.length,
        digest: `sha256:${mockInstallerSha256.toLowerCase()}`,
        browser_download_url: `http://127.0.0.1:${mockPort}/downloads/Jarvis-Neural-Command-Interface-Setup-9.9.9.exe`
      }]
    }));
    return;
  }

  if (req.url === '/downloads/Jarvis-Neural-Command-Interface-Setup-9.9.9.exe') {
    res.setHeader('content-type', 'application/octet-stream');
    res.end(mockInstaller);
    return;
  }

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

const mockInstaller = Buffer.from('mock jarvis update installer');
const mockInstallerSha256 = crypto.createHash('sha256').update(mockInstaller).digest('hex').toUpperCase();
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
    JARVIS_SECRET_DIR: dataDir,
    JARVIS_UPDATE_RELEASE_URL: `http://127.0.0.1:${mockPort}/github/releases/latest`,
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
  const health = await getJson(appPort, '/api/health');
  if (!health.backend?.available || !health.app?.logPath) {
    throw new Error(`Health endpoint did not report a running backend: ${JSON.stringify(health)}`);
  }
  const update = await getJson(appPort, '/api/update-check');
  if (!update.currentVersion) {
    throw new Error(`Update endpoint did not report the current version: ${JSON.stringify(update)}`);
  }
  if (!update.updateAvailable || update.latestVersion !== '9.9.9' || update.digest !== `sha256:${mockInstallerSha256.toLowerCase()}`) {
    throw new Error(`Update endpoint did not report the mock release: ${JSON.stringify(update)}`);
  }
  await postJson(appPort, '/api/update/download', {});
  const downloadedUpdate = await waitForUpdateReady(appPort);
  if (downloadedUpdate.sha256 !== mockInstallerSha256 || !fs.existsSync(downloadedUpdate.installerPath)) {
    throw new Error(`Update download was not verified: ${JSON.stringify(downloadedUpdate)}`);
  }
  if (!downloadedUpdate.backupPath || !fs.existsSync(downloadedUpdate.backupPath)) {
    throw new Error(`Update backup was not created: ${JSON.stringify(downloadedUpdate)}`);
  }
  const preparedUpdate = await postJson(appPort, '/api/update/prepare-install', {});
  if (!preparedUpdate.ready || preparedUpdate.sha256 !== mockInstallerSha256 || preparedUpdate.installerPath !== downloadedUpdate.installerPath) {
    throw new Error(`Update prepare did not verify the downloaded installer: ${JSON.stringify(preparedUpdate)}`);
  }
  const legacyInstall = await postJson(appPort, '/api/update/install', {});
  if (legacyInstall.launched !== false || legacyInstall.requiresDesktopBridge !== true) {
    throw new Error(`Legacy update install endpoint should not launch installers directly: ${JSON.stringify(legacyInstall)}`);
  }
  const storageBeforeCleanup = await getJson(appPort, '/api/storage');
  if (storageBeforeCleanup.updates.size < mockInstaller.length || storageBeforeCleanup.totalSize < storageBeforeCleanup.updates.size) {
    throw new Error(`Storage endpoint did not report downloaded updates: ${JSON.stringify(storageBeforeCleanup)}`);
  }
  const cleanup = await postJson(appPort, '/api/storage/cleanup', { target: 'updates' });
  if (cleanup.removedCount < 1 || cleanup.storage.updates.size !== 0) {
    throw new Error(`Update cleanup did not remove downloaded installer: ${JSON.stringify(cleanup)}`);
  }
  const logs = await getJson(appPort, '/api/logs');
  if (typeof logs.tail !== 'string' || !logs.path) {
    throw new Error(`Logs endpoint did not return a log path and tail: ${JSON.stringify(logs)}`);
  }
  const chat = await postJson(appPort, '/api/chats', { title: 'Smoke chat', workspace });
  if (!chat.chat?.id || chat.chat.title !== 'Smoke chat') {
    throw new Error(`Chat create did not return a usable session: ${JSON.stringify(chat)}`);
  }
  const first = await runTask(appPort, workspace, 'first live smoke message', chat.chat.id);
  const second = await runTask(appPort, workspace, 'second live smoke message', chat.chat.id);

  for (const [label, task] of [['first', first], ['second', second]]) {
    if (task.status !== 'completed') {
      throw new Error(`${label} task did not complete: ${task.status}`);
    }
    if (task.chatId !== chat.chat.id) {
      throw new Error(`${label} task did not preserve chat id: ${JSON.stringify(task)}`);
    }
    if (!task.output.includes('stream token update complete.')) {
      throw new Error(`${label} task did not capture streamed output: ${task.output}`);
    }
  }
  const chats = await getJson(appPort, '/api/chats');
  const listedChat = chats.chats.find((entry) => entry.id === chat.chat.id);
  if (!listedChat || listedChat.taskCount !== 2 || listedChat.lastStatus !== 'completed') {
    throw new Error(`Chat list did not summarize the completed tasks: ${JSON.stringify(chats)}`);
  }
  const chatTasks = await getJson(appPort, `/api/chats/${chat.chat.id}/tasks`);
  if (chatTasks.tasks.length !== 2 || chatTasks.tasks[0].prompt !== 'first live smoke message') {
    throw new Error(`Chat task listing was not ordered oldest to newest: ${JSON.stringify(chatTasks)}`);
  }
  const renamed = await putJson(appPort, `/api/chats/${chat.chat.id}`, { title: 'Renamed smoke chat' });
  if (renamed.chat.title !== 'Renamed smoke chat') {
    throw new Error(`Chat rename failed: ${JSON.stringify(renamed)}`);
  }
  await deleteJson(appPort, `/api/chats/${chat.chat.id}`);
  const afterArchive = await getJson(appPort, '/api/chats');
  if (afterArchive.chats.some((entry) => entry.id === chat.chat.id)) {
    throw new Error(`Archived chat should not appear in active list: ${JSON.stringify(afterArchive)}`);
  }

  console.log('live stream smoke passed');
} finally {
  await stopChild(server);
  await closeServer(mockServer);
  removeTempRoot(tempRoot);
}

async function runTask(port, workspacePath, prompt, chatId) {
  const data = await postJson(port, '/api/tasks', { prompt, workspace: workspacePath, chatId });
  if (!data.task?.id) {
    throw new Error(data.error ?? 'Task create did not return an id.');
  }
  return waitForTask(port, data.task.id);
}

async function putJson(port, pathname, body) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? `${pathname} failed with ${response.status}`);
  }
  return data;
}

async function deleteJson(port, pathname) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, { method: 'DELETE' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? `${pathname} failed with ${response.status}`);
  }
  return data;
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

async function getJson(port, pathname) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? `${pathname} failed with ${response.status}`);
  }
  return data;
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

async function waitForUpdateReady(port) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    const status = await getJson(port, '/api/update/status');
    if (status.status === 'ready' || status.status === 'failed') {
      return status;
    }
    await delay(100);
  }
  throw new Error(`Update download timed out. Server output:\n${serverOutput}`);
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
