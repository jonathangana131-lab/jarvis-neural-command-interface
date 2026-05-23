import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { isPathAllowed, loadConfig, publicConfig, expandHomeAndEnvPath } from './config.mjs';
import { EventBus } from './eventBus.mjs';
import { Embedder } from './embeddings.mjs';
import { MemoryExtractor } from './memoryExtractor.mjs';
import { MemoryStore } from './memoryStore.mjs';
import { CodexTaskRunner } from './codexTaskRunner.mjs';
import { TaskStore } from './taskStore.mjs';
import { checkProviderHealth, classifyProviderFailure, providerFailureAction } from './providerHealth.mjs';

const app = express();
const config = loadConfig();
const packageInfo = JSON.parse(fs.readFileSync(path.resolve(config.rootDir, 'package.json'), 'utf8'));
const logPath = path.resolve(config.dataDir, 'jarvis.log');
initLocalLogging(logPath);
const eventBus = new EventBus();
const memoryExtractor = new MemoryExtractor(config.memory);
const embedder = new Embedder({
  cacheDir: path.resolve(config.dataDir, 'transformers-cache')
});
const memoryStore = new MemoryStore(config.memory.databasePath, eventBus, { embedder });
const taskStore = new TaskStore(config.memory.databasePath);
const taskRunner = new CodexTaskRunner(config, eventBus, memoryStore, memoryExtractor, taskStore, {
  getProviderHealth,
  getCodexStatus: () => checkCodexStatus(config.codex.command)
});
const localModelStatePath = path.resolve(config.dataDir, 'local-model.json');
const secretDir = path.resolve(process.env.JARVIS_SECRET_DIR ?? config.dataDir);
const modelSecretPath = path.resolve(secretDir, 'model-secrets.json');
const updateDir = path.resolve(config.dataDir, 'updates');
const updateBackupDir = path.resolve(config.dataDir, 'update-backups');
const voiceSettingsPath = path.resolve(config.dataDir, 'voice-settings.json');
const sessionStatePath = path.resolve(config.dataDir, 'session-state.json');
const updateRepository = process.env.JARVIS_UPDATE_REPO || 'jonathangana131-lab/jarvis-neural-command-interface';
const startedAt = new Date().toISOString();
const defaultVoiceSettings = {
  voiceEnabled: true,
  spokenResponses: false,
  selectedVoiceName: '',
  autoSendAfterFinalTranscript: true,
  summaryMaxLength: 180
};
const sessionState = initSessionState(sessionStatePath, startedAt);
let updateDownloadState = {
  status: 'idle',
  version: null,
  fileName: null,
  installerPath: null,
  receivedBytes: 0,
  totalBytes: 0,
  sha256: null,
  expectedSha256: null,
  backupPath: null,
  backupFiles: [],
  error: null,
  updatedAt: new Date().toISOString()
};
let voiceSettings = loadVoiceSettings(voiceSettingsPath);
const opencodeFreeModels = [
  'minimax-m2.5-free',
  'big-pickle',
  'ling-2.6-flash',
  'hy3-preview-free',
  'nemotron-3-super-free'
];
let providerHealthCache = null;
loadModelSecrets(modelSecretPath);
loadLocalModelState(config, localModelStatePath);

app.use(express.json({ limit: '1mb' }));

app.get('/api/config', async (_req, res) => {
  res.json({
    ...publicConfig(config),
    appVersion: packageInfo.version,
    modelKey: modelKeyStatus(),
    memoryCount: memoryStore.count(),
    codexStatus: await checkCodexStatus(config.codex.command),
    providerHealth: await getProviderHealth()
  });
});

app.get('/api/health', async (_req, res) => {
  const codex = await checkCodexStatus(config.codex.command);
  const localModel = await listLocalModels(config.localModel?.provider, config.localModel?.endpoint);
  res.json({
    app: {
      version: packageInfo.version,
      dataDir: config.dataDir,
      logPath
    },
    backend: {
      available: true,
      startedAt,
      port
    },
    session: publicSessionState(),
    modelKey: modelKeyStatus(),
    localModel,
    providerHealth: await getProviderHealth(),
    memory: {
      databasePath: config.memory.databasePath,
      exists: fs.existsSync(config.memory.databasePath),
      count: memoryStore.count(),
      embeddings: {
        disabled: embedder.disabled,
        dim: embedder.dim,
        lastError: embedder.lastError
      }
    },
    codex,
    queue: taskRunner.queueStatus()
  });
});

app.get('/api/session', (_req, res) => {
  res.json(publicSessionState());
});

app.post('/api/session/acknowledge-crash', (_req, res) => {
  sessionState.previousCrashAcknowledged = true;
  writeJsonFile(sessionStatePath, sessionState);
  res.json(publicSessionState());
});

app.get('/api/voice-settings', (_req, res) => {
  res.json(voiceSettings);
});

app.post('/api/voice-settings', (req, res, next) => {
  try {
    voiceSettings = normalizeVoiceSettings(req.body ?? {});
    writeJsonFile(voiceSettingsPath, voiceSettings);
    res.json(voiceSettings);
  } catch (error) {
    next(error);
  }
});

app.get('/api/update-check', async (_req, res) => {
  try {
    const release = await fetchLatestRelease();
    const asset = findWindowsInstallerAsset(release);
    const latestVersion = String(release.tag_name ?? '').replace(/^v/i, '');
    res.json({
      currentVersion: packageInfo.version,
      latestVersion,
      updateAvailable: compareVersions(latestVersion, packageInfo.version) > 0,
      url: release.html_url,
      downloadUrl: asset?.browser_download_url ?? release.html_url,
      assetName: asset?.name ?? null,
      assetSize: asset?.size ?? null,
      digest: asset?.digest ?? null,
      downloaded: asset ? downloadedInstallerStatus(asset) : null,
      name: release.name ?? release.tag_name,
      publishedAt: release.published_at
    });
  } catch (error) {
    res.json({
      currentVersion: packageInfo.version,
      latestVersion: packageInfo.version,
      updateAvailable: false,
      url: null,
      downloadUrl: null,
      assetName: null,
      assetSize: null,
      digest: null,
      downloaded: null,
      name: null,
      publishedAt: null,
      error: error instanceof Error ? error.message : 'Unable to check for updates.'
    });
  }
});

app.post('/api/update/download', async (_req, res, next) => {
  try {
    if (updateDownloadState.status === 'downloading') {
      res.status(202).json(updateDownloadState);
      return;
    }
    const release = await fetchLatestRelease();
    const asset = findWindowsInstallerAsset(release);
    if (!asset?.browser_download_url) {
      const error = new Error('No Windows installer was found on the latest GitHub release.');
      error.status = 404;
      throw error;
    }
    const latestVersion = String(release.tag_name ?? '').replace(/^v/i, '');
    if (compareVersions(latestVersion, packageInfo.version) <= 0) {
      const error = new Error(`Version ${packageInfo.version} is already current.`);
      error.status = 409;
      throw error;
    }

    startUpdateDownload(release, asset);
    res.status(202).json(updateDownloadState);
  } catch (error) {
    next(error);
  }
});

