const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const targetUrl = process.env.JARVIS_CAPTURE_URL || 'http://127.0.0.1:5173';
const outputDir = path.resolve(process.env.JARVIS_CAPTURE_DIR || 'visual-evidence');
const prefix = process.env.JARVIS_CAPTURE_PREFIX || 'capture';
const views = (process.env.JARVIS_CAPTURE_VIEWS || 'run,dashboard,memory,settings')
  .split(',')
  .map((view) => view.trim())
  .filter(Boolean);

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('force-color-profile', 'srgb');

app.whenReady().then(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1440,
    minHeight: 900,
    show: false,
    frame: false,
    backgroundColor: '#03070d',
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  await window.loadURL(targetUrl);
  await window.webContents.executeJavaScript(`
    localStorage.setItem('jarvis.setup.v1.complete', 'true');
    localStorage.setItem('jarvis.chat.layoutMode', 'cockpit');
  `);
  await window.webContents.reload();
  await waitForReady(window);
  await delay(2400);

  for (const view of views) {
    await window.webContents.executeJavaScript(`
      (() => {
        const button = document.querySelector('[data-console-tab="${escapeJs(view)}"]');
        if (!button) throw new Error('Missing view button: ${escapeJs(view)}');
        button.click();
        window.scrollTo(0, 0);
      })()
    `);
    await delay(view === 'run' ? 1600 : 900);
    const image = await window.webContents.capturePage();
    fs.writeFileSync(path.join(outputDir, `${prefix}-${view}.png`), image.toPNG());
  }

  const hasCommandMenu = await window.webContents.executeJavaScript("Boolean(document.querySelector('#command-menu-toggle'))");
  if (hasCommandMenu && prefix.includes('after')) {
    await window.webContents.executeJavaScript("document.querySelector('#command-menu-toggle').click()");
    await delay(500);
    const image = await window.webContents.capturePage();
    fs.writeFileSync(path.join(outputDir, `${prefix}-command-menu.png`), image.toPNG());
  }

  window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});

async function waitForReady(window) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 45_000) {
    const ready = await window.webContents.executeJavaScript(`
      (() => {
        const workspace = document.querySelector('#workspace')?.textContent?.trim();
        const wizard = document.querySelector('#setup-wizard');
        return Boolean(workspace && workspace !== 'Loading' && wizard?.classList.contains('hidden'));
      })()
    `).catch(() => false);
    if (ready) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for Jarvis UI at ${targetUrl}`);
}

function escapeJs(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
