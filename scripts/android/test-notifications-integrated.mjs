import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const requireFromApi = createRequire(join(root, 'apps', 'api', 'package.json'));
const { PrismaClient } = requireFromApi('@prisma/client');
const dotEnv = readDotEnv();
const databaseName = 'planner_fin_spec022_integrated';
const databaseUrl = `postgresql://planner_fin_local:planner_fin_local@localhost:5432/${databaseName}?schema=public`;
const apiBaseUrl = 'https://10.0.2.2:3443/api';
const avdName = 'Pixel_7_Pro';
const plannerPackage = 'com.plannerfin.app';
const listenerComponent = `${plannerPackage}/.PlannerFinNotificationListenerService`;
const debugReceiver = `${plannerPackage}/.PlannerFinNotificationDebugReceiver`;
const monitoredPackage = 'com.plannerfin.notificationtest';
const emitterAction = 'com.plannerfin.notificationtest.POST';
const emitterReceiver = 'com.plannerfin.notificationemitter.NotificationEmitterReceiver';
const userA = { email: 'spec022-a@planner-fin.test', password: 'PlannerFinLocal123!' };
const userB = { email: 'spec022-b@planner-fin.test', password: 'PlannerFinLocal123!' };
const androidHome =
  process.env.ANDROID_HOME ??
  process.env.ANDROID_SDK_ROOT ??
  join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const adb = commandPath('adb');
