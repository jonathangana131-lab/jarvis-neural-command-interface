import { spawn } from 'node:child_process';

const smoke = process.argv.includes('--smoke');
const url = process.env.JARVIS_CODEX_URL || 'http://127.0.0.1:5173';
const backendUrl = process.env.JARVIS_CODEX_BACKEND_URL || 'http://127.0.0.1:8787/api/config';

const children = [];

try {
  if (!(await reachable(backendUrl))) {
    children.push(start('server', 'npm', ['run', 'dev:server']));
  }
  if (!(await reachable(url))) {
    children.push(start('client', 'npm', ['run', 'dev:client']));
  }

  await waitFor(backendUrl, 30000);
  await waitFor(url, 30000);
  if (smoke) {
    console.log(`Desktop smoke ready: ${url}`);
    stop();
    process.exitCode = 0;
  }
  if (!smoke) {
    const electron = spawn('npx', ['electron', 'electron/main.cjs'], {
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, JARVIS_CODEX_URL: url }
    });

    electron.on('exit', (code) => {
      stop();
      process.exit(code ?? 0);
    });
  }
} catch (error) {
  stop();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

function stop() {
  for (const child of children) {
    child.kill();
  }
}

function start(name, command, args) {
  const child = spawn(command, args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[${name}] ${data}`));
  return child;
}

async function reachable(targetUrl) {
  try {
    const response = await fetch(targetUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitFor(targetUrl, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Timed out waiting for ${targetUrl}`);
}

process.on('SIGINT', () => {
  stop();
  process.exit(130);
});
process.on('SIGTERM', () => {
  stop();
  process.exit(143);
});
