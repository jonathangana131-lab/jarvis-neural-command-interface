import { spawn } from 'node:child_process';
import path from 'node:path';

const npmCli = process.env.npm_execpath
  || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const commands = [
  ['server', process.execPath, [npmCli, 'run', 'dev:server']],
  ['client', process.execPath, [npmCli, 'run', 'dev:client']]
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.on('data', (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[${name}] ${data}`));
  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });
  return child;
});

function stop() {
  for (const child of children) {
    child.kill();
  }
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
