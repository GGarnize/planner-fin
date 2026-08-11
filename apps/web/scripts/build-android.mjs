import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const variant = process.argv[2];
if (!['debug', 'internal'].includes(variant)) {
  throw new Error('Uso: node scripts/build-android.mjs debug|internal');
}

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const apiUrl = process.env.VITE_API_BASE_URL ?? '';
if (
  variant === 'internal' &&
  (!apiUrl || !apiUrl.startsWith('https://') || !apiUrl.endsWith('/api'))
) {
  throw new Error('Build internal exige VITE_API_BASE_URL HTTPS terminado em /api.');
}
if (variant === 'internal') {
  for (const name of [
    'PLANNER_FIN_KEYSTORE_FILE',
    'PLANNER_FIN_KEYSTORE_PASSWORD',
    'PLANNER_FIN_KEY_ALIAS',
    'PLANNER_FIN_KEY_PASSWORD',
  ]) {
    if (!process.env[name]) throw new Error(`Build internal exige ${name}.`);
  }
}

run('node', ['scripts/validate-android.mjs']);
run(
  process.platform === 'win32' ? 'gradlew.bat' : './gradlew',
  [variant === 'debug' ? 'assembleDebug' : 'assembleInternal'],
  'android',
);

if (variant === 'internal') {
  const source = join('android', 'app', 'build', 'outputs', 'apk', 'internal', 'app-internal.apk');
  const targetDir = join('..', '..', 'artifacts', 'android');
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(source, join(targetDir, `planner-fin-${version}-internal.apk`));
}

function run(command, args, cwd = '.') {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`Comando falhou: ${command} ${args.join(' ')}`);
  }
}
