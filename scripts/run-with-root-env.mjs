import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRootEnv } from './root-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Uso: node scripts/run-with-root-env.mjs <comando> [...argumentos]');
  process.exit(1);
}

try {
  loadRootEnv(root);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha ao carregar o .env raiz.');
  process.exit(1);
}

if (process.platform === 'win32' && !/^[a-zA-Z0-9_.-]+$/.test(command)) {
  console.error('O comando do wrapper contém caracteres não permitidos no Windows.');
  process.exit(1);
}
const commandLine = [
  command,
  ...args.map((value) => `"${value.replaceAll('"', '""')}"`),
].join(' ');
const child = spawn(process.platform === 'win32' ? commandLine : command, process.platform === 'win32' ? [] : args, {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.once('error', (error) => {
  console.error(`Não foi possível iniciar ${command}: ${error.message}`);
  process.exitCode = 1;
});

child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
