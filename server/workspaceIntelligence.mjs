import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EXCLUDED_DIRECTORIES = new Set([
  '.git', '.hg', '.svn', '.idea', '.vscode',
  'node_modules', 'dist', 'build', 'release', 'coverage',
  '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache',
  'Pods', 'DerivedData', 'vendor', 'target', '__pycache__'
]);

const LANGUAGE_BY_EXTENSION = new Map(Object.entries({
  '.ts': ['TypeScript', '#66c7ff'],
  '.tsx': ['TypeScript', '#66c7ff'],
  '.js': ['JavaScript', '#f7df72'],
  '.jsx': ['JavaScript', '#f7df72'],
  '.mjs': ['JavaScript', '#f7df72'],
  '.cjs': ['JavaScript', '#f7df72'],
  '.swift': ['Swift', '#ff8a5b'],
  '.py': ['Python', '#76b7ff'],
  '.rs': ['Rust', '#e7a36a'],
  '.go': ['Go', '#66d9e8'],
  '.java': ['Java', '#e69063'],
  '.kt': ['Kotlin', '#b28dff'],
  '.kts': ['Kotlin', '#b28dff'],
  '.cs': ['C#', '#9bd36a'],
  '.cpp': ['C++', '#8ca9ff'],
  '.cc': ['C++', '#8ca9ff'],
  '.c': ['C', '#a7b5c6'],
  '.h': ['C/C++ Header', '#a7b5c6'],
  '.html': ['HTML', '#ff8a72'],
  '.css': ['CSS', '#bc8cff'],
  '.scss': ['SCSS', '#ef83ba'],
  '.vue': ['Vue', '#68d391'],
  '.svelte': ['Svelte', '#ff6b4a'],
  '.rb': ['Ruby', '#ff7a7a'],
  '.php': ['PHP', '#9ba4ea'],
  '.sh': ['Shell', '#8fd18a'],
  '.ps1': ['PowerShell', '#6eb4ff'],
  '.sql': ['SQL', '#8cc6d7'],
  '.md': ['Markdown', '#aebdd0'],
  '.json': ['JSON', '#c9d66b'],
  '.yml': ['YAML', '#ff9cae'],
  '.yaml': ['YAML', '#ff9cae']
}));

const CONTENT_EXTENSIONS = new Set([
  ...LANGUAGE_BY_EXTENSION.keys(), '.txt', '.toml', '.xml', '.gradle'
]);

const TEST_PATTERN = /(^|\/)(test|tests|spec|specs|__tests__)(\/|$)|\.(test|spec)\.[^.]+$/i;

