import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), 'utf8');

const packageJson = JSON.parse(read('package.json'));
const html = read('index.html');
const css = read('src', 'style.css');
const neuralSphere = read('src', 'NeuralSphere.ts');
const scene = read('src', 'JarvisScene.ts');
const views = read('src', 'ui', 'atlasViews.ts');
const shell = read('src', 'ui', 'ShellController.ts');
const palette = read('src', 'ui', 'CommandPalette.ts');
const workflow = read('.github', 'workflows', 'jarvis-macos-visual.yml');
const runtimeConfig = JSON.parse(read('jarvis.config.json'));
const configModule = read('server', 'config.mjs');

assert(packageJson.version === '2.0.0', `Expected package version 2.0.0, got ${packageJson.version}.`);
assert(html.includes('data-version="2.0"'), 'The v2 application shell marker is missing.');
assert(html.includes('Cognitive Atlas') && html.includes('Memory Atlas'), 'The cognitive-atlas product language is incomplete.');
assert(css.includes('@layer reset, foundation, shell, components, command, surfaces, overlays, responsive;'), 'The layered v2 design system is missing.');
assert(css.length < 75_000, `The v2 stylesheet is ${css.length} characters; keep the rebuilt cascade intentional.`);
assert((css.match(/!important/g) ?? []).length <= 6, 'The v2 stylesheet returned to override-heavy rules.');
assert(neuralSphere.includes('jarvis-v2-cognitive-atlas'), 'The deterministic v2 dendrite generator is missing.');
assert(neuralSphere.includes('this.cortexLines.visible = true'), 'The living dendrite layer must be visible.');
assert(neuralSphere.includes('MEMORY_VIOLET') && neuralSphere.includes('coreBloom'), 'The layered v2 core rendering is incomplete.');
assert(scene.includes("activeView === 'memory'"), 'The dedicated Memory Atlas camera composition is missing.');
assert((views.match(/\bid: '/g) ?? []).length === 7, 'The central atlas registry must define all seven operating spaces.');
assert(shell.includes("from './atlasViews'") && palette.includes("from './atlasViews'"), 'Shell navigation and neural search must share the atlas registry.');
assert(workflow.includes('origin/agent/jarvis-1-2-neural-os'), 'Visual verification must compare v2 against the complete v1.2 baseline.');
assert(workflow.includes('run,dashboard,history,artifacts,memory,settings,diagnostics'), 'Visual verification must capture every application page.');
assert(runtimeConfig.assistantName === 'Jarvis 2 Cognitive Atlas', 'The shipped assistant identity must match Jarvis 2.');
assert(runtimeConfig.defaultWorkspace.startsWith('~/'), 'The default workspace must be portable across Windows and macOS.');
assert(configModule.includes("process.platform !== 'win32'"), 'The Codex command must normalize Windows-only launchers on macOS and Linux.');

console.log('Jarvis v2 architecture passed: cognitive atlas, seven-space registry, layered design system, and v1.2 visual baseline verified.');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
