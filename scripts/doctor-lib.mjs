import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const DOCTOR_REQUIREMENTS = Object.freeze({
  nodeMin: '22.0.0',
  pnpm: '10.28.1',
  jdkMajor: 21,
  compileSdk: 36,
  targetSdk: 36,
  buildTools: '35.0.0',
  avd: 'Pixel_7_Pro',
  systemImage: 'system-images;android-36;google_apis;x86_64',
});

export function parseVersion(raw) {
  const match = String(raw ?? '').match(/(?:^|[^\d])(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

export function compareVersions(left, right) {
  const a = Array.isArray(left) ? left : parseVersion(left);
  const b = Array.isArray(right) ? right : parseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export function parseLocalPropertiesSdk(raw) {
  const match = String(raw ?? '').match(/^\s*sdk\.dir\s*=\s*(.+?)\s*$/m);
  if (!match) return null;
  return match[1].replaceAll('\\\\', '\\').trim();
}

export function createRuntime(options = {}) {
  const runProcess = options.runProcess ?? spawnSync;
  const exists = options.exists ?? existsSync;
  const readFile = options.readFile ?? ((path) => readFileSync(path, 'utf8'));
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;

  function run(command, args = [], timeout = 10000) {
    try {
      // pnpm/corepack são launchers .cmd na instalação oficial do Node para Windows.
      // Somente os nomes/argumentos fixos abaixo passam por cmd.exe; nenhum valor externo
      // é interpolado na linha de comando.
      const needsWindowsCommandShell =
        platform === 'win32' && (command === 'pnpm' || command === 'corepack');
      const executable = needsWindowsCommandShell ? env.ComSpec || 'cmd.exe' : command;
      const executableArgs = needsWindowsCommandShell
        ? ['/d', '/s', '/c', `${command} ${args.join(' ')}`]
        : args;
      const childEnv =
        command === 'pnpm'
          ? { ...env, COREPACK_ENABLE_NETWORK: '0', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' }
          : env;
      const result = runProcess(executable, executableArgs, {
        encoding: 'utf8',
        windowsHide: true,
        timeout,
        env: childEnv,
      });
      return {
        ok: result.status === 0 && !result.error,
        output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(),
      };
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : String(error) };
    }
  }

  return { run, exists, readFile, env, platform, arch };
}

function firstSuccessful(runtime, candidates) {
  for (const [command, args] of candidates) {
    const result = runtime.run(command, args);
    if (result.ok) return { ...result, command };
  }
  return { ok: false, output: '', command: null };
}

function firstExisting(runtime, candidates) {
  for (const candidate of candidates) {
    if (candidate && runtime.exists(candidate)) return resolve(candidate);
  }
  return null;
}

function safeRead(runtime, path) {
  try {
    return runtime.exists(path) ? runtime.readFile(path) : null;
  } catch {
    return null;
  }
}

function executable(root, segments, platform) {
  if (!root) return null;
  const file = segments.at(-1);
  const suffix = platform === 'win32' && !file.includes('.') ? '.exe' : '';
  return join(root, ...segments.slice(0, -1), `${file}${suffix}`);
}

export function collectFacts(root, options = {}) {
  const runtime = options.runtime ?? createRuntime(options);
  const { env, platform } = runtime;
  const localPropertiesPath = join(root, 'apps', 'web', 'android', 'local.properties');
  const localProperties = safeRead(runtime, localPropertiesPath);
  const localSdk = parseLocalPropertiesSdk(localProperties);
  const defaultSdk = env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'Android', 'Sdk') : null;
  const sdkCandidates = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, defaultSdk, localSdk];
  const sdk = firstExisting(runtime, sdkCandidates);

  const adbPath = executable(sdk, ['platform-tools', 'adb'], platform);
  const emulatorPath = executable(sdk, ['emulator', 'emulator'], platform);
  const sdkManagerPath = sdk
    ? join(sdk, 'cmdline-tools', 'latest', 'bin', platform === 'win32' ? 'sdkmanager.bat' : 'sdkmanager')
    : null;
  const adbCommand = adbPath && runtime.exists(adbPath) ? adbPath : 'adb';
  const emulatorCommand = emulatorPath && runtime.exists(emulatorPath) ? emulatorPath : 'emulator';

  const git = runtime.run('git', ['--version']);
  const node = runtime.run('node', ['--version']);
  const pnpm = runtime.run('pnpm', ['--version']);
  const corepack = runtime.run('corepack', ['--version']);
  const powershell = runtime.run('powershell', [
    '-NoProfile',
    '-Command',
    '$PSVersionTable.PSVersion.ToString()',
  ]);
  const python = firstSuccessful(runtime, [
    ['python', ['--version']],
    ['py', ['--version']],
    ['python3', ['--version']],
  ]);
  const winget = runtime.run('winget', ['--version']);
  const dockerCli = runtime.run('docker', ['--version']);
  const dockerCompose = runtime.run('docker', ['compose', 'version']);
  const dockerEngine = runtime.run('docker', ['info', '--format', '{{.ServerVersion}}']);
  const java = runtime.run('java', ['-version']);
  const javac = runtime.run('javac', ['-version']);
  const adb = runtime.run(adbCommand, ['version']);
  const emulator = runtime.run(emulatorCommand, ['-version']);
  const avds = emulator.ok ? runtime.run(emulatorCommand, ['-list-avds']) : { ok: false, output: '' };
  const virtualization = runtime.run('powershell', [
    '-NoProfile',
    '-Command',
    "$cs=Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue; $cpu=Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1; Write-Output (\"$($cs.HypervisorPresent)|$($cpu.VirtualizationFirmwareEnabled)\")",
  ]);

  const programFiles = env.ProgramFiles;
  const programFilesX86 = env['ProgramFiles(x86)'];
  const dockerDesktopCandidates = [
    programFiles && join(programFiles, 'Docker', 'Docker', 'Docker Desktop.exe'),
    programFilesX86 && join(programFilesX86, 'Docker', 'Docker', 'Docker Desktop.exe'),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Docker', 'Docker Desktop.exe'),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'Docker Desktop.exe'),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Programs', 'Docker', 'Docker', 'Docker Desktop.exe'),
  ];

  const systemImageSegments = DOCTOR_REQUIREMENTS.systemImage.split(';').slice(1);
  const buildToolsRoot = sdk && join(sdk, 'build-tools', DOCTOR_REQUIREMENTS.buildTools);
  const buildToolsFiles = buildToolsRoot
    ? [
        join(buildToolsRoot, platform === 'win32' ? 'aapt.exe' : 'aapt'),
        join(buildToolsRoot, platform === 'win32' ? 'apksigner.bat' : 'apksigner'),
      ]
    : [];

  return {
    root,
    platform,
    arch: runtime.arch,
    commands: {
      git,
      node,
      pnpm,
      corepack,
      powershell,
      python,
      winget,
      dockerCli,
      dockerCompose,
      dockerEngine,
      java,
      javac,
      adb,
      emulator,
      avds,
      virtualization,
    },
    env: {
      JAVA_HOME: env.JAVA_HOME ?? '',
      ANDROID_HOME: env.ANDROID_HOME ?? '',
      ANDROID_SDK_ROOT: env.ANDROID_SDK_ROOT ?? '',
    },
    paths: {
      dockerDesktop: firstExisting(runtime, dockerDesktopCandidates),
      sdk,
      sdkCandidates,
      localPropertiesPath,
      localSdk,
      adbPath,
      emulatorPath,
      sdkManagerPath,
      platform: sdk && join(sdk, 'platforms', `android-${DOCTOR_REQUIREMENTS.compileSdk}`, 'android.jar'),
      buildToolsRoot,
      buildToolsFiles,
      systemImage: sdk && join(sdk, 'system-images', ...systemImageSegments),
      gradleWrapper: join(root, 'apps', 'web', 'android', platform === 'win32' ? 'gradlew.bat' : 'gradlew'),
      lockfile: join(root, 'pnpm-lock.yaml'),
      nodeModules: join(root, 'node_modules'),
      envFile: join(root, '.env'),
      envExample: join(root, '.env.example'),
      cert: join(root, '.tools', 'certs', 'planner-fin-local.pem'),
      certKey: join(root, '.tools', 'certs', 'planner-fin-local-key.pem'),
      releaseKeystore: env.PLANNER_FIN_KEYSTORE_FILE ?? '',
    },
    present: {
      sdkManager: Boolean(sdkManagerPath && runtime.exists(sdkManagerPath)),
      platform: Boolean(sdk && runtime.exists(join(sdk, 'platforms', `android-${DOCTOR_REQUIREMENTS.compileSdk}`, 'android.jar'))),
      buildTools: buildToolsFiles.length > 0 && buildToolsFiles.every((path) => runtime.exists(path)),
      systemImage: Boolean(sdk && runtime.exists(join(sdk, 'system-images', ...systemImageSegments))),
      gradleWrapper: runtime.exists(join(root, 'apps', 'web', 'android', platform === 'win32' ? 'gradlew.bat' : 'gradlew')),
      lockfile: runtime.exists(join(root, 'pnpm-lock.yaml')),
      nodeModules: runtime.exists(join(root, 'node_modules')),
      envFile: runtime.exists(join(root, '.env')),
      envExample: runtime.exists(join(root, '.env.example')),
      certs: runtime.exists(join(root, '.tools', 'certs', 'planner-fin-local.pem')) && runtime.exists(join(root, '.tools', 'certs', 'planner-fin-local-key.pem')),
      javaHome: Boolean(env.JAVA_HOME && runtime.exists(join(env.JAVA_HOME, 'bin', platform === 'win32' ? 'java.exe' : 'java'))),
      androidHome: Boolean(env.ANDROID_HOME && runtime.exists(env.ANDROID_HOME)),
      androidSdkRoot: Boolean(env.ANDROID_SDK_ROOT && runtime.exists(env.ANDROID_SDK_ROOT)),
      releaseKeystore: Boolean(env.PLANNER_FIN_KEYSTORE_FILE && runtime.exists(env.PLANNER_FIN_KEYSTORE_FILE)),
    },
    releaseSigningVariables: [
      'PLANNER_FIN_KEYSTORE_FILE',
      'PLANNER_FIN_KEYSTORE_PASSWORD',
      'PLANNER_FIN_KEY_ALIAS',
      'PLANNER_FIN_KEY_PASSWORD',
    ].filter((name) => Boolean(env[name])),
  };
}

function toolCheck(command, label, details = {}) {
  if (!command.ok) return { label, status: 'MISSING', detail: details.missing ?? 'não encontrado no PATH' };
  const version = parseVersion(command.output);
  if (details.minimum && compareVersions(version, details.minimum) < 0) {
    return { label, status: 'WRONG VERSION', detail: `${command.output} (exige >= ${details.minimum})` };
  }
  if (details.exact && compareVersions(version, details.exact) !== 0) {
    return { label, status: 'WRONG VERSION', detail: `${command.output} (exige ${details.exact})` };
  }
  if (details.major && version?.[0] !== details.major) {
    return { label, status: 'WRONG VERSION', detail: `${command.output} (exige major ${details.major})` };
  }
  return { label, status: 'OK', detail: command.output.split(/\r?\n/)[0] };
}

function add(groups, group, item) {
  groups[group].push(item);
  return item;
}

function readiness(status, detail) {
  return { status, detail };
}

export function diagnose(facts) {
  const groups = { Core: [], Database: [], Android: [], Environment: [], Project: [] };
  const { commands, present, paths } = facts;

  const git = add(groups, 'Core', toolCheck(commands.git, 'Git'));
  const node = add(groups, 'Core', toolCheck(commands.node, 'Node', { minimum: DOCTOR_REQUIREMENTS.nodeMin }));
  const pnpm = add(groups, 'Core', toolCheck(commands.pnpm, 'pnpm', { exact: DOCTOR_REQUIREMENTS.pnpm }));
  const powershell = add(groups, 'Core', toolCheck(commands.powershell, 'PowerShell', { minimum: '5.1.0' }));
  const python = add(groups, 'Core', toolCheck(commands.python, 'Python'));
  add(groups, 'Core', toolCheck(commands.winget, 'winget'));
  if (!commands.pnpm.ok && commands.node.ok && commands.corepack.ok) {
    add(groups, 'Core', { label: 'Corepack', status: 'OK', detail: `${commands.corepack.output}; pode ativar pnpm ${DOCTOR_REQUIREMENTS.pnpm}` });
  }

  const dockerCli = add(groups, 'Database', toolCheck(commands.dockerCli, 'Docker CLI'));
  add(groups, 'Database', {
    label: 'Docker Desktop',
    status: paths.dockerDesktop ? 'OK' : 'MISSING',
    detail: paths.dockerDesktop ?? 'executável não localizado nos caminhos padrão',
  });
  const engineStatus = !commands.dockerCli.ok
    ? { label: 'Docker engine', status: 'MISSING', detail: 'Docker CLI ausente' }
    : commands.dockerEngine.ok
      ? { label: 'Docker engine', status: 'OK', detail: commands.dockerEngine.output }
      : { label: 'Docker engine', status: 'INSTALLED_BUT_STOPPED', detail: 'não respondeu a docker info; inicie manualmente o Docker Desktop' };
  add(groups, 'Database', engineStatus);
  const compose = add(groups, 'Database', toolCheck(commands.dockerCompose, 'docker compose'));
  add(groups, 'Database', {
    label: 'Docker state',
    status:
      dockerCli.status !== 'OK' || compose.status !== 'OK'
        ? 'MISSING'
        : engineStatus.status === 'OK'
          ? 'READY'
          : 'INSTALLED_BUT_STOPPED',
    detail:
      engineStatus.status === 'OK' && compose.status === 'OK'
        ? 'CLI, Compose e engine disponíveis'
        : engineStatus.detail,
  });
  add(groups, 'Database', { label: 'PostgreSQL', status: 'INFO', detail: 'postgres:16-alpine via docker-compose.yml; 127.0.0.1:5432' });

  const java = add(groups, 'Android', toolCheck(commands.java, 'Java', { major: DOCTOR_REQUIREMENTS.jdkMajor }));
  const javac = add(groups, 'Android', toolCheck(commands.javac, 'javac', { major: DOCTOR_REQUIREMENTS.jdkMajor }));
  add(groups, 'Android', {
    label: 'Android SDK',
    status: paths.sdk ? 'OK' : 'MISSING',
    detail: paths.sdk ?? 'não localizado por env, caminho padrão ou local.properties',
  });
  const adb = add(groups, 'Android', toolCheck(commands.adb, 'adb'));
  const emulator = add(groups, 'Android', toolCheck(commands.emulator, 'emulator'));
  add(groups, 'Android', {
    label: `platform ${DOCTOR_REQUIREMENTS.compileSdk}`,
    status: present.platform ? 'OK' : 'MISSING',
    detail: present.platform ? paths.platform : `platforms;android-${DOCTOR_REQUIREMENTS.compileSdk}`,
  });
  add(groups, 'Android', {
    label: `build-tools ${DOCTOR_REQUIREMENTS.buildTools}`,
    status: present.buildTools ? 'OK' : 'MISSING',
    detail: present.buildTools ? paths.buildToolsRoot : `build-tools;${DOCTOR_REQUIREMENTS.buildTools} com aapt e apksigner`,
  });
  add(groups, 'Android', {
    label: 'cmdline-tools;latest',
    status: present.sdkManager ? 'OK' : 'MISSING',
    detail: present.sdkManager ? paths.sdkManagerPath : 'sdkmanager não localizado',
  });
  add(groups, 'Android', {
    label: DOCTOR_REQUIREMENTS.systemImage,
    status: present.systemImage ? 'OK' : 'MISSING',
    detail: present.systemImage ? paths.systemImage : 'imagem necessária para criar o AVD padrão em Windows x64',
  });
  const avdFound = commands.avds.ok && commands.avds.output.split(/\r?\n/).map((line) => line.trim()).includes(DOCTOR_REQUIREMENTS.avd);
  add(groups, 'Android', {
    label: `AVD ${DOCTOR_REQUIREMENTS.avd}`,
    status: avdFound ? 'OK' : 'MISSING',
    detail: avdFound ? 'listado por emulator -list-avds' : 'crie manualmente pelo Device Manager ou avdmanager',
  });

  let virtualizationState = 'UNKNOWN';
  if (commands.virtualization.ok) {
    const values = commands.virtualization.output.toLowerCase();
    if (values.includes('true')) virtualizationState = 'OK';
    else if (values.includes('false')) virtualizationState = 'WARN';
  }
  add(groups, 'Android', {
    label: 'Virtualização',
    status: virtualizationState,
    detail:
      virtualizationState === 'OK'
        ? 'hypervisor ou virtualização de firmware detectado'
        : virtualizationState === 'WARN'
          ? 'não detectada; valide BIOS/UEFI e Windows Hypervisor Platform'
          : 'detecção inconclusiva — valide com emulator -accel-check ao instalar o SDK',
  });

  add(groups, 'Environment', {
    label: 'JAVA_HOME',
    status: present.javaHome ? 'OK' : 'WARN',
    detail: present.javaHome ? facts.env.JAVA_HOME : facts.env.JAVA_HOME ? 'aponta para caminho inválido' : 'não definido',
  });
  add(groups, 'Environment', {
    label: 'ANDROID_HOME',
    status: present.androidHome ? 'OK' : 'WARN',
    detail: present.androidHome ? facts.env.ANDROID_HOME : facts.env.ANDROID_HOME ? 'aponta para caminho inválido' : 'não definido',
  });
  add(groups, 'Environment', {
    label: 'ANDROID_SDK_ROOT',
    status: present.androidSdkRoot ? 'OK' : 'WARN',
    detail: present.androidSdkRoot ? facts.env.ANDROID_SDK_ROOT : facts.env.ANDROID_SDK_ROOT ? 'aponta para caminho inválido' : 'não definido (compatibilidade; ANDROID_HOME é preferido)',
  });

  add(groups, 'Project', { label: 'pnpm-lock.yaml', status: present.lockfile ? 'OK' : 'MISSING', detail: paths.lockfile });
  add(groups, 'Project', { label: 'node_modules', status: present.nodeModules ? 'OK' : 'MISSING', detail: present.nodeModules ? paths.nodeModules : 'rode pnpm install --frozen-lockfile' });
  add(groups, 'Project', { label: '.env local', status: present.envFile ? 'OK' : 'MISSING', detail: present.envFile ? paths.envFile : 'copie .env.example para .env e mantenha fora do Git' });
  add(groups, 'Project', { label: 'Gradle wrapper', status: present.gradleWrapper ? 'OK' : 'MISSING', detail: paths.gradleWrapper });
  add(groups, 'Project', { label: 'Certificado HTTPS local', status: present.certs ? 'OK' : 'WARN', detail: present.certs ? 'certificado e chave presentes em .tools/certs' : 'necessário para dev:android/dev:phone; gere localmente e não versione' });

  const coreReady = [git, node, pnpm, powershell].every((item) => item.status === 'OK') && present.lockfile && present.nodeModules;
  const databaseReady = coreReady && dockerCli.status === 'OK' && engineStatus.status === 'OK' && compose.status === 'OK' && present.envFile;
  const androidBuildReady = coreReady && java.status === 'OK' && javac.status === 'OK' && Boolean(paths.sdk) && present.platform && present.buildTools && present.gradleWrapper;
  const emulatorReady = androidBuildReady && adb.status === 'OK' && emulator.status === 'OK' && present.systemImage && avdFound && virtualizationState !== 'WARN';
  const signingReady = androidBuildReady && facts.releaseSigningVariables.length === 4 && present.releaseKeystore;

  const readinessSummary = {
    'Core/Web': readiness(coreReady ? 'READY' : 'NOT READY', coreReady ? 'dependências principais disponíveis' : 'corrija Core e execute pnpm install'),
    'API/Database': readiness(databaseReady ? 'READY' : 'NOT READY', databaseReady ? 'Docker/PostgreSQL e configuração local disponíveis' : 'exige Core, .env e Docker engine/compose'),
    'Android build': readiness(androidBuildReady ? 'READY' : 'NOT READY', androidBuildReady ? 'JDK, SDK e build-tools disponíveis' : 'exige Core, JDK 21, SDK 36 e build-tools 35.0.0'),
    'Android emulator': readiness(emulatorReady ? 'READY' : 'NOT READY', emulatorReady ? `AVD ${DOCTOR_REQUIREMENTS.avd} disponível` : 'exige Android build, adb, emulator, system image, AVD e virtualização'),
    'Release signing': readiness(signingReady ? 'READY' : 'OPTIONAL / NOT CONFIGURED', signingReady ? 'quatro variáveis e keystore disponíveis' : 'configure separadamente somente quando for gerar release assinada'),
  };

  const nextSteps = [];
  if (!commands.pnpm.ok && commands.corepack.ok) nextSteps.push(`Ative o Corepack e o pnpm ${DOCTOR_REQUIREMENTS.pnpm}: corepack enable; corepack install --global pnpm@${DOCTOR_REQUIREMENTS.pnpm}`);
  else if (pnpm.status !== 'OK') nextSteps.push(`Instale/ative exatamente pnpm ${DOCTOR_REQUIREMENTS.pnpm}.`);
  if (!present.nodeModules && commands.pnpm.ok) nextSteps.push('Instale dependências: pnpm install --frozen-lockfile');
  if (!present.envFile) nextSteps.push('Crie a configuração local: Copy-Item .env.example .env');
  if (engineStatus.status !== 'OK') nextSteps.push('Instale ou abra manualmente o Docker Desktop e confirme com docker info.');
  if (java.status !== 'OK' || javac.status !== 'OK') nextSteps.push('Instale o Eclipse Temurin JDK 21 e configure JAVA_HOME.');
  if (!paths.sdk || !present.platform || !present.buildTools) nextSteps.push('Instale o Android SDK e os componentes exatos descritos no runbook.');
  if (!avdFound) nextSteps.push(`Crie manualmente o AVD ${DOCTOR_REQUIREMENTS.avd}.`);
  if (!present.certs) nextSteps.push('Antes de dev:android/dev:phone, gere e confie o certificado TLS local conforme o runbook.');
  nextSteps.push('Rode novamente: pnpm doctor');

  return { groups, readiness: readinessSummary, nextSteps };
}

export function renderReport(report) {
  const lines = ['PlannerFin Environment Doctor', ''];
  for (const [group, checks] of Object.entries(report.groups)) {
    lines.push(group);
    for (const check of checks) lines.push(`[${check.status}] ${check.label} — ${check.detail}`);
    lines.push('');
  }
  lines.push('Readiness:');
  for (const [name, value] of Object.entries(report.readiness)) lines.push(`${name}: ${value.status} — ${value.detail}`);
  lines.push('', 'Próximos passos:');
  report.nextSteps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  lines.push('', 'Runbook:', 'docs/runbooks/WINDOWS-BOOTSTRAP.md');
  return lines.join('\n');
}
