import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.resolve(rootDir, process.env.JARVIS_CONFIG ?? 'jarvis.config.json');
const dataDir = path.resolve(process.env.JARVIS_DATA_DIR ?? path.resolve(rootDir, 'data'));
const defaultHostedModel = {
  provider: 'opencode',
  endpoint: 'https://opencode.ai/zen/v1',
  model: 'minimax-m2.5-free'
};

const POSIX_COMMAND_DIRS = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin'
];

function userCommandDirs() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) {
    return [];
  }
  return [
    path.join(home, '.local', 'bin'),
    path.join(home, 'bin'),
    path.join(home, '.npm-global', 'bin'),
    path.join(home, '.npm', 'bin'),
    path.join(home, '.bun', 'bin'),
    path.join(home, '.volta', 'bin'),
    path.join(home, '.deno', 'bin'),
    path.join(home, '.cargo', 'bin'),
    path.join(home, '.codex', 'bin')
  ];
}

let commandPathAugmented = false;

// Desktop apps launched from Finder/Dock on macOS (and .desktop launchers on
// Linux) do NOT inherit the interactive shell PATH, so CLIs installed via
// Homebrew, npm -g, Volta, etc. are invisible to spawned children. Prepend the
// well-known install locations so `codex` resolves regardless of how the app
// was started. No-op on Windows (PATH/PATHEXT already handle this).
export function ensureCommandPath() {
  if (commandPathAugmented || process.platform === 'win32') {
    return;
  }
  commandPathAugmented = true;
  const existing = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const merged = [...existing];
  for (const dir of [...POSIX_COMMAND_DIRS, ...userCommandDirs()]) {
    if (dir && !merged.includes(dir)) {
      merged.push(dir);
    }
  }
  process.env.PATH = merged.join(path.delimiter);
}

// The bundled default config ships a Windows command name ("codex.cmd"). On
// macOS/Linux the Codex CLI is simply "codex"; treat any Windows shim extension
// as the bare binary so one config works on every platform.
export function resolveCodexCommand(command) {
  const configured = String(command ?? '').trim();
  if (process.platform === 'win32') {
    return configured || 'codex.cmd';
  }
  if (!configured || /\.(cmd|bat|exe|ps1)$/i.test(configured)) {
    return 'codex';
  }
  return configured;
}

// Resolve a command to an absolute executable path when possible so spawns are
// robust even when PATH lookup is unreliable inside a packaged app. Falls back
// to the bare name (relying on PATH) when nothing is found.
export function resolveExecutable(command) {
  const name = String(command ?? '').trim();
  if (!name || process.platform === 'win32' || path.isAbsolute(name)) {
    return name;
  }
  if (name.includes('/')) {
    return path.resolve(name);
  }
  ensureCommandPath();
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Not in this directory; keep searching.
    }
  }
  return name;
}

export function loadConfig() {
  ensureCommandPath();
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const normalize = (value) => path.resolve(expandHomeAndEnvPath(value));
  const localProvider = normalizeProvider(config.localModel?.provider);
  const defaultWorkspace = normalize(config.defaultWorkspace);
  const workspaceAllowlist = (config.workspaceAllowlist?.length ? config.workspaceAllowlist : [defaultWorkspace])
    .map(normalize);
  return {
    ...config,
    rootDir,
    dataDir,
    workspaceAllowlist,
    defaultWorkspace,
    memory: {
      ...config.memory,
      databasePath: path.isAbsolute(config.memory.databasePath)
        ? config.memory.databasePath
        : path.resolve(dataDir, path.basename(config.memory.databasePath))
    },
    codex: {
      ...config.codex,
      command: resolveCodexCommand(config.codex?.command),
      reasoningEffort: config.codex?.reasoningEffort ?? 'low',
      ephemeral: config.codex?.ephemeral ?? true
    },
    localModel: {
      provider: localProvider,
      endpoint: config.localModel?.endpoint ?? defaultEndpoint(localProvider),
      model: config.localModel?.model ?? defaultModel(localProvider)
    }
  };
}

export function expandHomeAndEnvPath(value) {
  let str = String(value ?? '').trim();
  if (!str) {
    return str;
  }
  // Expand %VAR% tokens. On non-Windows hosts, map the common Windows base
  // directories (USERPROFILE, APPDATA, ...) onto POSIX equivalents so a config
  // authored on Windows still resolves on macOS and Linux.
  str = str.replace(/%([^%]+)%/g, (_, name) => {
    const direct = process.env[name];
    if (direct) {
      return direct;
    }
    const fallback = windowsEnvFallback(name);
    return fallback ?? `%${name}%`;
  });
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (str === '~') {
    return home;
  }
  if (str.startsWith('~/') || str.startsWith('~\\')) {
    str = path.join(home, str.slice(2));
  }
  // A path written with Windows separators (e.g. "%USERPROFILE%\\Documents\\X")
  // must still resolve on POSIX. Convert backslashes to the native separator
  // unless this looks like a real Windows drive path (e.g. "C:\\...").
  if (path.sep === '/' && str.includes('\\') && !/^[A-Za-z]:[\\/]/.test(str)) {
    str = str.replace(/\\/g, '/');
  }
  return str;
}

function windowsEnvFallback(name) {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  switch (String(name).toUpperCase()) {
    case 'USERPROFILE':
    case 'HOMEPATH':
      return home || null;
    case 'APPDATA':
      return home ? path.join(home, '.config') : null;
    case 'LOCALAPPDATA':
      return home ? path.join(home, '.local', 'share') : null;
    case 'TEMP':
    case 'TMP':
      return process.env.TMPDIR || '/tmp';
    default:
      return null;
  }
}

export function isPathAllowed(config, candidate) {
  const resolved = path.resolve(expandHomeAndEnvPath(candidate));
  return config.workspaceAllowlist.some((allowed) => {
    const root = path.resolve(expandHomeAndEnvPath(allowed));
    return resolved === root || resolved.startsWith(`${root}${path.sep}`);
  });
}

export function publicConfig(config) {
  return {
    assistantName: config.assistantName,
    defaultWorkspace: config.defaultWorkspace,
    workspaceAllowlist: config.workspaceAllowlist,
    dataDir: config.dataDir,
    memoryAutomatic: Boolean(config.memory?.automatic),
    codexCommand: config.codex?.command,
    codexModel: config.codex?.model,
    codexReasoningEffort: config.codex?.reasoningEffort,
    codexEphemeral: Boolean(config.codex?.ephemeral),
    localModel: config.localModel,
    modelApiKeyPresent: Boolean(process.env.OPENCODE_API_KEY),
    openAiApiKeyPresent: Boolean(process.env.OPENAI_API_KEY)
  };
}

function normalizeProvider(provider) {
  const value = String(provider ?? '').toLowerCase();
  if (value === 'ollama') {
    return 'ollama';
  }
  if (value === 'lmstudio') {
    return 'lmstudio';
  }
  if (value === 'codex') {
    return 'codex';
  }
  return defaultHostedModel.provider;
}

function defaultEndpoint(provider) {
  if (provider === 'ollama') {
    return 'http://127.0.0.1:11434';
  }
  if (provider === 'lmstudio') {
    return 'http://127.0.0.1:1234/v1';
  }
  return defaultHostedModel.endpoint;
}

function defaultModel(provider) {
  return provider === defaultHostedModel.provider ? defaultHostedModel.model : '';
}