const emulator = commandPath('emulator');
const gradlew = join(root, 'apps', 'web', 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const env = {
  ...process.env,
  ...dotEnv,
  ALLOW_LOCAL_TEST_SEED: 'true',
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  API_CORS_ORIGINS: 'http://localhost:9000,https://localhost',
  API_HOST: '127.0.0.1',
  API_PORT: '3000',
  COOKIE_SECURE: 'true',
  DATABASE_URL: databaseUrl,
  PATH: [
    join(root, '.tools', 'node-v22.18.0-win-x64'),
    join(androidHome, 'platform-tools'),
    join(androidHome, 'emulator'),
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.2.13-hotspot\\bin',
    process.env.PATH ?? '',
  ].join(process.platform === 'win32' ? ';' : ':'),
  VITE_API_BASE_URL: apiBaseUrl,
};

let serial = '';
let apiProcess;
let proxyProcess;
let prisma;
const results = [];

main()
  .catch((error) => {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect().catch(() => undefined);
    stopProcess(proxyProcess);
    stopProcess(apiProcess);
  });

async function main() {
  step('Validando ferramentas locais');
  ensureExists(adb, 'adb');
  ensureExists(emulator, 'emulator');
  ensureExists(gradlew, 'Gradle wrapper Android');
  ensureExists(join(root, '.tools', 'certs', 'planner-fin-local.pem'), 'certificado HTTPS local');
  ensureExists(join(root, '.tools', 'certs', 'planner-fin-local-key.pem'), 'chave HTTPS local');

  step('Preparando PostgreSQL sintetico');
  prepareDatabase();
  step('Aplicando migrations');
  run('pnpm', ['db:migrate']);
  step('Compilando API para runtime estavel');
  run('pnpm', ['--filter', '@planner-fin/api', 'build']);
  step('Criando usuarios sinteticos sem sessao');
  seedUser(userA);
  seedUser(userB);
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  step('Iniciando API compilada');
  apiProcess = startProcess('node', [join(root, 'apps', 'api', 'dist', 'main.js')], 'api');
  await waitFor(() => httpHealth('http://127.0.0.1:3000/api/health'), 90000, 'API local');
  step('Iniciando proxy HTTPS local');
  if (!(await httpsHealth('https://127.0.0.1:3443/api/health'))) {
    proxyProcess = startProcess('node', [join(root, 'scripts', 'android', 'https-proxy.mjs')], 'https-proxy');
  }
  await waitFor(() => httpsHealth('https://127.0.0.1:3443/api/health'), 90000, 'proxy HTTPS');

  step('Garantindo AVD Pixel_7_Pro');
  serial = await ensurePixel7Pro();
  console.log(`AVD: ${serial} (${avdName})`);
  step('Build e instalacao dos APKs');
  buildAndInstallApps();
  step('Permissoes Android e listener');
  grantAndAuthorize();

  step('Login real na SPA e binding');
  configureCapture(true, monitoredPackage);
  clearNativeQueue();
  await loginInSpa(userA);
  const bindingA = await waitForDeviceBinding(userA.email);
  const localAfterBind = debugState();
  assertEqual(localAfterBind.ownerBindingId, bindingA.ownerBindingId, 'ownerBindingId local/server');
  assert(localAfterBind.monitoredPackages.includes(monitoredPackage), 'pacote monitorado local');
  pass('Binding SPA autenticada');

  step('Captura com SPA fechada antes do sync');
  closePlannerWithoutForceStop();
  emit(monitoredPackage, 'purchase');
  await waitForQueueCount(1, 'fila antes do sync');
  assertEqual(await capturedCount(userA.email), 0, 'PG antes do sync');
  pass('Queue pre-sync=1 e PG=0');

  step('Reabrindo SPA para sync autenticado');
  await openPlannerAndWaitForSync(userA.email, 1);
  assertEqual(debugState().pendingCount, 0, 'fila apos ACK');
  const first = await onlyCaptured(userA.email);
  assertEqual(first.packageName, monitoredPackage, 'packageName PG');
  assertEqual(first.status, 'FINANCIAL_CANDIDATE', 'status PG');
  assertEqual(first.parsedType, 'EXPENSE', 'parsedType PG');
  assertEqual(first.parsedAmount?.toFixed(2), '42.90', 'parsedAmount PG');
  assertEqual(first.device.ownerBindingId, bindingA.ownerBindingId, 'device PG');
  assertNoNativeCredentialPlaintext();
  pass('Sync SPA -> PG=1 -> ACK limpa fila');

  step('Validando retry/idempotencia');
  await testDuplicateRetry(userA.email);
  step('Validando falha de rede');
  await testNetworkFailure(userA.email);
  step('Validando logout e troca de owner');
  await testLogoutAndOwnerIsolation(bindingA.ownerBindingId);

  console.log('\nMatriz integrada:');
  for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}`);
  if (results.some((result) => !result.ok)) process.exit(1);
}

function prepareDatabase() {
  run('docker', ['compose', 'up', '-d', 'postgres']);
  run('docker', ['compose', 'exec', '-T', 'postgres', 'dropdb', '-U', 'planner_fin_local', '--if-exists', databaseName]);
  run('docker', ['compose', 'exec', '-T', 'postgres', 'createdb', '-U', 'planner_fin_local', databaseName]);
}

function seedUser(user) {
  run('pnpm', ['--filter', '@planner-fin/api', 'dev:seed-test-user'], {
    env: { PLANNER_FIN_TEST_EMAIL: user.email, PLANNER_FIN_TEST_PASSWORD: user.password },
  });
}

function buildAndInstallApps() {
  run('pnpm', ['--filter', '@planner-fin/web', 'android:build:debug']);
  run(gradlew, [
    '-p',
    join(root, 'tools', 'android', 'notification-emitter'),
    'assembleNotificationTestDebug',
  ]);
  const plannerApk = join(root, 'apps', 'web', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const testApk = join(
    root,
    'tools',
    'android',
    'notification-emitter',
    'app',
    'build',
    'outputs',
    'apk',
    'notificationTest',
    'debug',
    'app-notificationTest-debug.apk',
  );
  for (const apk of [plannerApk, testApk]) {
    ensureExists(apk, 'APK');
    run(adb, ['-s', serial, 'install', '-r', '-d', apk]);
  }
  run(adb, ['-s', serial, 'shell', 'pm', 'clear', plannerPackage]);
}

function grantAndAuthorize() {
  const sdk = Number(adbShell(['getprop', 'ro.build.version.sdk']).stdout.trim());
  if (sdk >= 33) {
    run(adb, ['-s', serial, 'shell', 'pm', 'grant', monitoredPackage, 'android.permission.POST_NOTIFICATIONS']);
  }
  run(adb, ['-s', serial, 'shell', 'cmd', 'notification', 'allow_listener', listenerComponent]);
  assert(
    waitForSync(() =>
      adbShell(['settings', 'get', 'secure', 'enabled_notification_listeners']).stdout.includes(
        'PlannerFinNotificationListenerService',
      ),
    ),
    'listener autorizado',
  );
}

async function loginInSpa(user) {
  run(adb, ['-s', serial, 'shell', 'am', 'start', '-n', `${plannerPackage}/.MainActivity`]);
  const cdp = await connectWebView();
  try {
    await waitFor(async () => {
      const text = await cdpEval(cdp, 'document.body ? document.body.innerText : ""');
      return String(text).includes('Entrar') || locationPath(text);
    }, 60000, 'SPA carregar login');
    await cdpEval(
      cdp,
      `(async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        history.pushState(null, '', '/login');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await sleep(500);
        const email = document.querySelector('input[type=email]');
        const password = document.querySelector('input[type=password]');
        if (!email || !password) throw new Error('campos de login ausentes');
        email.value = ${JSON.stringify(user.email)};
        email.dispatchEvent(new Event('input', { bubbles: true }));
        password.value = ${JSON.stringify(user.password)};
        password.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('form').requestSubmit();
        return true;
      })()`,
    );
    await waitFor(async () => {
      const value = await cdpEval(cdp, 'location.pathname + "|" + document.body.innerText');
      return String(value).includes('/dashboard') && !String(value).includes('E-mail ou senha');
    }, 90000, `login SPA ${user.email}`);
  } finally {
    cdp.close();
  }
}

async function openPlannerAndWaitForSync(email, expectedCount) {
  run(adb, ['-s', serial, 'shell', 'am', 'start', '-n', `${plannerPackage}/.MainActivity`]);
  await triggerSpaLifecycleSync();
  await waitFor(async () => (await capturedCount(email)) === expectedCount && debugState().pendingCount === 0, 90000, 'sync SPA');
}

async function triggerSpaLifecycleSync() {
  const cdp = await connectWebView();
  try {
    await cdpEval(
      cdp,
      `(() => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
        return location.pathname;
      })()`,
    );
  } finally {
    cdp.close();
  }
}

async function testDuplicateRetry(email) {
  clearNativeQueue();
  const fixedPostTime = Date.now() - 1000;
  seedNativeQueue('RETRY_DUPLICATE_SPEC022', 'retry-fixed-key', fixedPostTime);
  await openPlannerAndWaitForSync(email, 2);
  seedNativeQueue('RETRY_DUPLICATE_SPEC022', 'retry-fixed-key', fixedPostTime);
  run(adb, ['-s', serial, 'shell', 'am', 'start', '-n', `${plannerPackage}/.MainActivity`]);
  await triggerSpaLifecycleSync();
  await waitFor(async () => (await capturedCount(email)) === 2 && debugState().pendingCount === 0, 90000, 'retry duplicado');
  pass('Retry/idempotencia sem duplicacao');
}

async function testNetworkFailure(email) {
  clearNativeQueue();
  stopProcess(proxyProcess);
  proxyProcess = undefined;
  stopHttpsProxyListener();
  emit(monitoredPackage, 'purchase');
  await waitForQueueCount(1, 'fila durante falha');
  const before = await capturedCount(email);
  run(adb, ['-s', serial, 'shell', 'am', 'start', '-n', `${plannerPackage}/.MainActivity`]);
  await sleep(5000);
  assertEqual(debugState().pendingCount, 1, 'fila preservada sem rede');
  assertEqual(await capturedCount(email), before, 'PG sem rede');
  proxyProcess = startProcess('node', [join(root, 'scripts', 'android', 'https-proxy.mjs')], 'https-proxy');
  await waitFor(() => httpsHealth('https://127.0.0.1:3443/api/health'), 90000, 'proxy HTTPS retomado');
  await openPlannerAndWaitForSync(email, before + 1);
  pass('Falha de rede preserva fila e retoma sync');
}

async function testLogoutAndOwnerIsolation(ownerBindingA) {
  clearNativeQueue();
  emit(monitoredPackage, 'purchase');
  await waitForQueueCount(1, 'fila antes do logout');
  await logoutInSpa();
  const state = debugState();
  assertEqual(state.pendingCount, 0, 'logout purga fila');
  assertEqual(state.captureEnabled, false, 'logout desativa captura');
  assertEqual(state.ownerBindingId, '', 'logout remove binding');
  await loginInSpa(userB);
  configureCapture(true, monitoredPackage);
  run(adb, ['-s', serial, 'shell', 'input', 'keyevent', 'KEYCODE_HOME']);
  run(adb, ['-s', serial, 'shell', 'am', 'start', '-n', `${plannerPackage}/.MainActivity`]);
  await triggerSpaLifecycleSync();
  const bindingB = await waitForDeviceBinding(userB.email);
  assert(bindingB.ownerBindingId !== ownerBindingA, 'owner B deve ter binding distinto');
  assertEqual(debugState().pendingCount, 0, 'owner B nao herda fila');
  pass('Logout real e isolamento entre owners');
}

async function logoutInSpa() {
  run(adb, ['-s', serial, 'shell', 'am', 'start', '-n', `${plannerPackage}/.MainActivity`]);
  const cdp = await connectWebView();
  try {
    await cdpEval(
      cdp,
      `(async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        history.pushState(null, '', '/mais');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await sleep(500);
        const button = [...document.querySelectorAll('button')].find((item) => item.innerText.includes('Sair'));
        if (!button) throw new Error('botao Sair ausente');
        button.click();
        return true;
      })()`,
    );
    await waitFor(async () => String(await cdpEval(cdp, 'location.pathname')).includes('/login'), 60000, 'logout SPA');
  } finally {
    cdp.close();
  }
}

async function waitForDeviceBinding(email) {
  await waitFor(async () => {
    const user = await prisma.user.findUnique({ where: { normalizedEmail: email } });
    if (!user) return false;
    const device = await prisma.notificationDevice.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });
    return (
      !!device?.ownerBindingId &&
      device.captureEnabled &&
      Array.isArray(device.monitoredPackages) &&
      device.monitoredPackages.includes(monitoredPackage)
    );
  }, 90000, `binding ${email}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { normalizedEmail: email } });
  return prisma.notificationDevice.findFirstOrThrow({
    where: { userId: user.id, status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
  });
}

