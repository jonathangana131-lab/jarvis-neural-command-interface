import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-voice-settings-'));
const workspace = path.join(tempRoot, 'workspace');
const dataDir = path.join(tempRoot, 'data');
const configPath = path.join(tempRoot, 'jarvis.config.json');
fs.mkdirSync(workspace, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'session-state.json'), JSON.stringify({
  active: true,
  cleanExit: false,
  startedAt: '2026-01-01T00:00:00.000Z',
  pid: 12345
}, null, 2));

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
    endpoint: 'http://127.0.0.1:65530/v1',
    model: 'mock-model'
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

const appPort = await freePort();
const server = spawn(process.execPath, ['--experimental-sqlite', 'server/index.mjs'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: {
    ...process.env,
    PORT: String(appPort),
    JARVIS_CONFIG: configPath,
    JARVIS_DATA_DIR: dataDir,
    JARVIS_SECRET_DIR: dataDir,
    OPENCODE_API_KEY: '',
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

  const defaults = await getJson(appPort, '/api/voice-settings');
  assert.equal(defaults.voiceEnabled, true);
  assert.equal(defaults.spokenResponses, true);
  assert.equal(defaults.selectedVoiceName, '');
  assert.equal(defaults.autoSendAfterFinalTranscript, true);
  assert.equal(defaults.summaryMaxLength, 180);

  const saved = await postJson(appPort, '/api/voice-settings', {
    voiceEnabled: false,
    spokenResponses: false,
    selectedVoiceName: 'Windows Test Voice',
    autoSendAfterFinalTranscript: false,
    summaryMaxLength: 999
  });
  assert.deepEqual(saved, {
    voiceEnabled: false,
    spokenResponses: false,
    selectedVoiceName: 'Windows Test Voice',
    autoSendAfterFinalTranscript: false,
    summaryMaxLength: 420
  });

  const persisted = JSON.parse(fs.readFileSync(path.join(dataDir, 'voice-settings.json'), 'utf8'));
  assert.equal(persisted.selectedVoiceName, 'Windows Test Voice');
  assert.equal(persisted.summaryMaxLength, 420);

  const session = await getJson(appPort, '/api/session');
  assert.equal(session.previousCrashed, true);
  assert.equal(session.previous.active, true);
  assert.equal(session.previous.cleanExit, false);

  const acknowledged = await postJson(appPort, '/api/session/acknowledge-crash', {});
  assert.equal(acknowledged.previousCrashed, false);

  const diagnostics = await getJson(appPort, '/api/diagnostics');
  assert.equal(diagnostics.voice.settings.selectedVoiceName, 'Windows Test Voice');
  assert.equal(diagnostics.session.previousCrashAcknowledged, true);

  console.log('voice settings and recovery tests passed');
} finally {
  await stopChild(server);
  removeTempRoot(tempRoot);
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

async function waitFor(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${url}. Server output:\n${serverOutput}`);
}

async function freePort() {
  const net = await import('node:net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function stopChild(child) {
  if (child.exitCode !== null) {
    return;
  }
  child.kill();
  await new Promise((resolve) => child.once('exit', resolve));
}

function removeTempRoot(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Unable to remove temporary voice settings directory ${target}: ${error.message}`);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
