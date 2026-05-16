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

export function loadConfig() {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const normalize = (value) => path.resolve(expandEnvironmentPath(value));
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

function expandEnvironmentPath(value) {
  return String(value ?? '').replace(/%([^%]+)%/g, (_, name) => process.env[name] ?? `%${name}%`);
}

export function isPathAllowed(config, candidate) {
  const resolved = path.resolve(candidate);
  return config.workspaceAllowlist.some((allowed) => {
    const root = path.resolve(allowed);
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