async function capturedCount(email) {
  const user = await prisma.user.findUnique({ where: { normalizedEmail: email } });
  if (!user) return 0;
  return prisma.capturedNotification.count({ where: { userId: user.id } });
}

async function onlyCaptured(email) {
  const user = await prisma.user.findUniqueOrThrow({ where: { normalizedEmail: email } });
  const items = await prisma.capturedNotification.findMany({
    where: { userId: user.id },
    include: { device: true },
    orderBy: { receivedAt: 'desc' },
  });
  assert(items.length >= 1, 'CapturedNotification ausente');
  return items[0];
}

function configureCapture(captureEnabled, packages) {
  debugCommand('configure', ['--ez', 'captureEnabled', String(captureEnabled), '--es', 'packages', packages]);
}

function clearNativeQueue() {
  debugCommand('clear');
  run(adb, ['-s', serial, 'logcat', '-c']);
}

function seedNativeQueue(marker, fixedKey, fixedPostTime) {
  debugCommand('seed', [
    '--ei',
    'count',
    '1',
    '--es',
    'marker',
    marker,
    '--es',
    'fixedKey',
    fixedKey,
    '--el',
    'fixedPostTime',
    String(fixedPostTime),
  ]);
}

function debugState() {
  return JSON.parse(debugCommand('state'));
}

