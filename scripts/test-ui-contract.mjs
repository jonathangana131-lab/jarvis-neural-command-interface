import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.ts'), 'utf8');

const requiredIds = [...main.matchAll(/required<[^>]+>\('#([^']+)'\)/g)].map((match) => match[1]);
const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const dynamicIds = [...main.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const declaredIds = new Set([...htmlIds, ...dynamicIds]);
const duplicateIds = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
const missingIds = requiredIds.filter((id) => !declaredIds.has(id));

assert(duplicateIds.length === 0, `Duplicate HTML ids: ${duplicateIds.join(', ')}`);
assert(missingIds.length === 0, `Required UI ids missing from index.html: ${missingIds.join(', ')}`);
assert(html.includes('id="command-menu"'), 'Global command menu is missing.');
assert(html.includes('id="system-clock"'), 'System clock telemetry is missing.');
assert(html.includes('class="neural-core-readout"'), 'Neural core readout is missing.');
assert(html.includes('id="mission-brief"'), 'Neural mission preflight is missing.');
assert(html.includes('id="task-mode-control"'), 'Three-depth execution control is missing.');
assert(html.includes('data-task-mode="quick"') && html.includes('data-task-mode="standard"') && html.includes('data-task-mode="deep"'), 'Quick, Standard, and Deep execution modes are required.');
assert(html.includes('id="mission-queue-drawer"'), 'Inspectable mission queue is missing.');
assert(main.includes('WorkspaceIntelligenceView'), 'Workspace Intelligence must be rendered through its focused view module.');
assert(main.includes('MissionPlannerController'), 'Mission planning must be owned by its focused controller module.');
assert(css.length < 80_000, `CSS bundle regressed to ${css.length} characters; keep the cascade intentional.`);
assert((css.match(/!important/g) ?? []).length <= 6, 'CSS returned to override-heavy !important rules.');
assert(!css.includes('fonts.googleapis.com'), 'The local desktop UI must not depend on hosted fonts.');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'Reduced-motion support is missing.');

console.log(`UI contract passed: ${requiredIds.length} required controls, ${htmlIds.length} unique ids, ${css.length} CSS characters.`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