async function safeUpdateCheck() {
  try {
    const release = await fetchLatestRelease();
    const asset = findWindowsInstallerAsset(release);
    const latestVersion = String(release.tag_name ?? '').replace(/^v/i, '');
    return {
      currentVersion: packageInfo.version,
      latestVersion,
      updateAvailable: compareVersions(latestVersion, packageInfo.version) > 0,
      url: release.html_url,
      assetName: asset?.name ?? null,
      assetSize: asset?.size ?? null,
      digest: asset?.digest ?? null,
      downloaded: asset ? downloadedInstallerStatus(asset) : null,
      error: null
    };
  } catch (error) {
    return {
      currentVersion: packageInfo.version,
      latestVersion: packageInfo.version,
      updateAvailable: false,
      url: null,
      assetName: null,
      assetSize: null,
      digest: null,
      downloaded: null,
      error: error instanceof Error ? error.message : 'Unable to check for updates.'
    };
  }
}

async function getProviderHealth({ force = false } = {}) {
  const now = Date.now();
  if (!force && providerHealthCache && now - providerHealthCache.cachedAtMs < 120000) {
    return providerHealthCache.report;
  }
  const report = await checkProviderHealth({
    provider: config.localModel?.provider,
    endpoint: config.localModel?.endpoint,
    model: config.localModel?.model,
    apiKey: process.env.OPENCODE_API_KEY,
    codexStatus: () => checkCodexStatus(config.codex.command)
  });
  providerHealthCache = { cachedAtMs: now, report };
  return report;
}

function invalidateProviderHealth() {
  providerHealthCache = null;
}

function workspaceSummary() {
  const paths = new Set([
    config.defaultWorkspace,
    ...(Array.isArray(config.workspaceAllowlist) ? config.workspaceAllowlist : []),
    ...taskRunner.list().map((task) => task.workspace),
    ...taskStore.listChats({ limit: 80 }).map((chat) => chat.workspace).filter(Boolean)
  ]);
  const items = [...paths]
    .filter(Boolean)
    .map((workspacePath) => {
      const resolved = path.resolve(workspacePath);
      return {
        path: resolved,
        label: path.basename(resolved) || resolved,
        allowed: isPathAllowed(config, resolved),
        exists: fs.existsSync(resolved),
        current: path.resolve(config.defaultWorkspace) === resolved
      };
    });
  return {
    current: config.defaultWorkspace,
    items
  };
}

async function releaseStatus() {
  const releaseDir = path.resolve(config.rootDir, 'release');
  const version = packageInfo.version;
  const installerName = `Jarvis-Neural-Command-Interface-Setup-${version}.exe`;
  const blockmapName = `${installerName}.blockmap`;
  const latestName = 'latest.yml';
  const assets = [installerName, blockmapName, latestName].map((name) => {
    const assetPath = path.resolve(releaseDir, name);
    return {
      name,
      path: assetPath,
      exists: fs.existsSync(assetPath),
      size: fs.existsSync(assetPath) ? fs.statSync(assetPath).size : 0,
      sha256: fs.existsSync(assetPath) && name.endsWith('.exe') ? sha256File(assetPath) : null
    };
  });
  return {
    version,
    tag: `v${version}`,
    releaseDir,
    assets,
    ready: assets.every((asset) => asset.exists && asset.size > 0),
    latest: await safeUpdateCheck()
  };
}

app.get('/api/update/status', (_req, res) => {
  res.json(updateDownloadState);
});