function debugCommand(command, extraArgs = []) {
  const output = run(adb, [
    '-s',
    serial,
    'shell',
    'am',
    'broadcast',
    '-n',
    debugReceiver,
    '-a',
    'com.plannerfin.app.notification.DEBUG',
    '--es',
    'command',
    command,
    ...extraArgs,
  ]).stdout;
  const marker = 'data="';
  const start = output.indexOf(marker);
  const end = output.lastIndexOf('"');
  if (start < 0 || end <= start + marker.length) throw new Error(`Resposta debug invalida: ${output}`);
  return output.slice(start + marker.length, end);
}

function emit(packageName, scenario) {
  run(adb, [
    '-s',
    serial,
    'shell',
    'am',
    'broadcast',
    '-n',
    `${packageName}/${emitterReceiver}`,
    '-a',
    emitterAction,
    '--es',
    'scenario',
    scenario,
  ]);
}

function closePlannerWithoutForceStop() {
  run(adb, ['-s', serial, 'shell', 'input', 'keyevent', 'KEYCODE_HOME']);
  run(adb, ['-s', serial, 'shell', 'am', 'kill', plannerPackage], { allowFailure: true });
}

async function waitForQueueCount(expected, label) {
  await waitFor(() => debugState().pendingCount === expected, 15000, label);
}

function assertNoNativeCredentialPlaintext() {
  const grep = run(
    adb,
    [
      '-s',
      serial,
      'shell',
      'run-as',
      plannerPackage,
      'sh',
      '-c',
      'grep -R "PlannerFinLocal123\\|access-token\\|refresh-token\\|planner_fin_refresh" shared_prefs databases files 2>/dev/null',
    ],
    { allowFailure: true },
  );
  assert(!grep.stdout.trim(), 'storage nativo nao deve conter credencial em claro');
}

async function connectWebView() {
  const pid = await waitFor(async () => adbShell(['pidof', plannerPackage]).stdout.trim(), 60000, 'PID app');
  const socket = `webview_devtools_remote_${pid}`;
  run(adb, ['-s', serial, 'forward', 'tcp:9222', `localabstract:${socket}`], { allowFailure: true });
  const targets = await waitFor(async () => {
    try {
      return JSON.parse(await httpText('http://127.0.0.1:9222/json'));
    } catch {
      return null;
    }
  }, 60000, 'DevTools WebView');
  const target = targets.find((item) => item.webSocketDebuggerUrl) ?? targets[0];
  if (!target?.webSocketDebuggerUrl) throw new Error('WebView sem endpoint CDP');
  return createCdp(target.webSocketDebuggerUrl);
}

