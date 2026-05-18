import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const exePath = path.resolve(process.argv[2] ?? 'release/win-unpacked/Jarvis Neural Command Interface.exe');
if (!fs.existsSync(exePath)) {
  throw new Error(`Packaged app executable not found: ${exePath}`);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-ui-smoke-'));
const appData = path.join(tempRoot, 'roaming');
const userData = path.join(tempRoot, 'user-data');
fs.mkdirSync(appData, { recursive: true });
fs.mkdirSync(userData, { recursive: true });

const mockServer = http.createServer(async (req, res) => {
  mockRequests.push(`${req.method} ${req.url}`);
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
    for (const chunk of ['Jarvis ', 'setup ', 'test ', 'complete.']) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      await delay(35);
    }
    res.end('data: [DONE]\n\n');
    return;
  }
  res.writeHead(404);
  res.end('not found');
});
const mockRequests = [];
mockServer.on('close', () => {
  mockRequests.push('SERVER close');
});
mockServer.on('error', (error) => {
  mockRequests.push(`SERVER error ${error.message}`);
});

const mockPort = await listenInRange(mockServer, 43100, 43999);
const appPort = await freePort();
const debugPort = await freePort();
const appProcess = spawn(exePath, [`--remote-debugging-port=${debugPort}`], {
  env: {
    ...process.env,
    APPDATA: appData,
    JARVIS_USER_DATA_DIR: userData,
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

let client;
try {
  await waitForJson(`http://127.0.0.1:${appPort}/api/config`, 45000);
  const directModels = await waitForJson(`http://127.0.0.1:${mockPort}/v1/models`, 3000);
  if (!directModels.data?.some((model) => model.id === 'mock-stream-model')) {
    throw new Error(`Mock model server did not return expected model: ${JSON.stringify(directModels)}`);
  }
  const backendScan = await waitForJson(`http://127.0.0.1:${appPort}/api/local-models?provider=opencode&endpoint=${encodeURIComponent(`http://127.0.0.1:${mockPort}/v1`)}`, 8000);
  if (!backendScan.models?.includes('mock-stream-model')) {
    throw new Error(`Packaged backend could not scan mock model endpoint: ${JSON.stringify(backendScan)}. Mock requests: ${JSON.stringify(mockRequests)}`);
  }
  client = await connectToRenderer(debugPort);
  await client.call('Runtime.enable');
  await waitForUi(client, '!document.querySelector("#setup-wizard")?.classList.contains("hidden")', 30000);
  await client.evaluate(`(() => {
    const provider = document.querySelector('#setup-provider');
    const endpoint = document.querySelector('#setup-endpoint');
    const apiKey = document.querySelector('#setup-api-key');
    provider.value = 'opencode';
    provider.dispatchEvent(new Event('change', { bubbles: true }));
    endpoint.value = 'http://127.0.0.1:${mockPort}/v1';
    endpoint.dispatchEvent(new Event('input', { bubbles: true }));
    endpoint.dispatchEvent(new Event('change', { bubbles: true }));
    apiKey.value = 'mock-key';
    apiKey.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  const setupValues = await client.evaluate(`(() => ({
    provider: document.querySelector('#setup-provider')?.value,
    endpoint: document.querySelector('#setup-endpoint')?.value,
    apiKeyLength: document.querySelector('#setup-api-key')?.value?.length ?? 0
  }))()`);
  if (setupValues.provider !== 'opencode' || setupValues.endpoint !== `http://127.0.0.1:${mockPort}/v1` || setupValues.apiKeyLength === 0) {
    throw new Error(`Setup form values were not applied: ${JSON.stringify(setupValues)}`);
  }
  const rendererScan = await client.evaluate(`fetch('/api/local-models?' + new URLSearchParams({ provider: 'opencode', endpoint: 'http://127.0.0.1:${mockPort}/v1' })).then((response) => response.json())`);
  if (!rendererScan.models?.includes('mock-stream-model')) {
    throw new Error(`Renderer could not scan mock model endpoint: ${JSON.stringify(rendererScan)}. Mock requests: ${JSON.stringify(mockRequests)}`);
  }
  await client.evaluate(`(() => {
    const endpoint = document.querySelector('#setup-endpoint');
    const model = document.querySelector('#setup-model');
    endpoint.value = 'http://127.0.0.1:${mockPort}/v1';
    endpoint.dispatchEvent(new Event('input', { bubbles: true }));
    endpoint.dispatchEvent(new Event('change', { bubbles: true }));
    model.innerHTML = '<option value="mock-stream-model">mock-stream-model</option>';
    model.value = 'mock-stream-model';
  })()`);
  const finalSetupValues = await client.evaluate(`(() => ({
    endpoint: document.querySelector('#setup-endpoint')?.value,
    model: document.querySelector('#setup-model')?.value
  }))()`);
  if (finalSetupValues.endpoint !== `http://127.0.0.1:${mockPort}/v1` || finalSetupValues.model !== 'mock-stream-model') {
    throw new Error(`Final setup form values were not applied: ${JSON.stringify(finalSetupValues)}`);
  }
  const preClickMockPing = await waitForJson(`http://127.0.0.1:${mockPort}/v1/models`, 3000);
  if (!preClickMockPing.data?.some((model) => model.id === 'mock-stream-model')) {
    throw new Error(`Mock model server disappeared before setup test: ${JSON.stringify(preClickMockPing)}`);
  }
  await client.evaluate('document.querySelector("#setup-test").click()');
  try {
    await waitForUi(client, 'document.querySelector("#setup-wizard")?.classList.contains("hidden")', 60000);
  } catch (error) {
    const state = await client.evaluate(`(() => ({
      status: document.querySelector('#setup-status')?.textContent ?? '',
      model: document.querySelector('#setup-model')?.value ?? '',
      feed: document.querySelector('#command-chat-feed')?.textContent ?? ''
    }))()`);
    const backendState = await waitForJson(`http://127.0.0.1:${appPort}/api/config`, 3000).catch((stateError) => ({ error: stateError.message }));
    const tasks = await waitForJson(`http://127.0.0.1:${appPort}/api/tasks`, 3000).catch((taskError) => ({ error: taskError.message }));
    const logs = await waitForJson(`http://127.0.0.1:${appPort}/api/logs`, 3000).catch((logError) => ({ error: logError.message }));
    const postFailMockPing = await waitForJson(`http://127.0.0.1:${mockPort}/v1/models`, 3000).catch((pingError) => ({ error: pingError.message }));
    throw new Error(`${error.message}\nUI state: ${JSON.stringify(state)}\nConfig: ${JSON.stringify(backendState)}\nTasks: ${JSON.stringify(tasks)}\nLogs: ${JSON.stringify(logs)}\nPost-failure mock ping: ${JSON.stringify(postFailMockPing)}\nMock requests: ${JSON.stringify(mockRequests)}`);
  }
  const transcript = await client.evaluate('document.querySelector("#command-chat-feed")?.textContent ?? ""');
  if (!String(transcript).includes('Jarvis setup test complete.')) {
    throw new Error(`UI did not show streamed setup response. Transcript:\n${transcript}`);
  }
  await client.evaluate(`(() => {
    document.querySelector('[data-console-tab="settings"]').click();
    const enabled = document.querySelector('#settings-voice-enabled');
    const spoken = document.querySelector('#settings-spoken-responses');
    const autoSend = document.querySelector('#settings-voice-auto-send');
    const summary = document.querySelector('#settings-voice-summary-length');
    if (!enabled || !spoken || !autoSend || !summary) {
      throw new Error('Voice settings controls did not render.');
    }
    enabled.checked = true;
    spoken.checked = false;
    autoSend.checked = false;
    summary.value = '160';
    document.querySelector('#save-voice-settings').click();
  })()`);
  await waitForUi(client, 'document.querySelector("#voice-settings-message")?.textContent?.includes("saved")', 8000);
  const voiceSettings = await waitForJson(`http://127.0.0.1:${appPort}/api/voice-settings`, 3000);
  if (voiceSettings.spokenResponses !== false || voiceSettings.autoSendAfterFinalTranscript !== false || voiceSettings.summaryMaxLength !== 160) {
    throw new Error(`Voice settings did not persist from renderer: ${JSON.stringify(voiceSettings)}`);
  }
  console.log('installed UI smoke passed');
} finally {
  client?.close();
  await stopChild(appProcess);
  await closeServer(mockServer);
  removeTempRoot(tempRoot);
}

async function connectToRenderer(port) {
  const startedAt = Date.now();
  let lastTargets = '';
  while (Date.now() - startedAt < 60000) {
    let pages;
    try {
      pages = await waitForJson(`http://127.0.0.1:${port}/json/list`, 1000);
    } catch {
      await delay(250);
      continue;
    }
    const list = Array.isArray(pages) ? pages : pages.value ?? [];
    lastTargets = JSON.stringify(list);
    const page = list.find((entry) => entry.webSocketDebuggerUrl && entry.url?.startsWith(`http://127.0.0.1:${appPort}`))
      ?? list.find((entry) => entry.webSocketDebuggerUrl);
    if (page) {
      return createCdpClient(page.webSocketDebuggerUrl);
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for renderer debugger. Last targets: ${lastTargets}. App output:\n${output}`);
}

function createCdpClient(url) {
  const ws = new WebSocket(url);
  let nextId = 1;
  const pendingMessages = new Map();

  ws.on('message', (message) => {
      const data = JSON.parse(message.toString());
      if (!data.id) return;
      const pending = pendingMessages.get(data.id);
      if (!pending) return;
      pendingMessages.delete(data.id);
      if (data.error) {
        pending.reject(new Error(data.error.message));
      } else {
        pending.resolve(data.result);
      }
    });

  const call = (method, params = {}) => new Promise((resolve, reject) => {
      const send = () => {
        const id = nextId++;
        pendingMessages.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      };
      if (ws.readyState === WebSocket.OPEN) {
        send();
      } else {
        ws.once('open', send);
        ws.once('error', reject);
      }
    });

  return {
    call,
    async evaluate(expression) {
      const result = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text ?? 'Evaluation failed.');
      }
      return result.result?.value;
    },
    close() {
      ws.close();
    }
  };
}

async function waitForUi(client, expression, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await client.evaluate(expression)) {
      return;
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for UI expression: ${expression}. App output:\n${output}`);
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
      await delay(150);
    }
  }
  throw new Error(`Timed out waiting for ${url}. App output:\n${output}`);
}

function listen(serverInstance) {
  return new Promise((resolve) => {
    serverInstance.listen(0, '127.0.0.1', () => resolve(serverInstance.address().port));
  });
}

function listenInRange(serverInstance, start, end) {
  return new Promise((resolve, reject) => {
    let port = start;
    const tryListen = () => {
      const onError = (error) => {
        serverInstance.off('listening', onListening);
        if (error.code === 'EADDRINUSE' && port < end) {
          port += 1;
          tryListen();
          return;
        }
        reject(error);
      };
      const onListening = () => {
        serverInstance.off('error', onError);
        resolve(serverInstance.address().port);
      };
      serverInstance.once('error', onError);
      serverInstance.once('listening', onListening);
      serverInstance.listen(port, '127.0.0.1');
    };
    tryListen();
  });
}

function closeServer(serverInstance) {
  return new Promise((resolve) => serverInstance.close(() => resolve()));
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
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  } catch (error) {
    console.warn(`Unable to remove temporary UI smoke directory ${target}: ${error.message}`);
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
