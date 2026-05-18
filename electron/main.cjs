const { app, BrowserWindow, Menu, Tray, globalShortcut, nativeTheme } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const backendPort = Number(process.env.PORT || 8787);
const bundledUrl = `http://127.0.0.1:${backendPort}`;
const externalUrl = process.env.JARVIS_CODEX_URL;
let backend = null;
let backendLog = '';
let mainWindow = null;
let tray = null;

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
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
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

    await createWindow(appUrl);
    setupTray(appUrl);
    setupGlobalShortcuts();

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
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  tray = new Tray(iconPath);
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
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
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