function createCdp(url) {
  const ws = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();
  let readyReject;
  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (!data.id || !pending.has(data.id)) return;
    const { resolve: done, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) reject(new Error(JSON.stringify(data.error)));
    else done(data.result);
  });
  ws.addEventListener('error', (event) => {
    const error = new Error(`erro CDP WebSocket: ${event.message ?? 'sem detalhe'}`);
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
    readyReject?.(error);
  });
  const ready = new Promise((resolve, reject) => {
    readyReject = reject;
    ws.addEventListener('open', resolve, { once: true });
  });
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      ws.close();
    },
    ready,
  };
}

async function cdpEval(cdp, expression) {
  await cdp.ready;
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function ensurePixel7Pro() {
  let found = findRunningAvd();
  if (!found) {
    const avds = run(emulator, ['-list-avds']).stdout;
    if (!avds.split(/\r?\n/).includes(avdName)) throw new Error(`AVD ${avdName} nao encontrado.`);
    spawn(emulator, ['-avd', avdName, '-no-snapshot-save'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env,
    }).unref();
  }
  await waitFor(() => {
    found = findRunningAvd();
    return found;
  }, 120000, `AVD ${avdName} iniciar`);
  run(adb, ['-s', found, 'wait-for-device']);
  await waitFor(
    () => run(adb, ['-s', found, 'shell', 'getprop', 'sys.boot_completed']).stdout.trim() === '1',
    120000,
    'boot_completed',
  );
  return found;
}

function findRunningAvd() {
  const devices = run(adb, ['devices']).stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((item) => item.startsWith('emulator-'));
  for (const device of devices) {
    const result = run(adb, ['-s', device, 'emu', 'avd', 'name'], { allowFailure: true });
    if (result.stdout.split(/\r?\n/)[0]?.trim() === avdName) return device;
  }
  return '';
}

function commandPath(name) {
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const candidates = [
    join(androidHome, 'platform-tools', `${name}${suffix}`),
    join(androidHome, 'emulator', `${name}${suffix}`),
    name,
  ];
  for (const candidate of candidates) {
    if (candidate === name || existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function readDotEnv() {
  const path = join(root, '.env');
  if (!existsSync(path)) return {};
  const values = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [name, ...rest] = line.split('=');
    values[name.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

function startProcess(command, args, name) {
  const child = spawn(command, args, {
    cwd: root,
    env,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  return child;
}

function stopProcess(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return;
  }
  child.kill();
}

function stopHttpsProxyListener() {
  if (process.platform !== 'win32') return;
  run(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      [
        '$connection = Get-NetTCPConnection -LocalPort 3443 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1;',
        'if ($connection) {',
        '$process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)";',
        'if ($process.CommandLine -match "https-proxy\\.mjs") { taskkill.exe /PID $connection.OwningProcess /T /F | Out-Null }',
        '}',
      ].join(' '),
    ],
    { allowFailure: true },
  );
}

function adbShell(args) {
  return run(adb, ['-s', serial, 'shell', ...args]);
}

function run(command, args, options = {}) {
  if (!options.quiet) console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: { ...env, ...(options.env ?? {}) },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`comando falhou: ${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  }
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status ?? 0 };
}

function step(label) {
  console.log(`\n== ${label} ==`);
}

function httpHealth(url) {
  return httpText(url).then((body) => body.includes('ok')).catch(() => false);
}

function httpsHealth(url) {
  return new Promise((resolve) => {
    https
      .get(url, { rejectUnauthorized: false }, (response) => {
        response.resume();
        resolve((response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300);
      })
      .on('error', () => resolve(false));
  });
}

function httpText(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => resolve(body));
      })
      .on('error', reject);
  });
}

async function waitFor(predicate, timeoutMs, label) {
  const startedAt = Date.now();
  let last;
  while (Date.now() - startedAt < timeoutMs) {
    last = await predicate();
    if (last) return last;
    await sleep(500);
  }
  throw new Error(`timeout aguardando ${label}`);
}

function waitForSync(predicate, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return true;
    spawnSync(process.platform === 'win32' ? 'powershell.exe' : 'sleep', process.platform === 'win32' ? ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 500'] : ['0.5'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
  }
  return false;
}

function ensureExists(path, label) {
  if ((path.includes('\\') || path.includes('/')) && !existsSync(path)) {
    throw new Error(`${label} nao encontrado em ${path}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, label) {
  assert(actual === expected, `${label}: esperado ${expected}, recebido ${actual}`);
}

function pass(name) {
  results.push({ name, ok: true });
  console.log(`PASS ${name}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function locationPath(value) {
  return typeof value === 'string' && value.includes('/dashboard');
}