export function analyzeWorkspace(workspacePath, options = {}) {
  const startedAt = Date.now();
  const workspace = path.resolve(workspacePath);
  const limits = {
    maxFiles: positiveInteger(options.maxFiles, 3500),
    maxDepth: positiveInteger(options.maxDepth, 14),
    maxContentFiles: positiveInteger(options.maxContentFiles, 900),
    maxContentBytes: positiveInteger(options.maxContentBytes, 320_000)
  };

  if (!fs.existsSync(workspace)) {
    return missingWorkspaceReport(workspace, startedAt, 'Workspace does not exist on this device.');
  }
  if (!fs.statSync(workspace).isDirectory()) {
    return missingWorkspaceReport(workspace, startedAt, 'Workspace path is not a directory.');
  }

  const files = [];
  const languageCounts = new Map();
  const rootEntries = new Set();
  const queue = [{ absolute: workspace, depth: 0 }];
  let directoryCount = 0;
  let totalBytes = 0;
  let sourceFiles = 0;
  let testFiles = 0;
  let todoCount = 0;
  let contentFilesRead = 0;
  let truncated = false;

  while (queue.length > 0) {
    const current = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(current.absolute, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (files.length >= limits.maxFiles) {
        truncated = true;
        queue.length = 0;
        break;
      }
      if (current.depth === 0) rootEntries.add(entry.name);
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(current.absolute, entry.name);
      const relative = toPosix(path.relative(workspace, absolute));

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name) || entry.name.startsWith('.jarvis-')) continue;
        directoryCount += 1;
        if (current.depth < limits.maxDepth) {
          queue.push({ absolute, depth: current.depth + 1 });
        } else {
          truncated = true;
        }
        continue;
      }
      if (!entry.isFile()) continue;

      let stat;
      try {
        stat = fs.statSync(absolute);
      } catch {
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      const language = LANGUAGE_BY_EXTENSION.get(extension);
      totalBytes += stat.size;
      if (language) {
        sourceFiles += 1;
        const existing = languageCounts.get(language[0]) ?? { name: language[0], color: language[1], files: 0 };
        existing.files += 1;
        languageCounts.set(language[0], existing);
      }
      if (TEST_PATTERN.test(relative)) testFiles += 1;

      if (
        contentFilesRead < limits.maxContentFiles
        && stat.size <= limits.maxContentBytes
        && CONTENT_EXTENSIONS.has(extension)
      ) {
        try {
          const content = fs.readFileSync(absolute, 'utf8');
          todoCount += (content.match(/\b(?:TODO|FIXME|HACK|XXX)\b/gi) ?? []).length;
          contentFilesRead += 1;
        } catch {
          // Binary or locked files are intentionally skipped.
        }
      }

      files.push({
        path: relative,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        language: language?.[0] ?? null
      });
    }
  }

  const packageManifest = readJson(path.join(workspace, 'package.json'));
  const identity = projectIdentity(workspace, packageManifest, rootEntries);
  const stack = detectStack(packageManifest, rootEntries, files);
  const scripts = detectScripts(packageManifest, rootEntries);
  const git = inspectGit(workspace);
  const languages = [...languageCounts.values()]
    .sort((a, b) => b.files - a.files)
    .map((language) => ({
      ...language,
      percent: sourceFiles > 0 ? Math.round((language.files / sourceFiles) * 1000) / 10 : 0
    }));
  const recentFiles = files
    .filter((file) => !/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i.test(file.path))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
  const metrics = {
    files: files.length,
    directories: directoryCount,
    totalBytes,
    sourceFiles,
    testFiles,
    todoCount,
    dirtyFiles: git.changed + git.staged + git.untracked
  };
  const score = readinessScore({ rootEntries, metrics, git, scripts, truncated });
  const signals = buildSignals({ rootEntries, metrics, git, scripts, truncated, score });

  return {
    status: 'ready',
    generatedAt: new Date().toISOString(),
    workspace,
    identity,
    score,
    metrics,
    languages,
    stack,
    scripts,
    git,
    recentFiles,
    signals,
    scan: {
      truncated,
      durationMs: Date.now() - startedAt,
      filesInspected: files.length,
      contentFilesRead,
      excludedDirectories: [...EXCLUDED_DIRECTORIES]
    }
  };
}

