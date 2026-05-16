import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CodexTaskRunner } from '../server/codexTaskRunner.mjs';
import { MemoryStore } from '../server/memoryStore.mjs';
import { TaskStore } from '../server/taskStore.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-stream-artifacts-'));
const workspace = path.join(root, 'workspace');
const dataDir = path.join(root, 'data');
fs.mkdirSync(workspace, { recursive: true });

const databasePath = path.join(dataDir, 'jarvis.sqlite');
const events = [];
let finishTask;
const finished = new Promise((resolve) => {
  finishTask = resolve;
});
const eventBus = {
  emit(type, payload) {
    events.push({ type, payload });
    if (type === 'task.finished') {
      finishTask(payload);
    }
  }
};

const memoryStore = new MemoryStore(databasePath, eventBus);
const taskStore = new TaskStore(databasePath);
const memoryExtractor = {
  async extractFromTask() {
    return { memories: [], skipped: [] };
  }
};

const config = {
  rootDir: root,
  dataDir,
  defaultWorkspace: workspace,
  workspaceAllowlist: [workspace],
  localModel: { provider: 'opencode', endpoint: 'https://mock.local/v1', model: 'mock-model' },
  codex: {
    maxTaskRuntimeMs: 5000,
    blockedPhrases: [],
    command: 'codex',
    model: 'mock-model',
    reasoningEffort: 'low',
    ephemeral: true
  }
};

process.env.OPENCODE_API_KEY = 'test-key';
globalThis.fetch = async () => {
  const chunks = [
    'data: {"choices":[{"delta":{"content":"<<FILE:index.html>>\\n<!doctype html><html><body>"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"Streamed artifact</body></html>\\n<<END_FILE>>\\n"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"Built and verified streamed artifact."}}]}\n\n',
    'data: [DONE]\n\n'
  ];
  return new Response(new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' }
  });
};

const runner = new CodexTaskRunner(config, eventBus, memoryStore, memoryExtractor, taskStore);
const queued = runner.start({ prompt: 'make a streamed html artifact', workspace });
assert.equal(queued.status, 'queued');

const task = await Promise.race([
  finished,
  new Promise((_, reject) => setTimeout(() => reject(new Error('task did not finish')), 7000))
]);

assert.equal(task.status, 'completed');
assert.equal(task.phase, 'done');
assert.equal(task.filesChanged.length, 1);
assert.ok(task.filesChanged[0].endsWith('index.html'));
assert.ok(fs.existsSync(path.resolve(workspace, task.filesChanged[0])));
assert.ok(task.createdMemoryIds.length >= 2);
assert.ok(events.filter((event) => event.type === 'task.output' && event.payload?.phase === 'streaming').length >= 2);
assert.ok(events.some((event) => event.type === 'memory.created'));

memoryStore.close();
taskStore.close();
fs.rmSync(root, { recursive: true, force: true });
console.log('streaming artifact tests passed');
