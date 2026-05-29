const { app, BrowserWindow, Menu, Tray, dialog, globalShortcut, ipcMain, nativeTheme } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (error) {
  console.warn(`Auto updater is unavailable: ${error.message}`);
}

const backendPort = Number(process.env.PORT || 8787);
const bundledUrl = `http://127.0.0.1:${backendPort}`;
const externalUrl = process.env.JARVIS_CODEX_URL;
const appUserModelId = 'local.jarvis.neural-command-interface';
const updateRepository = process.env.JARVIS_UPDATE_REPO || 'jonathangana131-lab/jarvis-neural-command-interface';
// Windows uses the multi-resolution .ico; macOS/Linux need a PNG (the Tray API
// rejects .ico on macOS, and Linux window icons expect PNG). The PNG is produced
// at build time (scripts/prepare-mac-icon.mjs); fall back to the .ico if it is
// missing (e.g. an un-prepared dev run) so startup never breaks.
function resolveBrandIcon() {
  const pngIcon = path.join(__dirname, '..', 'build', 'icon.png');
  const icoIcon = path.join(__dirname, '..', 'build', 'icon.ico');
  if (process.platform === 'win32') {
    return icoIcon;
  }
  return fs.existsSync(pngIcon) ? pngIcon : icoIcon;
}
const brandIconPath = resolveBrandIcon();
let backend = null;
let backendLog = '';
let mainWindow = null;
let tray = null;

app.setAppUserModelId(appUserModelId);

const userDataOverride = process.env.JARVIS_USER_DATA_DIR;
if (userDataOverride) {
  const userDataDir = path.resolve(userDataOverride);
  fs.mkdirSync(userDataDir, { recursive: true });
  app.setPath('userData', userDataDir);
}

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) {
      return;
    }
    if (window.isMinimized()) {
      window.restore();
    }
    window.focus();
  });
}

async function createWindow(appUrl) {
  nativeTheme.themeSource = 'dark';
  Menu.setApplicationMenu(null);

  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: '#081018',
    title: 'Jarvis Neural Command Interface',
    icon: brandIconPath,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true
    }
  });

  window.once('ready-to-show', () => {
    window.show();
  });
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
  await window.loadURL(appUrl);
  mainWindow = window;
  return window;
}

