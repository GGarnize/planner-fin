import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  DOCTOR_REQUIREMENTS,
  collectFacts,
  compareVersions,
  createRuntime,
  diagnose,
  parseLocalPropertiesSdk,
  parseVersion,
} from './doctor-lib.mjs';

const ok = (output) => ({ ok: true, output });
const missing = () => ({ ok: false, output: '' });

function readyFacts() {
  return {
    commands: {
      git: ok('git version 2.52.0.windows.1'),
      node: ok('v22.14.0'),
      pnpm: ok('10.28.1'),
      corepack: ok('0.34.2'),
      powershell: ok('5.1.26100.1'),
      python: ok('Python 3.14.0'),
      winget: ok('v1.29.0'),
      dockerCli: ok('Docker version 28.0.0'),
      dockerCompose: ok('Docker Compose version v2.38.0'),
      dockerEngine: ok('28.0.0'),
      java: ok('openjdk version "21.0.8"'),
      javac: ok('javac 21.0.8'),
      adb: ok('Android Debug Bridge version 1.0.41'),
      emulator: ok('Android emulator version 36.2.0'),
      avds: ok('Pixel_7_Pro'),
      virtualization: ok('True|True'),
    },
    env: {
      JAVA_HOME: 'C:\\Java\\jdk-21',
      ANDROID_HOME: 'C:\\Android\\Sdk',
      ANDROID_SDK_ROOT: 'C:\\Android\\Sdk',
    },
    paths: {
      dockerDesktop: 'C:\\Docker\\Docker Desktop.exe',
      sdk: 'C:\\Android\\Sdk',
      platform: 'C:\\Android\\Sdk\\platforms\\android-36\\android.jar',
      buildToolsRoot: 'C:\\Android\\Sdk\\build-tools\\35.0.0',
      sdkManagerPath: 'C:\\Android\\Sdk\\cmdline-tools\\latest\\bin\\sdkmanager.bat',
      systemImage: 'C:\\Android\\Sdk\\system-images\\android-36\\google_apis\\x86_64',
      gradleWrapper: 'apps\\web\\android\\gradlew.bat',
      lockfile: 'pnpm-lock.yaml',
      nodeModules: 'node_modules',
      envFile: '.env',
    },
    present: {
      sdkManager: true,
      platform: true,
      buildTools: true,
      systemImage: true,
      gradleWrapper: true,
      lockfile: true,
      nodeModules: true,
      envFile: true,
      envExample: true,
      certs: true,
      javaHome: true,
      androidHome: true,
      androidSdkRoot: true,
      releaseKeystore: true,
    },
    releaseSigningVariables: [
      'PLANNER_FIN_KEYSTORE_FILE',
      'PLANNER_FIN_KEYSTORE_PASSWORD',
      'PLANNER_FIN_KEY_ALIAS',
      'PLANNER_FIN_KEY_PASSWORD',
    ],
  };
}

function check(report, group, label) {
  return report.groups[group].find((item) => item.label === label);
}

test('parseia versões de Node, Java, Git e formato simples', () => {
  assert.deepEqual(parseVersion('v22.14.0'), [22, 14, 0]);
  assert.deepEqual(parseVersion('openjdk version "21.0.8" 2026-07-16 LTS'), [21, 0, 8]);
  assert.deepEqual(parseVersion('git version 2.52.0.windows.1'), [2, 52, 0]);
  assert.deepEqual(parseVersion('10.28.1'), [10, 28, 1]);
  assert.equal(parseVersion('sem versão'), null);
  assert.equal(compareVersions('22.0.0', '21.9.9'), 1);
  assert.equal(compareVersions('22.0.0', '22.0.0'), 0);
  assert.equal(compareVersions('20.19.0', '22.0.0'), -1);
});

test('Node ausente é MISSING', () => {
  const facts = readyFacts();
  facts.commands.node = missing();
  assert.equal(check(diagnose(facts), 'Core', 'Node').status, 'MISSING');
});

test('Node 20 é WRONG VERSION', () => {
  const facts = readyFacts();
  facts.commands.node = ok('v20.19.0');
  assert.equal(check(diagnose(facts), 'Core', 'Node').status, 'WRONG VERSION');
});

test('Node 22 satisfaz o mínimo', () => {
  assert.equal(check(diagnose(readyFacts()), 'Core', 'Node').status, 'OK');
});

test('pnpm ausente sugere Corepack sem executar instalação', () => {
  const facts = readyFacts();
  facts.commands.pnpm = missing();
  const report = diagnose(facts);
  assert.equal(check(report, 'Core', 'pnpm').status, 'MISSING');
  assert.match(report.nextSteps.join('\n'), /corepack enable/);
  assert.match(report.nextSteps.join('\n'), /10\.28\.1/);
});

test('detecção de pnpm bloqueia downloads automáticos do Corepack', () => {
  let processOptions;
  const runtime = createRuntime({
    platform: 'win32',
    env: { ComSpec: 'cmd.exe' },
    runProcess: (_command, _args, options) => {
      processOptions = options;
      return { status: 1, stdout: '', stderr: '' };
    },
  });

  runtime.run('pnpm', ['--version']);
  assert.equal(processOptions.env.COREPACK_ENABLE_NETWORK, '0');
  assert.equal(processOptions.env.COREPACK_ENABLE_DOWNLOAD_PROMPT, '0');
});

