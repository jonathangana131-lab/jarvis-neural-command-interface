import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeWorkspace } from '../server/workspaceIntelligence.mjs';

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-intelligence-'));

try {
  fs.mkdirSync(path.join(workspace, 'src'), { recursive: true });
  fs.mkdirSync(path.join(workspace, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(workspace, 'node_modules', 'ignored'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({
    name: 'neural-fixture',
    description: 'A workspace intelligence fixture.',
    scripts: { build: 'vite build', test: 'node --test', dev: 'vite' },
    dependencies: { electron: '^42.0.0', express: '^5.0.0', three: '^0.176.0' },
    devDependencies: { typescript: '^5.8.0', vite: '^6.0.0' }
  }, null, 2));
  fs.writeFileSync(path.join(workspace, 'README.md'), '# Neural Fixture\n');
  fs.writeFileSync(path.join(workspace, 'tsconfig.json'), '{}\n');
  fs.writeFileSync(path.join(workspace, 'src', 'main.ts'), 'export const boot = true; // TODO: connect core\n');
  fs.writeFileSync(path.join(workspace, 'src', 'scene.ts'), 'export const scene = "neural"; // FIXME: tune glow\n');
  fs.writeFileSync(path.join(workspace, 'tests', 'scene.test.ts'), 'export const verified = true;\n');
  fs.writeFileSync(path.join(workspace, 'node_modules', 'ignored', 'huge.ts'), '// TODO should never be scanned\n');

  const report = analyzeWorkspace(workspace);
  assert.equal(report.status, 'ready');
  assert.equal(report.identity.name, 'Neural Fixture');
  assert.equal(report.identity.kind, 'Desktop application');
  assert.equal(report.metrics.testFiles, 1);
  assert.equal(report.metrics.todoCount, 2);
  assert.equal(report.scan.truncated, false);
  assert.ok(report.score >= 80, `Expected strong fixture readiness, received ${report.score}`);
  assert.ok(report.languages.some((language) => language.name === 'TypeScript' && language.files === 3));
  assert.ok(report.stack.some((entry) => entry.name === 'Electron'));
  assert.ok(report.stack.some((entry) => entry.name === 'Three.js'));
  assert.ok(report.scripts.some((script) => script.command === 'npm run test'));
  assert.ok(!report.recentFiles.some((file) => file.path.includes('node_modules')));

  const missing = analyzeWorkspace(path.join(workspace, 'missing'));
  assert.equal(missing.status, 'missing');
  assert.equal(missing.score, 0);

  console.log(`Workspace intelligence passed: ${report.metrics.files} files, ${report.stack.length} stack signals, ${report.score}% readiness.`);
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}