if (singleInstanceLock) {
  app.whenReady().then(async () => {
    const appUrl = externalUrl || bundledUrl;
    if (!externalUrl) {
      startBackend();
      try {
        await waitFor(`${bundledUrl}/api/config`, 45000);
      } catch (error) {
        await createStartupErrorWindow(error);
        return;
      }
    }

    const window = await createWindow(appUrl);
    setupTray(appUrl);
    setupGlobalShortcuts();
    setupAutoUpdates(window);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow(appUrl);
      }
    });
  }).catch((error) => {
    console.error(error);
    app.quit();
  });
}

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  backend?.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('jarvis:update-install', async (_event, payload = {}) => {
  return scheduleVerifiedUpdateInstall(payload);
});
ipcMain.handle('jarvis:update-check', async () => {
  if (!autoUpdater) throw new Error('Auto updater not available');
  const result = await autoUpdater.checkForUpdates();
  return {
    updateAvailable: result.updateInfo.version !== app.getVersion(),
    version: result.updateInfo.version
  };
});
ipcMain.handle('jarvis:update-download', async () => {
  if (!autoUpdater) throw new Error('Auto updater not available');
  await autoUpdater.downloadUpdate();
  return { started: true };
});
ipcMain.handle('jarvis:update-install-native', async () => {
  if (!autoUpdater) throw new Error('Auto updater not available');
  try {
    const response = await fetch(`http://127.0.0.1:${backendPort}/api/backups/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) {
      console.log('[updater] Pre-update user backup created successfully.');
    }
  } catch (error) {
    console.warn('[updater] Failed to create database backup before update installation:', error.message);
  }
  autoUpdater.quitAndInstall(true, true);
  return { installed: true };
});

function setupAutoUpdates(window) {
  if (!autoUpdater || !app.isPackaged || process.env.JARVIS_DISABLE_AUTO_UPDATE === '1') {
    return;
  }

  const [owner, repo] = updateRepository.split('/');
  if (!owner || !repo) {
    console.warn(`[updater] Invalid update repository: ${updateRepository}`);
    return;
  }

  autoUpdater.setFeedURL({ provider: 'github', owner, repo });
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  const sendStatus = (status) => {
    if (window && !window.isDestroyed()) {
      window.webContents.send('jarvis:update-status', status);
    }
  };

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for update');
    sendStatus({ status: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] Update ${info.version} is available through the in-app updater`);
    sendStatus({ status: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[updater] App is up to date');
    sendStatus({ status: 'current' });
  });
  autoUpdater.on('error', (error) => {
    console.warn(`[updater] ${error.message}`);
    sendStatus({ status: 'failed', error: error.message });
  });
  autoUpdater.on('download-progress', (progressObj) => {
    sendStatus({
      status: 'downloading',
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[updater] Update ${info.version} downloaded and ready`);
    sendStatus({ status: 'ready', version: info.version });
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.warn(`[updater] Update check failed: ${error.message}`);
    });
  }, 5000);
}

function scheduleVerifiedUpdateInstall(payload) {
  if (process.platform !== 'win32') {
    throw new Error('Desktop update install is only available on Windows.');
  }
  const installerPath = path.resolve(String(payload.installerPath || ''));
  const updatesDir = path.join(app.getPath('userData'), 'data', 'updates');
  if (!isSubpath(updatesDir, installerPath) || path.extname(installerPath).toLowerCase() !== '.exe' || !fs.existsSync(installerPath)) {
    throw new Error('Installer path is not a verified Jarvis update download.');
  }
  const expectedSha256 = String(payload.sha256 || payload.expectedSha256 || '').trim();
  if (expectedSha256) {
    const actualSha256 = sha256File(installerPath);
    if (actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
      throw new Error('Installer checksum changed after verification. Download the update again.');
    }
  }

  const handoffScript = writeUpdateHandoffScript(installerPath, String(payload.version || '').trim());
  const child = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    handoffScript
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();

  setTimeout(() => app.quit(), 250);
  return {
    scheduled: true,
    message: 'Jarvis will close, install the verified update after the app exits, then reopen automatically.'
  };
}

function writeUpdateHandoffScript(installerPath, targetVersion = '') {
  const userData = app.getPath('userData');
  const scriptPath = path.join(userData, 'run-verified-update.ps1');
  const logPath = path.join(userData, 'update-install.log');
  const currentPid = process.pid;
  const backendPid = backend?.pid || 0;
  const currentExe = process.execPath;
  const installDir = path.dirname(currentExe);
  const fallbackExe = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Jarvis Neural Command Interface', 'Jarvis Neural Command Interface.exe');
  const startMenuShortcut = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Jarvis Neural Command Interface', 'Jarvis Neural Command Interface.lnk');
  const desktopShortcut = path.join(process.env.USERPROFILE || '', 'Desktop', 'Jarvis Neural Command Interface.lnk');
  const lines = [
    '$ErrorActionPreference = "Continue"',
    `$installer = ${psQuote(installerPath)}`,
    `$targetVersion = ${psQuote(targetVersion)}`,
    `$currentPid = ${currentPid}`,
    `$backendPid = ${backendPid}`,
    `$currentExe = ${psQuote(currentExe)}`,
    `$fallbackExe = ${psQuote(fallbackExe)}`,
    `$installDir = ${psQuote(installDir)}`,
    '$shortcutIcon = Join-Path $installDir "resources\\app\\build\\icon.ico"',
    `$startMenuShortcut = ${psQuote(startMenuShortcut)}`,
    `$desktopShortcut = ${psQuote(desktopShortcut)}`,
    `$log = ${psQuote(logPath)}`,
    'function Log($message) { Add-Content -LiteralPath $log -Value "[$(Get-Date -Format o)] $message" }',
    'function VersionOf($exe) { try { if (Test-Path -LiteralPath $exe) { return [string]((Get-Item -LiteralPath $exe).VersionInfo.ProductVersion) } } catch {} return "" }',
    'function RepairShortcut($shortcutPath, $target) {',
    '  try {',
    '    if (-not $shortcutPath -or -not $target -or -not (Test-Path -LiteralPath $target)) { return }',
    '    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $shortcutPath) | Out-Null',
    '    $shell = New-Object -ComObject WScript.Shell',
    '    $shortcut = $shell.CreateShortcut($shortcutPath)',
    '    $shortcut.TargetPath = $target',
    '    $shortcut.WorkingDirectory = Split-Path -Parent $target',
    '    $shortcut.IconLocation = if (Test-Path -LiteralPath $shortcutIcon) { $shortcutIcon } else { "$target,0" }',
    '    $shortcut.Description = "Jarvis Neural Command Interface"',
    '    $shortcut.Save()',
    '    Log "Shortcut repaired: $shortcutPath -> $target"',
    '  } catch { Log "Shortcut repair failed for ${shortcutPath}: $($_.Exception.Message)" }',
    '}',
    'New-Item -ItemType Directory -Force -Path (Split-Path -Parent $log) | Out-Null',
    'Log "Waiting for Jarvis to exit before installing update."',
    'try { Wait-Process -Id $currentPid -Timeout 120 -ErrorAction SilentlyContinue } catch {}',
    'if ($backendPid -gt 0) { try { Wait-Process -Id $backendPid -Timeout 45 -ErrorAction SilentlyContinue } catch {} }',
    'Start-Sleep -Seconds 2',
    'Log "Starting verified installer: $installer"',
    '$installerProcess = Start-Process -FilePath $installer -ArgumentList @("/S") -PassThru',
    '$installerFinished = $installerProcess.WaitForExit(600000)',
    'if ($installerFinished) {',
    '  Log "Installer exited with code $($installerProcess.ExitCode)."',
    '} else {',
    '  Log "Installer did not exit before timeout; checking installed version before cleanup."',
    '  try { Stop-Process -Id $installerProcess.Id -Force -ErrorAction SilentlyContinue } catch {}',
    '}',
    'Start-Sleep -Seconds 2',
    '$candidates = @($currentExe, $fallbackExe) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }',
    'if ($candidates.Count -gt 0) {',
    '  $targetExe = $candidates[0]',
    '  $installedVersion = VersionOf $targetExe',
    '  Log "Installed Jarvis candidate: $targetExe version $installedVersion."',
    '  if ($targetVersion -and $installedVersion -and $installedVersion -ne $targetVersion) { Log "Expected version $targetVersion but found $installedVersion." }',
    '  RepairShortcut $desktopShortcut $targetExe',
    '  RepairShortcut $startMenuShortcut $targetExe',
    '  Log "Restarting Jarvis from $targetExe."',
    '  Start-Process -FilePath $targetExe -WorkingDirectory (Split-Path -Parent $targetExe)',
    '} else {',
    '  Log "Jarvis executable was not found after install."',
    '}'
  ];
  fs.writeFileSync(scriptPath, lines.join('\r\n'));
  return scriptPath;
}

function isSubpath(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function sha256File(targetPath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(targetPath));
  return hash.digest('hex').toUpperCase();
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function startBackend() {
  const rootDir = path.resolve(__dirname, '..');
  const serverEntry = path.join(rootDir, 'server', 'index.mjs');
  const nodeCommand = process.env.JARVIS_NODE_COMMAND || process.execPath;
  const usingElectronAsNode = !process.env.JARVIS_NODE_COMMAND;
  const dataDir = path.join(app.getPath('userData'), 'data');
  const secretDir = path.join(app.getPath('userData'), 'secrets');
  backend = spawn(nodeCommand, ['--experimental-sqlite', serverEntry], {
    cwd: rootDir,
    env: {
      ...process.env,
      ...(usingElectronAsNode ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
      PORT: String(backendPort),
      JARVIS_CONFIG: path.join(rootDir, 'jarvis.config.json'),
      JARVIS_DATA_DIR: dataDir,
      JARVIS_SECRET_DIR: secretDir
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  backend.stdout.on('data', (data) => {
    appendBackendLog(data);
    process.stdout.write(`[backend] ${data}`);
  });
  backend.stderr.on('data', (data) => {
    appendBackendLog(data);
    process.stderr.write(`[backend] ${data}`);
  });
}

function setupTray(appUrl) {
  if (tray) {
    return;
  }
  try {
    tray = new Tray(brandIconPath);
  } catch (error) {
    console.warn(`[tray] Unable to create tray icon (${error.message}); continuing without a tray.`);
    return;
  }
  tray.setToolTip('Jarvis Neural Command Interface');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Jarvis', click: () => showMainWindow(appUrl) },
    { label: 'Hide Jarvis', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]));
  tray.on('click', () => toggleMainWindow(appUrl));
}

function setupGlobalShortcuts() {
  globalShortcut.register('CommandOrControl+Alt+J', () => toggleMainWindow(externalUrl || bundledUrl));
}

function showMainWindow(appUrl) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    void createWindow(appUrl);
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function toggleMainWindow(appUrl) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) {
    showMainWindow(appUrl);
    return;
  }
  mainWindow.hide();
}

async function createStartupErrorWindow(error) {
  nativeTheme.themeSource = 'dark';
  Menu.setApplicationMenu(null);
  const window = new BrowserWindow({
    width: 860,
    height: 560,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#081018',
    title: 'Jarvis Neural Command Interface - Startup Issue',
    icon: brandIconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true
    }
  });
  const message = escapeHtml(error instanceof Error ? error.message : String(error));
  const log = escapeHtml(backendLog.trim() || 'No backend output was captured.');
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Jarvis Startup Issue</title>
    <style>
      body { margin: 0; background: #081018; color: #d9fbff; font: 14px/1.5 system-ui, sans-serif; }
      main { max-width: 760px; margin: 48px auto; padding: 0 24px; }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { color: #9fbac2; }
      code, pre { background: rgba(115, 243, 255, 0.08); border: 1px solid rgba(115, 243, 255, 0.18); }
      code { padding: 2px 5px; border-radius: 4px; }
      pre { overflow: auto; max-height: 240px; padding: 14px; color: #c8f8ff; border-radius: 8px; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <main>
      <h1>Jarvis could not start its local service.</h1>
      <p>The desktop shell opened, but the backend did not become ready. Restart the app once; if it still fails, check that security software is not blocking the app's local Node process.</p>
      <p><strong>Error:</strong> <code>${message}</code></p>
      <h2>Backend log</h2>
      <pre>${log}</pre>
    </main>
  </body>
</html>`)}`);
}

function appendBackendLog(data) {
  backendLog = `${backendLog}${data.toString()}`.slice(-12000);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (match) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[match]);
}

async function waitFor(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}
