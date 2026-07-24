import assert from 'node:assert/strict';
import { createMissionBrief, normalizeTaskMode, taskModeInstructions } from '../server/missionPlanner.mjs';
import { taskModeReasoningEffort } from '../server/codexTaskRunner.mjs';

const intelligence = {
  status: 'ready',
  score: 92,
  identity: { name: 'Jarvis', kind: 'Desktop application' },
  metrics: { files: 418, testFiles: 16, dirtyFiles: 0 },
  languages: [{ name: 'TypeScript', files: 42, percent: 68 }],
  stack: [{ name: 'Electron' }, { name: 'TypeScript' }, { name: 'Vite' }],
  scripts: [{ name: 'build', command: 'npm run build' }, { name: 'test', command: 'npm run test' }],
  git: { available: true, branch: 'agent/jarvis-1-2-neural-os', dirty: false }
};

const deep = createMissionBrief({
  prompt: 'Fully rewrite the entire command architecture, test every subsystem, and publish the giant production release.',
  workspaceIntelligence: intelligence,
  mode: 'deep'
});
assert.equal(deep.selectedMode, 'deep');
assert.equal(deep.recommendedMode, 'deep');
assert.equal(deep.intent.kind, 'transform');
assert.equal(deep.complexity.level, 'high');
assert.ok(deep.phases.some((phase) => phase.id === 'integrate'));
assert.ok(deep.phases.some((phase) => phase.id === 'verify'));
assert.ok(deep.guardrails.some((guardrail) => /durable architecture/i.test(guardrail)));
assert.ok(deep.workspaceSignals.some((signal) => signal.value === '92%'));

const quick = createMissionBrief({
  prompt: 'Fix the typo in the settings heading.',
  workspaceIntelligence: intelligence,
  mode: 'quick'
});
assert.equal(quick.selectedMode, 'quick');
assert.ok(quick.phases.length <= 3);
assert.match(taskModeInstructions('quick'), /smallest safe change/i);
assert.match(taskModeInstructions('deep'), /architecture/i);
assert.equal(taskModeReasoningEffort('quick', 'medium'), 'low');
assert.equal(taskModeReasoningEffort('standard', 'medium'), 'medium');
assert.equal(taskModeReasoningEffort('deep', 'medium'), 'high');
assert.equal(normalizeTaskMode('unexpected'), 'standard');

console.log(`Mission planner passed: ${deep.phases.length} deep phases, ${deep.complexity.score}/100 complexity.`);