test('Docker ausente é separado entre CLI e engine', () => {
  const facts = readyFacts();
  facts.commands.dockerCli = missing();
  facts.commands.dockerCompose = missing();
  facts.commands.dockerEngine = missing();
  facts.paths.dockerDesktop = null;
  const report = diagnose(facts);
  assert.equal(check(report, 'Database', 'Docker CLI').status, 'MISSING');
  assert.equal(check(report, 'Database', 'Docker engine').status, 'MISSING');
  assert.equal(check(report, 'Database', 'Docker state').status, 'MISSING');
});

test('Docker instalado com engine parado usa INSTALLED_BUT_STOPPED', () => {
  const facts = readyFacts();
  facts.commands.dockerEngine = missing();
  const report = diagnose(facts);
  assert.equal(check(report, 'Database', 'Docker engine').status, 'INSTALLED_BUT_STOPPED');
  assert.equal(check(report, 'Database', 'Docker state').status, 'INSTALLED_BUT_STOPPED');
});

test('Android SDK ausente não derruba readiness de Core/Web', () => {
  const facts = readyFacts();
  facts.paths.sdk = null;
  facts.present.platform = false;
  facts.present.buildTools = false;
  facts.present.systemImage = false;
  facts.present.sdkManager = false;
  const report = diagnose(facts);
  assert.equal(check(report, 'Android', 'Android SDK').status, 'MISSING');
  assert.equal(report.readiness['Core/Web'].status, 'READY');
  assert.equal(report.readiness['Android build'].status, 'NOT READY');
});

test('JDK 17 é recusado e JDK 21 é aceito', () => {
  const facts = readyFacts();
  facts.commands.java = ok('openjdk version "17.0.12"');
  facts.commands.javac = ok('javac 17.0.12');
  let report = diagnose(facts);
  assert.equal(check(report, 'Android', 'Java').status, 'WRONG VERSION');
  assert.equal(check(report, 'Android', 'javac').status, 'WRONG VERSION');

  facts.commands.java = ok('openjdk version "21.0.8"');
  facts.commands.javac = ok('javac 21.0.8');
  report = diagnose(facts);
  assert.equal(check(report, 'Android', 'Java').status, 'OK');
  assert.equal(check(report, 'Android', 'javac').status, 'OK');
});

test('AVD ausente é reportado sem criar dispositivo', () => {
  const facts = readyFacts();
  facts.commands.avds = ok('Pixel_6\nPixel_Tablet');
  assert.equal(check(diagnose(facts), 'Android', 'AVD Pixel_7_Pro').status, 'MISSING');
});

test('readiness final diferencia trilhas', () => {
  const report = diagnose(readyFacts());
  assert.equal(report.readiness['Core/Web'].status, 'READY');
  assert.equal(report.readiness['API/Database'].status, 'READY');
  assert.equal(report.readiness['Android build'].status, 'READY');
  assert.equal(report.readiness['Android emulator'].status, 'READY');
  assert.equal(report.readiness['Release signing'].status, 'READY');
  assert.equal(check(report, 'Database', 'Docker state').status, 'READY');
});

test('parseia sdk.dir escapado do Gradle', () => {
  assert.equal(
    parseLocalPropertiesSdk('sdk.dir=C:\\\\Users\\\\dev\\\\AppData\\\\Local\\\\Android\\\\Sdk\n'),
    'C:\\Users\\dev\\AppData\\Local\\Android\\Sdk',
  );
});

test('descobre SDK por ANDROID_HOME e executa adb encontrado no SDK', () => {
  const root = resolve('C:\\repo');
  const sdk = resolve('C:\\Android\\Sdk');
  const adb = join(sdk, 'platform-tools', 'adb.exe');
  const existing = new Set([sdk, adb]);
  const invoked = [];
  const runtime = {
    env: {
      ANDROID_HOME: sdk,
      LOCALAPPDATA: 'C:\\Users\\dev\\AppData\\Local',
      ProgramFiles: 'C:\\Program Files',
      'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    },
    platform: 'win32',
    arch: 'x64',
    exists: (path) => existing.has(resolve(path)),
    readFile: () => '',
    run: (command, args) => {
      invoked.push([command, ...args]);
      if (resolve(command) === adb) return ok('Android Debug Bridge version 1.0.41');
      return missing();
    },
  };

  const facts = collectFacts(root, { runtime });
  assert.equal(facts.paths.sdk, sdk);
  assert.equal(facts.commands.adb.ok, true);
  assert.ok(invoked.some(([command]) => resolve(command) === adb));
});

test('constantes refletem o ambiente Android versionado', () => {
  assert.deepEqual(DOCTOR_REQUIREMENTS, {
    nodeMin: '22.0.0',
    pnpm: '10.28.1',
    jdkMajor: 21,
    compileSdk: 36,
    targetSdk: 36,
    buildTools: '35.0.0',
    avd: 'Pixel_7_Pro',
    systemImage: 'system-images;android-36;google_apis;x86_64',
  });
});