app.post('/api/update/prepare-install', async (req, res, next) => {
  try {
    const prepared = await prepareVerifiedUpdateInstall(req.body ?? {});
    res.json({
      ...prepared,
      message: 'Verified update is ready. The desktop app will close, install it, then reopen Jarvis.'
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/backups/create', (_req, res, next) => {
  try {
    res.status(201).json(backupUserDataForUpdate('manual'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/backups', (_req, res, next) => {
  try {
    res.json({ backups: listUpdateBackups() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/logs/export', (_req, res, next) => {
  try {
    const bundle = exportLogBundle();
    res.json(bundle);
  } catch (error) {
    next(error);
  }
});

app.get('/api/diagnostics/bundle', async (_req, res, next) => {
  try {
    const bundle = await exportDiagnosticBundle();
    res.json(bundle);
  } catch (error) {
    next(error);
  }
});

app.post('/api/recovery/reset-model', (_req, res, next) => {
  try {
    config.localModel = {
      provider: 'opencode',
      endpoint: defaultEndpoint('opencode'),
      model: defaultModel('opencode')
    };
    config.codex.model = 'gpt-5.5';
    fs.rmSync(localModelStatePath, { force: true });
    invalidateProviderHealth();
    res.json({ localModel: config.localModel, message: 'Model settings reset to safe defaults.' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/recovery/clear-secrets', (_req, res, next) => {
  try {
    if (fs.existsSync(modelSecretPath)) {
      fs.rmSync(modelSecretPath, { force: true });
    }
    delete process.env.OPENCODE_API_KEY;
    invalidateProviderHealth();
    res.json({ modelKey: modelKeyStatus(), message: 'Saved model secrets cleared.' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/recovery/repair-shortcuts', (_req, res, next) => {
  try {
    const repaired = repairShortcuts();
    res.json({ repaired, message: repaired.length ? 'Jarvis shortcuts repaired.' : 'Shortcut repair is only available in the Windows desktop build.' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/recovery/repair-install', (_req, res, next) => {
  try {
    const shortcuts = repairShortcuts();
    const cleanup = cleanupOldUpdateInstallers({ keepReady: true });
    res.json({
      install: installStatus(),
      shortcuts,
      cleanup,
      message: 'Install repair checked shortcuts and removed old update downloads.'
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/backups/:id/restore-settings', (req, res, next) => {
  try {
    const backup = backupById(req.params.id);
    if (!backup) {
      const error = new Error('Backup not found.');
      error.status = 404;
      throw error;
    }
    const restored = restoreSettingsFromBackup(backup.path);
    loadModelSecrets(modelSecretPath);
    loadLocalModelState(config, localModelStatePath);
    invalidateProviderHealth();
    res.json({ restored, localModel: config.localModel, modelKey: modelKeyStatus() });
  } catch (error) {
    next(error);
  }
});

function startUpdateDownload(release, asset) {
  const latestVersion = String(release.tag_name ?? '').replace(/^v/i, '');
  const fileName = safeInstallerFileName(asset.name);
  const expected = normalizeSha256Digest(asset.digest);
  updateDownloadState = {
    status: 'downloading',
    version: latestVersion,
    fileName,
    installerPath: null,
    receivedBytes: 0,
    totalBytes: Number(asset.size ?? 0),
    sha256: null,
    expectedSha256: expected || null,
    backupPath: null,
    backupFiles: [],
    error: null,
    updatedAt: new Date().toISOString()
  };
  void runUpdateDownload(asset, latestVersion, fileName, expected);
}

async function runUpdateDownload(asset, latestVersion, fileName, expected) {
  try {
    fs.mkdirSync(updateDir, { recursive: true });
    const targetPath = path.resolve(updateDir, fileName);
    const tempPath = `${targetPath}.download`;
    const response = await fetch(asset.browser_download_url, {
      headers: { 'User-Agent': 'Jarvis-Neural-Command-Interface' },
      signal: AbortSignal.timeout(10 * 60 * 1000)
    });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    const fileStream = fs.createWriteStream(tempPath);
    for await (const chunk of Readable.fromWeb(response.body)) {
      updateDownloadState.receivedBytes += chunk.length;
      updateDownloadState.updatedAt = new Date().toISOString();
      if (!fileStream.write(chunk)) {
        await new Promise((resolve) => fileStream.once('drain', resolve));
      }
    }
    await new Promise((resolve, reject) => {
      fileStream.end(resolve);
      fileStream.on('error', reject);
    });
    const sha256 = sha256File(tempPath);
    if (expected && sha256.toLowerCase() !== expected.toLowerCase()) {
      fs.rmSync(tempPath, { force: true });
      throw new Error(`Downloaded installer checksum mismatch. Expected ${expected}, got ${sha256}.`);
    }
    fs.renameSync(tempPath, targetPath);
    const backup = backupUserDataForUpdate('update');
    const cleanup = cleanupOldUpdateInstallers({ keepPath: targetPath, keepReady: true });
    updateDownloadState = {
      status: 'ready',
      version: latestVersion,
      installerPath: targetPath,
      fileName,
      receivedBytes: fs.statSync(targetPath).size,
      totalBytes: fs.statSync(targetPath).size,
      sha256,
      expectedSha256: expected || null,
      backupPath: backup.path,
      backupFiles: backup.files,
      error: null,
      cleanupRemoved: cleanup.removed,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    updateDownloadState = {
      ...updateDownloadState,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Update download failed.',
      updatedAt: new Date().toISOString()
    };
  }
}

async function prepareVerifiedUpdateInstall(body = {}) {
  if (process.platform !== 'win32') {
    const error = new Error('In-app installer launch is only supported by the Windows build.');
    error.status = 400;
    throw error;
  }
  const requestedPath = String(body.installerPath ?? '').trim();
  const installerPath = requestedPath
    ? path.resolve(requestedPath)
    : latestDownloadedInstallerPath();
  if (!installerPath) {
    const error = new Error('Download the update before installing it.');
    error.status = 400;
    throw error;
  }
  if (!isSubpath(updateDir, installerPath) || path.extname(installerPath).toLowerCase() !== '.exe' || !fs.existsSync(installerPath)) {
    const error = new Error('Installer path is not a verified Jarvis update download.');
    error.status = 403;
    throw error;
  }
  const release = await fetchLatestRelease();
  const asset = findWindowsInstallerAsset(release);
  const expected = normalizeSha256Digest(asset?.digest);
  const sha256 = sha256File(installerPath);
  if (expected && sha256.toLowerCase() !== expected.toLowerCase()) {
    const error = new Error('Installer checksum changed after download. Download the update again.');
    error.status = 409;
    throw error;
  }
  return {
    ready: true,
    version: String(release.tag_name ?? '').replace(/^v/i, '') || updateDownloadState.version,
    installerPath,
    fileName: path.basename(installerPath),
    sha256,
    expectedSha256: expected || null,
    size: fs.statSync(installerPath).size
  };
}

app.post('/api/update/install', async (req, res, next) => {
  try {
    const prepared = await prepareVerifiedUpdateInstall(req.body ?? {});
    res.json({
      ...prepared,
      launched: false,
      requiresDesktopBridge: true,
      message: 'Update verified. Use the desktop update handoff so Jarvis can close before the installer runs.'
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/storage', (_req, res) => {
  res.json(storageReport());
});

app.post('/api/storage/cleanup', (req, res, next) => {
  try {
    const target = String(req.body?.target ?? '').trim();
    const result = cleanupStorage(target);
    res.json({ ...result, storage: storageReport() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/logs', (_req, res) => {
  res.json({
    path: logPath,
    tail: readLogTail(logPath, 24000)
  });
});

app.get('/api/codex/status', async (_req, res) => {
  res.json(await checkCodexStatus(config.codex.command));
});

app.get('/api/model-key/status', (_req, res) => {
  res.json(modelKeyStatus());
});

app.post('/api/model-key', (req, res, next) => {
  try {
    const apiKey = String(req.body?.apiKey ?? '').trim();
    if (!apiKey) {
      const error = new Error('OpenCode API key is required.');
      error.status = 400;
      throw error;
    }
    saveModelSecret(modelSecretPath, apiKey);
    process.env.OPENCODE_API_KEY = apiKey;
    invalidateProviderHealth();
    res.json(modelKeyStatus());
  } catch (error) {
    next(error);
  }
});

app.delete('/api/model-key', (_req, res, next) => {
  try {
    if (fs.existsSync(modelSecretPath)) {
      fs.rmSync(modelSecretPath, { force: true });
    }
    delete process.env.OPENCODE_API_KEY;
    invalidateProviderHealth();
    res.json(modelKeyStatus());
  } catch (error) {
    next(error);
  }
});

app.get('/api/local-models', async (req, res) => {
  const provider = normalizeProvider(req.query.provider ?? config.localModel?.provider);
  const endpoint = String(req.query.endpoint ?? config.localModel?.endpoint ?? defaultEndpoint(provider)).trim();
  res.json(await listLocalModels(provider, endpoint));
});

app.post('/api/local-model-selection', (req, res, next) => {
  try {
    const provider = normalizeProvider(req.body?.provider);
    const endpoint = String(req.body?.endpoint ?? defaultEndpoint(provider)).trim() || defaultEndpoint(provider);
    const model = String(req.body?.model ?? defaultModel(provider)).trim() || defaultModel(provider);
    config.localModel = { provider, endpoint, model };
    if (provider === 'codex') {
      config.codex.model = model;
    }
    fs.mkdirSync(path.dirname(localModelStatePath), { recursive: true });
    fs.writeFileSync(localModelStatePath, JSON.stringify(config.localModel, null, 2));
    invalidateProviderHealth();
    res.json({ localModel: config.localModel });
  } catch (error) {
    next(error);
  }
});

function isSubpath(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function openLocalPath(target) {
  if (process.platform === 'win32') {
    spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'start', '', target], {
      windowsHide: true,
      stdio: 'ignore'
    }).unref();
    return;
  }
  if (process.platform === 'darwin') {
    spawn('open', [target], { stdio: 'ignore' }).unref();
    return;
  }
  spawn('xdg-open', [target], { stdio: 'ignore' }).unref();
}

function repairShortcuts() {
  if (process.platform !== 'win32' || /node(\.exe)?$/i.test(path.basename(process.execPath))) {
    return [];
  }
  const appName = 'Jarvis Neural Command Interface';
  const exePath = process.execPath;
  const iconPath = path.join(path.dirname(exePath), 'resources', 'app', 'build', 'icon.ico');
  const shortcutIcon = fs.existsSync(iconPath) ? iconPath : `${exePath},0`;
  const shortcutTargets = [
    path.join(process.env.USERPROFILE ?? '', 'Desktop', `${appName}.lnk`),
    path.join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${appName}.lnk`)
  ].filter(Boolean);
  const script = `
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject WScript.Shell
foreach ($shortcutPath in @(${shortcutTargets.map(psQuote).join(',')})) {
  $directory = Split-Path -Parent $shortcutPath
  if (-not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = ${psQuote(exePath)}
  $shortcut.WorkingDirectory = ${psQuote(path.dirname(exePath))}
  $shortcut.IconLocation = ${psQuote(shortcutIcon)}
  $shortcut.Description = ${psQuote(appName)}
  $shortcut.Save()
}
`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    windowsHide: true,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    const error = new Error((result.stderr || result.stdout || 'Shortcut repair failed.').trim());
    error.status = 500;
    throw error;
  }
  return shortcutTargets;
}

function installStatus() {
  const appName = 'Jarvis Neural Command Interface';
  const exePath = process.execPath;
  const runningFromPackagedExe = process.platform === 'win32' && !/node(\.exe)?$/i.test(path.basename(exePath));
  const installPath = runningFromPackagedExe ? path.dirname(exePath) : config.rootDir;
  return {
    version: packageInfo.version,
    platform: process.platform,
    packaged: runningFromPackagedExe,
    executablePath: exePath,
    installPath,
    dataDir: config.dataDir,
    shortcuts: shortcutStatus(appName, exePath)
  };
}

function shortcutStatus(appName = 'Jarvis Neural Command Interface', exePath = process.execPath) {
  if (process.platform !== 'win32') {
    return [];
  }
  const targets = [
    path.join(process.env.USERPROFILE ?? '', 'Desktop', `${appName}.lnk`),
    path.join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${appName}.lnk`)
  ].filter(Boolean);
  return targets.map((shortcutPath) => ({
    path: shortcutPath,
    exists: fs.existsSync(shortcutPath),
    expectedTarget: exePath
  }));
}

function cleanupOldUpdateInstallers({ keepPath = updateDownloadState.installerPath, keepReady = false } = {}) {
  const keep = keepPath ? path.resolve(keepPath) : '';
  const removed = [];
  for (const file of listFiles(updateDir)) {
    if (!/\.(exe|download|blockmap|yml)$/i.test(file.name)) {
      continue;
    }
    const resolved = path.resolve(file.path);
    if (keepReady && keep && resolved === keep) {
      continue;
    }
    if (keepReady && keep && resolved === `${keep}.blockmap`) {
      continue;
    }
    fs.rmSync(resolved, { force: true });
    removed.push(resolved);
  }
  return { removed, removedCount: removed.length };
}

function psQuote(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

app.get('/api/diagnostics', async (_req, res) => {
  const codex = await checkCodexStatus(config.codex.command);
  const localModel = await listLocalModels(config.localModel?.provider, config.localModel?.endpoint);
  const providerHealth = await getProviderHealth();
  res.json({
    codex,
    localModel,
    providerHealth,
    modelKey: modelKeyStatus(),
    voice: {
      speechRecognition: 'browser',
      microphone: 'browser',
      detail: 'Voice capability is verified in the renderer because microphone APIs are browser-scoped.',
      settings: voiceSettings
    },
    session: publicSessionState(),
    install: installStatus(),
    lastFailure: taskStore.lastFailedTask(),
    config: publicConfig(config),
    sqlite: {
      databasePath: config.memory.databasePath,
      exists: fs.existsSync(config.memory.databasePath),
      memoryCount: memoryStore.count(),
      taskCount: taskRunner.list().length
    },
    queue: taskRunner.queueStatus()
  });
});

app.get('/api/events', (req, res) => {
  eventBus.connect(req, res);
});

app.get('/api/memories', (req, res) => {
  res.json({
    memories: memoryStore.list({
      query: req.query.q,
      scope: req.query.scope,
      workspace: req.query.workspace ? path.resolve(expandHomeAndEnvPath(String(req.query.workspace))) : '',
      limit: req.query.limit ? Number(req.query.limit) : 80
    }),
    count: memoryStore.count()
  });
});

app.post('/api/memories', (req, res) => {
  const memory = memoryStore.create(req.body ?? {});
  res.status(201).json({ memory, count: memoryStore.count() });
});

app.put('/api/memories/:id', (req, res) => {
  const memory = memoryStore.update(Number(req.params.id), req.body ?? {});
  if (!memory) {
    res.status(404).json({ error: 'Memory not found.' });
    return;
  }
  res.json({ memory, count: memoryStore.count() });
});

app.delete('/api/memories/:id', (req, res) => {
  const memory = memoryStore.delete(Number(req.params.id));
  if (!memory) {
    res.status(404).json({ error: 'Memory not found.' });
    return;
  }
  res.json({ memory, count: memoryStore.count() });
});

app.post('/api/memories/reset', (_req, res) => {
  const deleted = memoryStore.resetVisible();
  res.json({ deleted, count: memoryStore.count() });
});

app.get('/api/memory/edges', (req, res, next) => {
  try {
    const threshold = req.query.threshold === undefined ? undefined : Number(req.query.threshold);
    const limit = req.query.limit === undefined ? undefined : Math.max(0, Math.min(2000, Number(req.query.limit)));
    const summary = memoryStore.similarityEdges({
      ...(Number.isFinite(threshold) ? { threshold } : {}),
      ...(Number.isFinite(limit) ? { limit } : {})
    });
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.get('/api/memory/search', async (req, res, next) => {
  try {
    const limit = req.query.limit === undefined ? 20 : Math.max(1, Math.min(100, Number(req.query.limit)));
    const threshold = req.query.threshold === undefined ? undefined : Number(req.query.threshold);
    const results = await memoryStore.semanticSearch({
      query: req.query.q,
      scope: req.query.scope,
      workspace: req.query.workspace ? path.resolve(expandHomeAndEnvPath(String(req.query.workspace))) : '',
      limit,
      ...(Number.isFinite(threshold) ? { threshold } : {})
    });
    res.json({ results, count: results.length, available: results.length > 0 || !embedder.disabled });
  } catch (error) {
    next(error);
  }
});

app.get('/api/memory/duplicates', (req, res, next) => {
  try {
    const threshold = req.query.threshold === undefined ? undefined : Number(req.query.threshold);
    const limit = req.query.limit === undefined ? undefined : Math.max(1, Math.min(200, Number(req.query.limit)));
    const summary = memoryStore.nearDuplicates({
      ...(Number.isFinite(threshold) ? { threshold } : {}),
      ...(Number.isFinite(limit) ? { limit } : {})
    });
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.get('/api/memory/embeddings/status', (_req, res) => {
  res.json(memoryStore.embeddingsReady());
});

app.post('/api/remember', async (req, res, next) => {
  try {
    const extracted = await memoryExtractor.extractFromText(req.body?.text, req.body?.source);
    const memories = uniqueById(extracted.memories.map((memory) => memoryStore.create(memory)).filter(Boolean));
    res.status(201).json({ memories, skipped: extracted.skipped, count: memoryStore.count() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/chats', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 80;
  res.json({ chats: taskStore.listChats({
    limit: Number.isFinite(limit) ? limit : 80,
    query: req.query.q
  }) });
});

app.get('/api/provider-health', async (req, res) => {
  const force = String(req.query.force ?? '') === '1' || String(req.query.force ?? '').toLowerCase() === 'true';
  res.json(await getProviderHealth({ force }));
});

app.post('/api/chats', (req, res, next) => {
  try {
    const chat = taskStore.createChat({
      title: req.body?.title,
      workspace: path.resolve(expandHomeAndEnvPath(String(req.body?.workspace ?? config.defaultWorkspace)))
    });
    res.status(201).json({ chat });
  } catch (error) {
    next(error);
  }
});

app.get('/api/chats/:id/tasks', (req, res) => {
  const chat = taskStore.getChat(req.params.id);
  if (!chat || chat.archived) {
    res.status(404).json({ error: 'Chat not found.' });
    return;
  }
  res.json({ chat, tasks: taskStore.listByChat(req.params.id, 120) });
});

app.put('/api/chats/:id', (req, res) => {
  const chat = taskStore.updateChat(req.params.id, req.body ?? {});
  if (!chat) {
    res.status(404).json({ error: 'Chat not found.' });
    return;
  }
  res.json({ chat });
});

app.post('/api/chats/:id/clear', (req, res) => {
  const chat = taskStore.clearChat(req.params.id);
  if (!chat) {
    res.status(404).json({ error: 'Chat not found.' });
    return;
  }
  res.json({ chat });
});

app.delete('/api/chats/:id', (req, res) => {
  const chat = taskStore.archiveChat(req.params.id);
  if (!chat) {
    res.status(404).json({ error: 'Chat not found.' });
    return;
  }
  res.json({ chat });
});

app.get('/api/dashboard', async (_req, res) => {
  const update = await safeUpdateCheck();
  const storage = storageReport();
  res.json({
    version: packageInfo.version,
    workspace: config.defaultWorkspace,
    chats: taskStore.listChats({ limit: 6 }),
    tasks: taskRunner.list().slice(0, 8),
    memory: {
      count: memoryStore.count(),
      embeddings: memoryStore.embeddingsReady()
    },
    queue: taskRunner.queueStatus(),
    update,
    storage: {
      totalSize: storage.totalSize,
      updatesSize: storage.updates.size,
      backupsSize: storage.backups.size,
      logsSize: storage.logs.size,
      dataDir: storage.dataDir
    },
    workspaces: workspaceSummary()
  });
});

app.get('/api/workspaces', (_req, res) => {
  res.json(workspaceSummary());
});

app.get('/api/release/status', async (_req, res) => {
  res.json(await releaseStatus());
});

app.get('/api/tasks', (req, res) => {
  const chatId = String(req.query.chatId ?? '').trim();
  if (chatId) {
    res.json({ tasks: taskStore.listByChat(chatId, 120) });
    return;
  }
  res.json({ tasks: taskRunner.list() });
});

app.get('/api/queue', (_req, res) => {
  res.json({ queue: taskRunner.queueStatus() });
});

app.get('/api/tasks/:id', (req, res) => {
  const task = taskRunner.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }
  res.json({ task });
});

app.post('/api/tasks', (req, res, next) => {
  try {
    const task = taskRunner.start(req.body ?? {});
    res.status(202).json({ task });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks/:id/cancel', (req, res, next) => {
  try {
    const task = taskRunner.cancel(req.params.id);
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks/:id/retry', (req, res, next) => {
  try {
    const task = taskRunner.retry(req.params.id, req.body ?? {});
    res.status(202).json({ task });
  } catch (error) {
    next(error);
  }
});

app.post('/api/artifacts/open', (req, res, next) => {
  try {
    const workspace = path.resolve(expandHomeAndEnvPath(String(req.body?.workspace ?? config.defaultWorkspace)));
    const relativePath = String(req.body?.path ?? '').trim();
    if (!relativePath) {
      const error = new Error('Artifact path is required.');
      error.status = 400;
      throw error;
    }
    if (!isPathAllowed(config, workspace)) {
      const error = new Error(`Workspace is outside the allowlist: ${workspace}`);
      error.status = 403;
      throw error;
    }

    const target = path.resolve(workspace, relativePath);
    if (!isSubpath(workspace, target)) {
      const error = new Error('Artifact path resolved outside the workspace.');
      error.status = 403;
      throw error;
    }
    if (!fs.existsSync(target)) {
      const error = new Error(`Artifact does not exist: ${relativePath}`);
      error.status = 404;
      throw error;
    }

    openLocalPath(target);
    res.json({ ok: true, path: target });
  } catch (error) {
    next(error);
  }
});

app.post('/api/queue/pause', (_req, res) => {
  res.json({ queue: taskRunner.pauseQueue() });
});

app.post('/api/queue/resume', (_req, res) => {
  res.json({ queue: taskRunner.resumeQueue() });
});

const distDir = path.resolve(config.rootDir, 'dist');
if (fs.existsSync(path.resolve(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.resolve(distDir, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    error: error.message || 'Unexpected server error.'
  });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, '127.0.0.1', () => {
  console.log(`Jarvis Neural Command Interface backend listening on http://127.0.0.1:${port}`);
});

process.once('SIGINT', () => {
  markSessionClean('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  markSessionClean('SIGTERM');
  process.exit(0);
});

process.once('exit', (code) => {
  if (code === 0) {
    markSessionClean('exit');
  }
});

function initLocalLogging(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };
  const write = (level, args) => {
    const line = `[${new Date().toISOString()}] ${level} ${args.map(formatLogArg).join(' ')}\n`;
    fs.appendFile(targetPath, line, () => {});
  };
  console.log = (...args) => {
    write('INFO', args);
    original.log(...args);
  };
  console.warn = (...args) => {
    write('WARN', args);
    original.warn(...args);
  };
  console.error = (...args) => {
    write('ERROR', args);
    original.error(...args);
  };
}

function loadVoiceSettings(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return { ...defaultVoiceSettings };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    return normalizeVoiceSettings(parsed);
  } catch (error) {
    console.warn(`Unable to load voice settings: ${error.message}`);
    return { ...defaultVoiceSettings };
  }
}

function normalizeVoiceSettings(value) {
  const summaryMaxLength = Math.max(80, Math.min(420, Number(value.summaryMaxLength ?? defaultVoiceSettings.summaryMaxLength)));
  return {
    voiceEnabled: value.voiceEnabled !== false,
    spokenResponses: value.spokenResponses === true,
    selectedVoiceName: String(value.selectedVoiceName ?? '').slice(0, 160),
    autoSendAfterFinalTranscript: value.autoSendAfterFinalTranscript !== false,
    summaryMaxLength
  };
}

function initSessionState(targetPath, currentStartedAt) {
  const previous = readJsonFile(targetPath);
  const previousCrashed = Boolean(previous?.active && !previous?.cleanExit);
  const next = {
    active: true,
    cleanExit: false,
    startedAt: currentStartedAt,
    pid: process.pid,
    previous: previous ? {
      active: Boolean(previous.active),
      cleanExit: Boolean(previous.cleanExit),
      startedAt: previous.startedAt ?? null,
      endedAt: previous.endedAt ?? null,
      reason: previous.reason ?? null,
      pid: previous.pid ?? null
    } : null,
    previousCrashed,
    previousCrashAcknowledged: false
  };
  writeJsonFile(targetPath, next);
  return next;
}

function publicSessionState() {
  return {
    startedAt: sessionState.startedAt,
    pid: sessionState.pid,
    previousCrashed: Boolean(sessionState.previousCrashed && !sessionState.previousCrashAcknowledged),
    previousCrashAcknowledged: Boolean(sessionState.previousCrashAcknowledged),
    previous: sessionState.previous
  };
}

function markSessionClean(reason) {
  if (!sessionState.active && sessionState.cleanExit) {
    return;
  }
  sessionState.active = false;
  sessionState.cleanExit = true;
  sessionState.reason = reason;
  sessionState.endedAt = new Date().toISOString();
  writeJsonFile(sessionStatePath, sessionState);
}

function readJsonFile(targetPath) {
  try {
    if (!fs.existsSync(targetPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch (error) {
    console.warn(`Unable to read ${targetPath}: ${error.message}`);
    return null;
  }
}

function writeJsonFile(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2));
  fs.renameSync(tempPath, targetPath);
}

function formatLogArg(value) {
  if (value instanceof Error) {
    return value.stack ?? value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readLogTail(targetPath, maxBytes) {
  try {
    if (!fs.existsSync(targetPath)) {
      return '';
    }
    const stat = fs.statSync(targetPath);
    const length = Math.min(maxBytes, stat.size);
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(targetPath, 'r');
    try {
      fs.readSync(fd, buffer, 0, length, stat.size - length);
    } finally {
      fs.closeSync(fd);
    }
    return buffer.toString('utf8');
  } catch (error) {
    console.warn(`Unable to read log tail from ${targetPath}: ${error.message}`);
    return '';
  }
}

async function fetchLatestRelease() {
  const releaseUrl = process.env.JARVIS_UPDATE_RELEASE_URL || `https://api.github.com/repos/${updateRepository}/releases/latest`;
  const response = await fetch(releaseUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Jarvis-Neural-Command-Interface'
    },
    signal: AbortSignal.timeout(6000)
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

function findWindowsInstallerAsset(release) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  return assets.find((asset) => /^Jarvis-Neural-Command-Interface-Setup-.*\.exe$/i.test(String(asset.name ?? '')))
    ?? assets.find((asset) => String(asset.name ?? '').toLowerCase().endsWith('.exe'))
    ?? null;
}

function downloadedInstallerStatus(asset) {
  try {
    const fileName = safeInstallerFileName(asset.name);
    const installerPath = path.resolve(updateDir, fileName);
    if (!fs.existsSync(installerPath)) {
      return { ready: false, path: null, sha256: null, size: 0 };
    }
    const sha256 = sha256File(installerPath);
    const expected = normalizeSha256Digest(asset.digest);
    return {
      ready: !expected || sha256.toLowerCase() === expected.toLowerCase(),
      path: installerPath,
      sha256,
      size: fs.statSync(installerPath).size
    };
  } catch {
    return { ready: false, path: null, sha256: null, size: 0 };
  }
}

function latestDownloadedInstallerPath() {
  if (!fs.existsSync(updateDir)) {
    return '';
  }
  const candidates = fs.readdirSync(updateDir)
    .filter((name) => /^Jarvis-Neural-Command-Interface-Setup-.*\.exe$/i.test(name))
    .map((name) => {
      const installerPath = path.resolve(updateDir, name);
      return { installerPath, mtimeMs: fs.statSync(installerPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.installerPath ?? '';
}

function safeInstallerFileName(value) {
  const fileName = path.basename(String(value ?? 'Jarvis-Neural-Command-Interface-Setup.exe'));
  if (!/^[-_. A-Za-z0-9]+\.exe$/i.test(fileName)) {
    throw new Error('Installer asset name is not safe to download.');
  }
  return fileName;
}

function normalizeSha256Digest(value) {
  const digest = String(value ?? '').trim();
  if (!digest) {
    return '';
  }
  return digest.replace(/^sha256:/i, '');
}

function sha256File(targetPath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(targetPath));
  return hash.digest('hex').toUpperCase();
}

function backupUserDataForUpdate(reason = 'manual') {
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeBackupId(reason)}`;
  const backupPath = path.resolve(updateBackupDir, stamp);
  fs.mkdirSync(backupPath, { recursive: true });
  const files = [];
  const candidates = [
    config.memory.databasePath,
    `${config.memory.databasePath}-wal`,
    `${config.memory.databasePath}-shm`,
    localModelStatePath,
    modelSecretPath
  ];
  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) {
      continue;
    }
    const safeName = path.basename(candidate);
    const destination = path.resolve(backupPath, safeName);
    fs.copyFileSync(candidate, destination);
    files.push(safeName);
  }
  const manifest = {
    id: path.basename(backupPath),
    reason,
    createdAt: new Date().toISOString(),
    files,
    dataDir: config.dataDir,
    memoryDatabase: config.memory.databasePath
  };
  fs.writeFileSync(path.resolve(backupPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { ...manifest, path: backupPath };
}

function listUpdateBackups() {
  if (!fs.existsSync(updateBackupDir)) {
    return [];
  }
  return fs.readdirSync(updateBackupDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const backupPath = path.resolve(updateBackupDir, entry.name);
      const manifestPath = path.resolve(backupPath, 'manifest.json');
      let manifest = {};
      try {
        manifest = fs.existsSync(manifestPath)
          ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
          : {};
      } catch {
        manifest = {};
      }
      const files = fs.readdirSync(backupPath).filter((name) => name !== 'manifest.json');
      return {
        id: entry.name,
        path: backupPath,
        reason: manifest.reason ?? 'manual',
        createdAt: manifest.createdAt ?? fs.statSync(backupPath).birthtime.toISOString(),
        files,
        restartRequiredForMemoryRestore: files.some((name) => /^memory\.sqlite/i.test(name))
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function storageReport() {
  const updateFiles = listFiles(updateDir)
    .filter((file) => /\.(exe|download|blockmap|yml)$/i.test(file.name));
  const logBundles = listFiles(config.dataDir)
    .filter((file) => /^jarvis-log-bundle-.*\.txt$/i.test(file.name));
  const backupRecords = listUpdateBackups().map((backup) => ({
    ...backup,
    size: directorySize(backup.path)
  }));
  const currentLogSize = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
  const memoryFiles = [
    config.memory.databasePath,
    `${config.memory.databasePath}-wal`,
    `${config.memory.databasePath}-shm`
  ].filter((file) => fs.existsSync(file)).map((file) => ({
    path: file,
    size: fs.statSync(file).size
  }));
  const updatesSize = updateFiles.reduce((sum, file) => sum + file.size, 0);
  const backupSize = backupRecords.reduce((sum, backup) => sum + backup.size, 0);
  const logBundleSize = logBundles.reduce((sum, file) => sum + file.size, 0);
  const memorySize = memoryFiles.reduce((sum, file) => sum + file.size, 0);
  return {
    dataDir: config.dataDir,
    totalSize: directorySize(config.dataDir),
    updates: {
      path: updateDir,
      size: updatesSize,
      files: updateFiles
    },
    backups: {
      path: updateBackupDir,
      size: backupSize,
      count: backupRecords.length,
      items: backupRecords
    },
    logs: {
      path: logPath,
      size: currentLogSize + logBundleSize,
      currentLogSize,
      bundleSize: logBundleSize,
      bundles: logBundles
    },
    memory: {
      path: config.memory.databasePath,
      size: memorySize,
      files: memoryFiles
    }
  };
}

function cleanupStorage(target) {
  if (!['updates', 'old-updates', 'backups', 'logs', 'all'].includes(target)) {
    const error = new Error('Unknown cleanup target.');
    error.status = 400;
    throw error;
  }
  const removed = [];
  if (target === 'old-updates') {
    const result = cleanupOldUpdateInstallers({ keepReady: true });
    return { target, removed: result.removed, removedCount: result.removedCount };
  }
  if (target === 'updates' || target === 'all') {
    for (const file of listFiles(updateDir)) {
      if (!/\.(exe|download|blockmap|yml)$/i.test(file.name)) {
        continue;
      }
      fs.rmSync(file.path, { force: true });
      removed.push(file.path);
    }
    updateDownloadState = {
      status: 'idle',
      version: null,
      fileName: null,
      installerPath: null,
      receivedBytes: 0,
      totalBytes: 0,
      sha256: null,
      expectedSha256: null,
      backupPath: null,
      backupFiles: [],
      error: null,
      updatedAt: new Date().toISOString()
    };
  }
  if (target === 'backups' || target === 'all') {
    const backups = listUpdateBackups();
    const keep = new Set(backups.slice(0, target === 'all' ? 1 : 2).map((backup) => backup.id));
    for (const backup of backups) {
      if (keep.has(backup.id)) {
        continue;
      }
      fs.rmSync(backup.path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      removed.push(backup.path);
    }
  }
  if (target === 'logs' || target === 'all') {
    for (const file of listFiles(config.dataDir)) {
      if (!/^jarvis-log-bundle-.*\.txt$/i.test(file.name)) {
        continue;
      }
      fs.rmSync(file.path, { force: true });
      removed.push(file.path);
    }
    trimLogFile(logPath, 512 * 1024);
  }
  return { target, removed, removedCount: removed.length };
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const filePath = path.resolve(directory, entry.name);
      const stat = fs.statSync(filePath);
      return {
        name: entry.name,
        path: filePath,
        size: stat.size,
        updatedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function directorySize(directory) {
  if (!directory || !fs.existsSync(directory)) {
    return 0;
  }
  let total = 0;
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.resolve(current, entry.name);
      try {
        if (entry.isDirectory()) {
          stack.push(entryPath);
        } else if (entry.isFile()) {
          total += fs.statSync(entryPath).size;
        }
      } catch {
        // Ignore files that are removed while diagnostics are being calculated.
      }
    }
  }
  return total;
}

function trimLogFile(targetPath, maxBytes) {
  if (!fs.existsSync(targetPath)) {
    return;
  }
  const stat = fs.statSync(targetPath);
  if (stat.size <= maxBytes) {
    return;
  }
  const buffer = Buffer.alloc(maxBytes);
  const fd = fs.openSync(targetPath, 'r');
  try {
    fs.readSync(fd, buffer, 0, maxBytes, stat.size - maxBytes);
  } finally {
    fs.closeSync(fd);
  }
  fs.writeFileSync(targetPath, buffer);
}

function backupById(id) {
  const safeId = safeBackupId(id);
  return listUpdateBackups().find((backup) => backup.id === safeId) ?? null;
}

function restoreSettingsFromBackup(backupPath) {
  const restored = [];
  const localModelBackup = path.resolve(backupPath, path.basename(localModelStatePath));
  const modelSecretBackup = path.resolve(backupPath, path.basename(modelSecretPath));
  if (fs.existsSync(localModelBackup)) {
    fs.mkdirSync(path.dirname(localModelStatePath), { recursive: true });
    fs.copyFileSync(localModelBackup, localModelStatePath);
    restored.push('local-model.json');
  }
  if (fs.existsSync(modelSecretBackup)) {
    fs.mkdirSync(path.dirname(modelSecretPath), { recursive: true });
    fs.copyFileSync(modelSecretBackup, modelSecretPath);
    restored.push('model-secrets.json');
  }
  return restored;
}

function exportLogBundle() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bundlePath = path.resolve(config.dataDir, `jarvis-log-bundle-${stamp}.txt`);
  const lines = [
    `Jarvis Neural Command Interface ${packageInfo.version}`,
    `Created: ${new Date().toISOString()}`,
    `Data directory: ${config.dataDir}`,
    `Memory database: ${config.memory.databasePath}`,
    '',
    '--- Local log tail ---',
    readLogTail(logPath, 64000) || 'No log output yet.'
  ];
  fs.writeFileSync(bundlePath, lines.join('\n'));
  return { path: bundlePath, size: fs.statSync(bundlePath).size };
}

async function exportDiagnosticBundle() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bundlePath = path.resolve(config.dataDir, `jarvis-diagnostic-bundle-${stamp}.txt`);
  const providerHealth = await getProviderHealth();
  const codex = await checkCodexStatus(config.codex.command);
  const update = await safeUpdateCheck();
  const storage = storageReport();
  const install = installStatus();
  const lastFailure = taskStore.lastFailedTask();
  const lines = [
    `Jarvis Neural Command Interface diagnostics ${packageInfo.version}`,
    `Created: ${new Date().toISOString()}`,
    '',
    '--- Install ---',
    JSON.stringify(install, null, 2),
    '',
    '--- Provider ---',
    JSON.stringify({
      providerHealth,
      localModel: config.localModel,
      modelKey: modelKeyStatus(),
      codex
    }, null, 2),
    '',
    '--- Queue ---',
    JSON.stringify(taskRunner.queueStatus(), null, 2),
    '',
    '--- Last Failure ---',
    JSON.stringify(lastFailure ? {
      id: lastFailure.id,
      status: lastFailure.status,
      phase: lastFailure.phase,
      providerUsed: lastFailure.providerUsed,
      failureKind: lastFailure.failureKind,
      failureAction: lastFailure.failureAction,
      timing: lastFailure.timing,
      prompt: lastFailure.prompt,
      output: String(lastFailure.output ?? '').slice(-1800)
    } : null, null, 2),
    '',
    '--- Update ---',
    JSON.stringify({ update, updateDownloadState }, null, 2),
    '',
    '--- Storage ---',
    JSON.stringify({
      dataDir: storage.dataDir,
      totalSize: storage.totalSize,
      updates: storage.updates,
      backups: { path: storage.backups.path, size: storage.backups.size, count: storage.backups.count },
      logs: storage.logs,
      memory: storage.memory
    }, null, 2),
    '',
    '--- Log Tail ---',
    readLogTail(logPath, 64000) || 'No log output yet.'
  ];
  fs.writeFileSync(bundlePath, lines.join('\n'));
  return { path: bundlePath, size: fs.statSync(bundlePath).size };
}

function safeBackupId(value) {
  return String(value ?? 'backup').replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 120) || 'backup';
}

function compareVersions(a, b) {
  const left = String(a ?? '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = String(b ?? '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function uniqueById(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.id)) {
      return false;
    }
    seen.add(row.id);
    return true;
  });
}

function checkCodexStatus(command) {
  return new Promise((resolve) => {
    const child = spawnVersionCommand(command);
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', (error) => {
      resolve({ command, available: false, detail: error.message });
    });
    child.on('exit', (code) => {
      resolve({
        command,
        available: code === 0,
        detail: output.trim() || (code === 0 ? 'Codex command is available.' : `Codex exited with code ${code}.`)
      });
    });
  });
}

function spawnVersionCommand(command) {
  if (process.platform === 'win32') {
    const commandLine = [command, '--version'].map(quoteCmdArg).join(' ');
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', commandLine], {
      shell: false,
      windowsHide: true,
      env: process.env
    });
  }

  return spawn(command, ['--version'], {
    shell: false,
    env: process.env
  });
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[ \t"&<>|^]/.test(text)) {
    return text;
  }
  return `"${text.replace(/(["^&<>|])/g, '^$1')}"`;
}

function loadLocalModelState(config, statePath) {
  try {
    if (!fs.existsSync(statePath)) {
      return;
    }
    const saved = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const provider = normalizeProvider(saved.provider);
    config.localModel = {
      provider,
      endpoint: String(saved.endpoint ?? defaultEndpoint(provider)).trim(),
      model: String(saved.model ?? defaultModel(provider)).trim()
    };
    config.codex.model = config.localModel.model;
  } catch (error) {
    console.warn(`Unable to load local model settings: ${error.message}`);
  }
}

function loadModelSecrets(secretPath) {
  try {
    if (!fs.existsSync(secretPath)) {
      return;
    }
    const saved = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
    const apiKey = String(saved?.opencodeApiKey ?? '').trim();
    if (apiKey) {
      process.env.OPENCODE_API_KEY = apiKey;
    }
  } catch (error) {
    console.warn(`Unable to load model secret settings: ${error.message}`);
  }
}

function saveModelSecret(secretPath, apiKey) {
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  fs.writeFileSync(secretPath, JSON.stringify({ opencodeApiKey: apiKey }, null, 2));
}

function modelKeyStatus() {
  return {
    present: Boolean(process.env.OPENCODE_API_KEY),
    source: fs.existsSync(modelSecretPath)
      ? 'userData'
      : process.env.OPENCODE_API_KEY ? 'environment' : 'missing'
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
  return 'opencode';
}

function defaultEndpoint(provider) {
  const normalized = normalizeProvider(provider);
  if (normalized === 'ollama') {
    return 'http://127.0.0.1:11434';
  }
  if (normalized === 'lmstudio') {
    return 'http://127.0.0.1:1234/v1';
  }
  if (normalized === 'codex') {
    return '';
  }
  return 'https://opencode.ai/zen/v1';
}

function defaultModel(provider) {
  const normalized = normalizeProvider(provider);
  if (normalized === 'codex') return 'gpt-5.5';
  if (normalized === 'opencode') return 'minimax-m2.5-free';
  return '';
}

async function listLocalModels(providerInput, endpointInput) {
  const provider = normalizeProvider(providerInput);
  const endpoint = String(endpointInput ?? defaultEndpoint(provider)).trim() || defaultEndpoint(provider);
  if (provider === 'opencode' && !process.env.OPENCODE_API_KEY) {
    const failureKind = 'auth';
    return {
      provider,
      endpoint,
      available: false,
      models: opencodeFreeModels,
      failureKind,
      failureAction: providerFailureAction(failureKind),
      detail: 'Missing OpenCode API key. Save a key to scan live models.'
    };
  }
  const baseUrl = endpoint.replace(/\/+$/, '');
  const target = provider === 'ollama' ? `${baseUrl}/api/tags` : `${baseUrl}/models`;
  try {
    const headers = provider === 'opencode' && process.env.OPENCODE_API_KEY
      ? { Authorization: `Bearer ${process.env.OPENCODE_API_KEY}` }
      : undefined;
    const response = await fetch(target, { headers, signal: AbortSignal.timeout(3500) });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data?.error?.message ?? data?.error ?? `${response.status} ${response.statusText}`);
      error.status = response.status;
      throw error;
    }
    const models = provider === 'ollama'
      ? (data.models ?? []).map((model) => model.name).filter(Boolean)
      : (data.data ?? []).map((model) => model.id).filter(Boolean);
    const sortedModels = provider === 'opencode' ? prioritizeOpencodeModels(models) : models;
    return {
      provider,
      endpoint,
      available: true,
      models: sortedModels,
      detail: sortedModels.length > 0 ? `${sortedModels.length} model${sortedModels.length === 1 ? '' : 's'} detected.` : 'Server is online, but no models were reported.'
    };
  } catch (error) {
    if (provider === 'opencode') {
      const failureKind = classifyProviderFailure(error);
      return {
        provider,
        endpoint,
        available: false,
        models: opencodeFreeModels,
        failureKind,
        failureAction: providerFailureAction(failureKind),
        detail: `${error instanceof Error ? error.message : 'OpenCode Zen is not reachable.'} Showing preset free models.`
      };
    }
    const failureKind = classifyProviderFailure(error);
    return {
      provider,
      endpoint,
      available: false,
      models: [],
      failureKind,
      failureAction: providerFailureAction(failureKind),
      detail: error instanceof Error ? error.message : 'Local model server is not reachable.'
    };
  }
}

function prioritizeOpencodeModels(models) {
  const unique = [...new Set([...opencodeFreeModels, ...models])];
  return unique.sort((a, b) => {
    const aFree = opencodeFreeModels.indexOf(a);
    const bFree = opencodeFreeModels.indexOf(b);
    if (aFree !== -1 || bFree !== -1) {
      return (aFree === -1 ? 999 : aFree) - (bFree === -1 ? 999 : bFree);
    }
    return a.localeCompare(b);
  });
}