function projectIdentity(workspace, manifest, rootEntries) {
  const folderName = path.basename(workspace) || workspace;
  const name = String(manifest?.productName ?? manifest?.name ?? folderName)
    .replace(/^@[^/]+\//, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const kind = rootEntries.has('Package.swift') || rootEntries.has('project.yml')
    ? 'Apple platform project'
    : rootEntries.has('package.json')
      ? manifest?.main || dependencyNames(manifest).has('electron') ? 'Desktop application' : 'Web application'
      : rootEntries.has('Cargo.toml')
        ? 'Rust project'
        : rootEntries.has('pyproject.toml') || rootEntries.has('requirements.txt')
          ? 'Python project'
          : 'Software workspace';
  return {
    name,
    kind,
    description: String(manifest?.description ?? '').trim() || `${kind} in ${folderName}`
  };
}

function detectStack(manifest, rootEntries, files) {
  const dependencies = dependencyNames(manifest);
  const found = [];
  const add = (name, kind, confidence, source) => {
    if (!found.some((entry) => entry.name === name)) found.push({ name, kind, confidence, source });
  };

  if (rootEntries.has('package.json')) add('Node.js', 'runtime', 'high', 'package.json');
  if (dependencies.has('typescript') || rootEntries.has('tsconfig.json')) add('TypeScript', 'language', 'high', 'tsconfig.json');
  if (dependencies.has('electron')) add('Electron', 'platform', 'high', 'package.json');
  if (dependencies.has('vite')) add('Vite', 'build', 'high', 'package.json');
  if (dependencies.has('react')) add('React', 'framework', 'high', 'package.json');
  if (dependencies.has('vue')) add('Vue', 'framework', 'high', 'package.json');
  if (dependencies.has('svelte')) add('Svelte', 'framework', 'high', 'package.json');
  if (dependencies.has('express')) add('Express', 'backend', 'high', 'package.json');
  if (dependencies.has('three')) add('Three.js', 'graphics', 'high', 'package.json');
  if (dependencies.has('tailwindcss')) add('Tailwind CSS', 'design', 'high', 'package.json');
  if (rootEntries.has('Package.swift') || files.some((file) => file.path.endsWith('.xcodeproj/project.pbxproj'))) add('Swift / Xcode', 'platform', 'high', 'project files');
  if (files.some((file) => /(?:App|View|Scene)\.swift$/i.test(file.path))) add('SwiftUI', 'framework', 'medium', 'Swift source layout');
  if (rootEntries.has('pyproject.toml') || rootEntries.has('requirements.txt')) add('Python', 'runtime', 'high', 'Python manifest');
  if (rootEntries.has('Cargo.toml')) add('Rust', 'runtime', 'high', 'Cargo.toml');
  if (rootEntries.has('go.mod')) add('Go', 'runtime', 'high', 'go.mod');
  if (rootEntries.has('Dockerfile') || rootEntries.has('docker-compose.yml') || rootEntries.has('compose.yml')) add('Docker', 'infrastructure', 'high', 'Docker configuration');
  if (rootEntries.has('.github')) add('GitHub Actions', 'automation', 'medium', '.github');
  return found.slice(0, 12);
}

function detectScripts(manifest, rootEntries) {
  const scripts = [];
  if (manifest?.scripts && typeof manifest.scripts === 'object') {
    const priority = ['dev', 'start', 'build', 'test', 'lint', 'check', 'typecheck', 'preview', 'package:mac', 'package:win'];
    const names = Object.keys(manifest.scripts);
    const ordered = [...priority.filter((name) => names.includes(name)), ...names.filter((name) => !priority.includes(name))];
    for (const name of ordered.slice(0, 10)) {
      scripts.push({ name, command: `npm run ${name}`, source: 'package.json' });
    }
  }
  if (rootEntries.has('Package.swift')) scripts.push({ name: 'test', command: 'swift test', source: 'Package.swift' });
  if (rootEntries.has('Cargo.toml')) scripts.push({ name: 'test', command: 'cargo test', source: 'Cargo.toml' });
  if (rootEntries.has('pyproject.toml')) scripts.push({ name: 'test', command: 'pytest', source: 'pyproject.toml' });
  if (rootEntries.has('go.mod')) scripts.push({ name: 'test', command: 'go test ./...', source: 'go.mod' });
  return scripts.slice(0, 10);
}

function inspectGit(workspace) {
  const empty = {
    available: false,
    branch: null,
    dirty: false,
    changed: 0,
    staged: 0,
    untracked: 0,
    ahead: 0,
    behind: 0,
    lastCommit: null
  };
  const status = spawnSync('git', ['-C', workspace, 'status', '--porcelain=v1', '--branch'], {
    encoding: 'utf8',
    timeout: 2500,
    windowsHide: true
  });
  if (status.status !== 0 || status.error) return empty;
  const lines = String(status.stdout ?? '').trimEnd().split(/\r?\n/).filter(Boolean);
  const header = lines[0]?.startsWith('## ') ? lines.shift().slice(3) : '';
  const branch = header.split('...')[0].split(' ')[0] || 'detached';
  const ahead = Number(header.match(/ahead (\d+)/)?.[1] ?? 0);
  const behind = Number(header.match(/behind (\d+)/)?.[1] ?? 0);
  let changed = 0;
  let staged = 0;
  let untracked = 0;
  for (const line of lines) {
    const code = line.slice(0, 2);
    if (code === '??') {
      untracked += 1;
      continue;
    }
    if (code[0] && code[0] !== ' ') staged += 1;
    if (code[1] && code[1] !== ' ') changed += 1;
  }
  const commit = spawnSync('git', ['-C', workspace, 'log', '-1', '--format=%h%x09%s%x09%cI'], {
    encoding: 'utf8', timeout: 2500, windowsHide: true
  });
  const [hash, subject, committedAt] = commit.status === 0 ? String(commit.stdout ?? '').trim().split('\t') : [];
  return {
    available: true,
    branch,
    dirty: lines.length > 0,
    changed,
    staged,
    untracked,
    ahead,
    behind,
    lastCommit: hash ? { hash, subject: subject ?? '', committedAt: committedAt ?? null } : null
  };
}

function readinessScore({ rootEntries, metrics, git, scripts, truncated }) {
  let score = 100;
  if (![...rootEntries].some((entry) => /^readme(\.|$)/i.test(entry))) score -= 8;
  if (metrics.testFiles === 0 && !scripts.some((script) => /^test(?::|$)/.test(script.name))) score -= 13;
  if (metrics.todoCount > 0) score -= Math.min(10, Math.ceil(metrics.todoCount / 4));
  if (git.dirty && metrics.dirtyFiles > 15) score -= 7;
  if (git.behind > 0) score -= Math.min(7, git.behind);
  if (truncated) score -= 4;
  if (metrics.files === 0) score -= 35;
  return Math.max(0, Math.min(100, score));
}

function buildSignals({ rootEntries, metrics, git, scripts, truncated, score }) {
  const signals = [];
  const hasReadme = [...rootEntries].some((entry) => /^readme(\.|$)/i.test(entry));
  signals.push({
    level: hasReadme ? 'good' : 'watch',
    title: hasReadme ? 'Project context documented' : 'Project context is thin',
    detail: hasReadme ? 'A root README gives Jarvis a reliable orientation point.' : 'Add a root README so operators and agents share the same project map.'
  });
  signals.push({
    level: metrics.testFiles > 0 || scripts.some((script) => /^test(?::|$)/.test(script.name)) ? 'good' : 'risk',
    title: metrics.testFiles > 0 ? `${metrics.testFiles} test files detected` : 'No obvious test surface',
    detail: metrics.testFiles > 0 ? 'Mission plans can include targeted verification.' : 'Deep changes should establish a repeatable verification command first.'
  });
  if (git.available) {
    signals.push({
      level: metrics.dirtyFiles === 0 ? 'good' : metrics.dirtyFiles > 15 ? 'watch' : 'good',
      title: metrics.dirtyFiles === 0 ? 'Git worktree is clean' : `${metrics.dirtyFiles} local Git changes`,
      detail: metrics.dirtyFiles === 0 ? `Branch ${git.branch} is ready for a focused mission.` : 'Jarvis will preserve existing work and isolate unrelated edits.'
    });
  }
  if (metrics.todoCount > 0) {
    signals.push({ level: metrics.todoCount > 20 ? 'watch' : 'good', title: `${metrics.todoCount} code markers`, detail: 'TODO, FIXME, HACK, and XXX markers are visible to mission planning.' });
  }
  if (truncated) signals.push({ level: 'watch', title: 'Scan limit reached', detail: 'The project map is representative but not exhaustive.' });
  signals.push({ level: score >= 85 ? 'good' : score >= 65 ? 'watch' : 'risk', title: `${score}% mission readiness`, detail: score >= 85 ? 'The workspace has strong execution signals.' : 'Review warnings before a deep autonomous run.' });
  return signals.slice(0, 6);
}

function missingWorkspaceReport(workspace, startedAt, detail) {
  return {
    status: 'missing',
    generatedAt: new Date().toISOString(),
    workspace,
    identity: { name: path.basename(workspace) || workspace, kind: 'Unavailable workspace', description: detail },
    score: 0,
    metrics: { files: 0, directories: 0, totalBytes: 0, sourceFiles: 0, testFiles: 0, todoCount: 0, dirtyFiles: 0 },
    languages: [],
    stack: [],
    scripts: [],
    git: { available: false, branch: null, dirty: false, changed: 0, staged: 0, untracked: 0, ahead: 0, behind: 0, lastCommit: null },
    recentFiles: [],
    signals: [{ level: 'risk', title: 'Workspace unavailable', detail }],
    scan: { truncated: false, durationMs: Date.now() - startedAt, filesInspected: 0, contentFilesRead: 0, excludedDirectories: [...EXCLUDED_DIRECTORIES] }
  };
}

function dependencyNames(manifest) {
  return new Set([
    ...Object.keys(manifest?.dependencies ?? {}),
    ...Object.keys(manifest?.devDependencies ?? {}),
    ...Object.keys(manifest?.peerDependencies ?? {})
  ]);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}
