import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryExtractor } from '../server/memoryExtractor.mjs';
import { MemoryStore } from '../server/memoryStore.mjs';
import { TaskStore } from '../server/taskStore.mjs';
import {
  buildCodexExecArgs,
  buildPromptWithMemories,
  createCodexJsonOutputParser
} from '../server/codexTaskRunner.mjs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-memory-'));
const dbPath = path.join(tempDir, 'memory.sqlite');
const events = [];
const store = new MemoryStore(dbPath, { emit: (type, payload) => events.push({ type, payload }) });
const taskStore = new TaskStore(dbPath);
const extractor = new MemoryExtractor({ extractor: 'local-rules', minConfidence: 0.68 });

const preference = await extractor.extractFromText('Always use GPT-5.5 for Codex tasks in this app.', 'conversation');
assert.equal(preference.memories.length, 1, 'explicit preference should create one memory');
assert.equal(preference.memories[0].kind, 'constraint');

const ordinaryPrompt = await extractor.extractFromText('Fix the tests and update the interface.', 'conversation');
assert.equal(ordinaryPrompt.memories.length, 0, 'ordinary prompts should not become memories');

const taskOutcome = await extractor.extractFromTask({
  id: 'task-1',
  prompt: 'Update the interface',
  workspace: 'C:\\jarvis-neural-command-interface',
  status: 'completed',
  output: 'Implemented response HUD visibility, updated memory retrieval, and verified npm run build passed.',
  createdAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  exitCode: 0
});
assert.equal(taskOutcome.memories.length, 1, 'completed task output should create an outcome memory');
assert.equal(taskOutcome.memories[0].kind, 'task');

const inserted = store.create(preference.memories[0]);
const duplicate = store.create({ ...preference.memories[0], confidence: 0.9 });
assert.equal(inserted.id, duplicate.id, 'duplicate memories should merge into the existing row');
assert.equal(store.count(), 1, 'duplicate merge should not grow memory count');

store.create({
  kind: 'project',
  title: 'Memory storage',
  content: 'This repo uses SQLite for memory retrieval in C:\\jarvis-neural-command-interface.',
  importance: 4,
  confidence: 0.86,
  source: 'test',
  scope: 'project',
  workspace: 'C:\\jarvis-neural-command-interface'
});
const relevant = store.relevantFor({
  prompt: 'Improve SQLite memory retrieval in the Jarvis Neural Command Interface app.',
  workspace: 'C:\\jarvis-neural-command-interface',
  limit: 3
});
assert.ok(relevant.some((memory) => memory.title === 'Memory storage'), 'relevant memories should be selected for matching tasks');
const updatedMemory = store.update(inserted.id, {
  title: 'Preferred model',
  content: 'Always use GPT-5.5 for Codex tasks in this app.',
  pinned: true,
  scope: 'global'
});
assert.equal(updatedMemory.pinned, 1, 'memory pin state should update');
assert.equal(updatedMemory.scope, 'global', 'memory scope should update');
assert.ok(store.list({ query: 'preferred', scope: 'global' }).some((memory) => memory.id === inserted.id), 'memory search and scope filter should find updated memories');

const prompt = buildPromptWithMemories('Improve memory retrieval.', relevant);
assert.match(prompt, /Relevant remembered context:/);
assert.match(prompt, /Memory storage/);
assert.match(prompt, /Current request:\nImprove memory retrieval\./);

const codexArgs = buildCodexExecArgs({
  model: 'gpt-5.5',
  cwd: 'C:\\jarvis-neural-command-interface',
  outputMessagePath: 'C:\\jarvis-neural-command-interface\\data\\task-output\\task.txt'
});
assert.equal(codexArgs.includes('--full-auto'), false, 'Codex runner should not use deprecated --full-auto');
assert.deepEqual(
  codexArgs.slice(codexArgs.indexOf('--sandbox'), codexArgs.indexOf('--sandbox') + 2),
  ['--sandbox', 'workspace-write'],
  'Codex runner should request workspace-write sandboxing'
);
assert.ok(codexArgs.includes('--json'), 'Codex runner should parse structured JSON events');
assert.ok(codexArgs.includes("approval_policy='never'"), 'Codex exec should run non-interactively');

const parser = createCodexJsonOutputParser();
const parsed = parser.push('{"type":"thread.started"}\n{"type":"item.completed","item":{"type":"agent_message","text":"OK"}}\n');
assert.deepEqual(parsed, ['OK\n'], 'JSON parser should emit only assistant message text');
const noisy = parser.push('2026 WARN codex_core::plugins::startup_sync: startup remote plugin sync failed\n');
assert.deepEqual(noisy, [], 'JSON parser should suppress known Codex startup diagnostics');
const processCleanup = parser.push('SUCCESS: The process with PID 1234 has been terminated.\nERROR: The process "5678" not found.\n');
assert.deepEqual(processCleanup, [], 'JSON parser should suppress Windows process cleanup diagnostics');

const taskRecord = {
  id: 'task-persist-1',
  prompt: 'Remember that this app uses task history.',
  workspace: 'C:\\jarvis-neural-command-interface',
  status: 'running',
  phase: 'planning',
  output: '',
  logs: '{"type":"turn.started"}',
  createdAt: new Date().toISOString(),
  finishedAt: null,
  exitCode: null,
  rememberedMemoryIds: [inserted.id],
  createdMemoryIds: [],
  memorySkipped: []
};
taskStore.upsert(taskRecord);
taskStore.upsert({
  ...taskRecord,
  status: 'completed',
  phase: 'done',
  output: 'Implemented persistent task history and verified memory extraction records skipped reasons.',
  logs: 'npm run test:memory\nserver/taskStore.mjs',
  finishedAt: new Date().toISOString(),
  exitCode: 0,
  createdMemoryIds: [inserted.id],
  memorySkipped: []
});
const persistedTask = taskStore.get(taskRecord.id);
assert.equal(persistedTask.status, 'completed', 'finished task should be persisted');
assert.deepEqual(persistedTask.rememberedMemoryIds, [inserted.id], 'remembered memory IDs should round-trip');
assert.deepEqual(persistedTask.createdMemoryIds, [inserted.id], 'created memory IDs should round-trip');
assert.equal(persistedTask.phase, 'done', 'task phase should round-trip');
assert.match(persistedTask.logs, /test:memory/, 'task logs should round-trip');

const taskStoreAfterRestart = new TaskStore(dbPath);
assert.equal(taskStoreAfterRestart.get(taskRecord.id).status, 'completed', 'task history should survive store restart');
taskStoreAfterRestart.upsert({
  id: 'task-short-output',
  prompt: 'Reply briefly',
  workspace: 'C:\\jarvis-neural-command-interface',
  status: 'completed',
  phase: 'done',
  output: 'OK',
  logs: '',
  createdAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  exitCode: 0,
  rememberedMemoryIds: [],
  createdMemoryIds: [],
  memorySkipped: [{ reason: 'Task output was too short for a durable memory.', content: 'OK', confidence: 0.35 }]
});
assert.match(taskStoreAfterRestart.get('task-short-output').memorySkipped[0].reason, /too short/, 'skipped memory reason should be visible');
taskStoreAfterRestart.close();
taskStore.close();
store.close();
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('memory tests passed');
