const { app, BrowserWindow, Menu, nativeTheme } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');

const backendPort = Number(process.env.PORT || 8787);
const bundledUrl = `http://127.0.0.1:${backendPort}`;
const externalUrl = process.env.JARVIS_CODEX_URL;
let backend = null;

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
  await window.loadURL(appUrl);
}

if (singleInstanceLock) {
  app.whenReady().then(async () => {
    const appUrl = externalUrl || bundledUrl;
    if (!externalUrl) {
      startBackend();
      await waitFor(`${bundledUrl}/api/config`, 30000);
    }

    await createWindow(appUrl);

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
  backend.stdout.on('data', (data) => process.stdout.write(`[backend] ${data}`));
  backend.stderr.on('data', (data) => process.stderr.write(`[backend] ${data}`));
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
