import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const avdName = 'Pixel_7_Pro';
const plannerPackage = 'com.plannerfin.app';
const listenerComponent = `${plannerPackage}/.PlannerFinNotificationListenerService`;
const debugReceiver = `${plannerPackage}/.PlannerFinNotificationDebugReceiver`;
const emitterAction = 'com.plannerfin.notificationtest.POST';
const emitterReceiver = 'com.plannerfin.notificationemitter.NotificationEmitterReceiver';
const monitoredPackage = 'com.plannerfin.notificationtest';
const otherPackage = 'com.plannerfin.notificationother';
const androidHome =
  process.env.ANDROID_HOME ??
  process.env.ANDROID_SDK_ROOT ??
  join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const adb = commandPath('adb');
const emulator = commandPath('emulator');
const gradlew = join(root, 'apps', 'web', 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const env = {
  ...process.env,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  PATH: [
    join(root, '.tools', 'node-v22.18.0-win-x64'),
    join(androidHome, 'platform-tools'),
    join(androidHome, 'emulator'),
    process.env.PATH ?? '',
  ].join(process.platform === 'win32' ? ';' : ':'),
};
let serial = '';
const results = [];

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
});

async function main() {
  ensureExists(adb, 'adb');
  ensureExists(emulator, 'emulator');
  ensureExists(gradlew, 'Gradle wrapper Android');
  serial = await ensurePixel7Pro();
  console.log(`AVD: ${serial} (${avdName})`);

  buildPlannerFin();
  buildEmitter();
  installApks();
  grantEmitterPermissions();
  authorizeListener();
  configureCapture(true, monitoredPackage);
  clearBuffer();

  await runScenario('Purchase', monitoredPackage, 'purchase', (state) => {
    assertEqual(state.capturedCount, 1, 'capturedCount');
    const event = onlyEvent(state);
    assertEqual(event.packageName, monitoredPackage, 'packageName');
    assertIncludes(event.title, 'Compra aprovada', 'title');
    assertIncludes(event.text, '42,90', 'text');
    assertEqual(state.secretDropped, 0, 'secretDropped');
  });

  await runScenario('PIX', monitoredPackage, 'pix', (state) => {
    assertEqual(state.capturedCount, 1, 'capturedCount');
    const event = onlyEvent(state);
    assertIncludes(event.title, 'PIX recebido', 'title');
    assertIncludes(event.text, '150,00', 'text');
  });

  await runScenario('Irrelevante', monitoredPackage, 'irrelevant', (state) => {
    assertEqual(state.capturedCount, 1, 'capturedCount');
    assertIncludes(onlyEvent(state).title, 'Novidades', 'title');
    assert(!('classification' in onlyEvent(state)), 'listener nao deve classificar financeiramente');
  });

  await runScenario('OTP', monitoredPackage, 'otp', (state) => {
    assertEqual(state.capturedCount, 0, 'capturedCount');
    assertEqual(state.secretDropped, 1, 'secretDropped');
    assert(!JSON.stringify(state).includes('123456'), 'OTP nao deve aparecer no buffer');
    assertNoPlannerLogContent(['123456']);
  });

  await runScenario('BigText', monitoredPackage, 'long', (state) => {
    assertEqual(state.capturedCount, 1, 'capturedCount');
    assertIncludes(onlyEvent(state).bigText, 'EXTRA_BIG_TEXT', 'bigText');
  });

  await runScenario('Package nao monitorado', otherPackage, 'other', (state) => {
    assertEqual(state.capturedCount, 0, 'capturedCount');
    assertEqual(state.secretDropped, 0, 'secretDropped');
    assertNoPlannerLogContent(['999,99']);
  });

  configureCapture(false, monitoredPackage);
  await runScenario('captureEnabled false', monitoredPackage, 'purchase', (state) => {
    assertEqual(state.capturedCount, 0, 'capturedCount');
  });
  configureCapture(true, monitoredPackage);

  await testBackgroundProcess();
  await testForceStop();
  await testReconnect();
  await testReboot();

  console.log('\nMatriz:');
  for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}`);
  if (results.some((result) => !result.ok)) process.exit(1);
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

function ensureExists(path, label) {
  if (path.includes('\\') || path.includes('/')) {
    if (!existsSync(path)) throw new Error(`${label} nao encontrado em ${path}`);
  }
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
  await waitFor(async () => {
    found = findRunningAvd();
    return !!found;
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

function buildPlannerFin() {
  run('pnpm', ['android:build:debug'], { cwd: root });
}

function buildEmitter() {
  run(gradlew, [
    '-p',
    join(root, 'tools', 'android', 'notification-emitter'),
    'assembleNotificationTestDebug',
    'assembleNotificationOtherDebug',
  ]);
}

function installApks() {
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
  const otherApk = join(
    root,
    'tools',
    'android',
    'notification-emitter',
    'app',
    'build',
    'outputs',
    'apk',
    'notificationOther',
    'debug',
    'app-notificationOther-debug.apk',
  );
  for (const apk of [plannerApk, testApk, otherApk]) {
    ensureExists(apk, 'APK');
    run(adb, ['-s', serial, 'install', '-r', '-d', apk]);
  }
  run(adb, ['-s', serial, 'shell', 'pm', 'path', monitoredPackage]);
  run(adb, ['-s', serial, 'shell', 'pm', 'path', otherPackage]);
}

function grantEmitterPermissions() {
  const sdk = Number(adbShell(['getprop', 'ro.build.version.sdk']).stdout.trim());
  if (sdk < 33) return;
  for (const packageName of [monitoredPackage, otherPackage]) {
    run(adb, ['-s', serial, 'shell', 'pm', 'grant', packageName, 'android.permission.POST_NOTIFICATIONS']);
  }
}

function authorizeListener() {
  run(adb, ['-s', serial, 'shell', 'cmd', 'notification', 'allow_listener', listenerComponent]);
  const enabled = adbShell(['settings', 'get', 'secure', 'enabled_notification_listeners']).stdout;
  assert(enabled.includes('PlannerFinNotificationListenerService'), 'listener deve constar em enabled_notification_listeners');
  const listeners = adbShell(['dumpsys', 'notification', 'listeners']).stdout;
  assert(listeners.includes('PlannerFinNotificationListenerService'), 'listener deve constar em dumpsys notification listeners');
}

function configureCapture(captureEnabled, packages) {
  debugCommand('configure', ['--ez', 'captureEnabled', String(captureEnabled), '--es', 'packages', packages]);
}

function clearBuffer() {
  debugCommand('clear');
  run(adb, ['-s', serial, 'logcat', '-c']);
}

function debugState() {
  return JSON.parse(debugCommand('state'));
}

function debugCommand(command, extraArgs = []) {
  const result = run(adb, [
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
  const start = result.indexOf(marker);
  const end = result.lastIndexOf('"');
  if (start < 0 || end <= start + marker.length) {
    throw new Error(`Resposta debug sem data JSON: ${result}`);
  }
  return result.slice(start + marker.length, end);
}

function emitterComponent(packageName) {
  return `${packageName}/${emitterReceiver}`;
}

async function runScenario(name, packageName, scenario, assertState) {
  clearBuffer();
  run(adb, [
    '-s',
    serial,
    'shell',
    'am',
    'broadcast',
    '-n',
    emitterComponent(packageName),
    '-a',
    emitterAction,
    '--es',
    'scenario',
    scenario,
  ]);
  const state = await waitForState((candidate) => {
    try {
      assertState(candidate);
      return true;
    } catch {
      return false;
    }
  }, name);
  assertState(state);
  pass(name);
}

async function testBackgroundProcess() {
  clearBuffer();
  run(adb, ['-s', serial, 'shell', 'am', 'start', '-n', `${plannerPackage}/.MainActivity`], { allowFailure: true });
  run(adb, ['-s', serial, 'shell', 'input', 'keyevent', 'KEYCODE_HOME']);
  run(adb, ['-s', serial, 'shell', 'am', 'kill', plannerPackage], { allowFailure: true });
  run(adb, ['-s', serial, 'shell', 'am', 'broadcast', '-n', emitterComponent(monitoredPackage), '-a', emitterAction, '--es', 'scenario', 'purchase']);
  const state = await waitForState((candidate) => candidate.capturedCount === 1, 'processo fechado');
  assertEqual(state.capturedCount, 1, 'capturedCount');
  pass('Processo fechado sem force-stop');
}

async function testForceStop() {
  clearBuffer();
  run(adb, ['-s', serial, 'shell', 'am', 'force-stop', plannerPackage]);
  run(adb, ['-s', serial, 'shell', 'am', 'broadcast', '-n', emitterComponent(monitoredPackage), '-a', emitterAction, '--es', 'scenario', 'purchase']);
  await sleep(2000);
  run(adb, ['-s', serial, 'shell', 'am', 'start', '-n', `${plannerPackage}/.MainActivity`], { allowFailure: true });
  const state = debugState();
  if (state.capturedCount === 0) {
    console.log('INFO Force-stop no AVD bloqueou callback antes da reabertura.');
  } else {
    console.log(`INFO Force-stop no AVD preservou callback apos reabertura: capturedCount=${state.capturedCount}.`);
  }
  authorizeListener();
  configureCapture(true, monitoredPackage);
  pass('Force-stop documentado');
}

async function testReconnect() {
  clearBuffer();
  run(adb, ['-s', serial, 'shell', 'cmd', 'notification', 'disallow_listener', listenerComponent]);
  run(adb, ['-s', serial, 'shell', 'cmd', 'notification', 'allow_listener', listenerComponent]);
  run(adb, ['-s', serial, 'shell', 'am', 'broadcast', '-n', emitterComponent(monitoredPackage), '-a', emitterAction, '--es', 'scenario', 'purchase']);
  const state = await waitForState((candidate) => candidate.capturedCount === 1, 'reconnect');
  assertEqual(state.capturedCount, 1, 'capturedCount');
  pass('Reconnect');
}

async function testReboot() {
  run(adb, ['-s', serial, 'reboot'], { allowFailure: true });
  await sleep(5000);
  run(adb, ['-s', serial, 'wait-for-device']);
  await waitFor(() => adbShell(['getprop', 'sys.boot_completed']).stdout.trim() === '1', 120000, 'boot apos reboot');
  authorizeListener();
  const state = debugState();
  assertEqual(state.captureEnabled, true, 'captureEnabled persistido');
  assert(state.monitoredPackages.includes(monitoredPackage), 'monitoredPackages persistido');
  clearBuffer();
  run(adb, ['-s', serial, 'shell', 'am', 'broadcast', '-n', emitterComponent(monitoredPackage), '-a', emitterAction, '--es', 'scenario', 'purchase']);
  const captured = await waitForState((candidate) => candidate.capturedCount === 1, 'reboot');
  assertEqual(captured.capturedCount, 1, 'capturedCount');
  pass('Reboot');
}

async function waitForState(predicate, label) {
  let last;
  await waitFor(() => {
    last = debugState();
    return predicate(last);
  }, 10000, label);
  return last;
}

async function waitFor(predicate, timeoutMs, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return;
    await sleep(500);
  }
  throw new Error(`timeout aguardando ${label}`);
}

function adbShell(args) {
  return run(adb, ['-s', serial, 'shell', ...args]);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `comando falhou: ${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`,
    );
  }
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status ?? 0 };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, label) {
  assert(actual === expected, `${label}: esperado ${expected}, recebido ${actual}`);
}

function assertIncludes(actual, expected, label) {
  assert(String(actual).includes(expected), `${label}: esperado conter ${expected}, recebido ${actual}`);
}

function onlyEvent(state) {
  assert(Array.isArray(state.events), 'events deve ser array');
  assertEqual(state.events.length, 1, 'events.length');
  return state.events[0];
}

function assertNoPlannerLogContent(values) {
  const logs = run(adb, ['-s', serial, 'logcat', '-d', '-s', 'PlannerFinNotif']).stdout;
  for (const value of values) {
    assert(!logs.includes(value), `logcat PlannerFinNotif nao deve conter ${value}`);
  }
}

function pass(name) {
  results.push({ name, ok: true });
  console.log(`PASS ${name}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
