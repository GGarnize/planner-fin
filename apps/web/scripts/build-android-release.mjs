import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertProductionWebApiBaseUrl } from './validate-prod-web-env.mjs';

export const RELEASE_SIGNING_VARS = [
  'PLANNER_FIN_KEYSTORE_FILE',
  'PLANNER_FIN_KEYSTORE_PASSWORD',
  'PLANNER_FIN_KEY_ALIAS',
  'PLANNER_FIN_KEY_PASSWORD',
];

export function assertReleaseSigningEnv(env) {
  for (const name of RELEASE_SIGNING_VARS) {
    if (!env[name]) throw new Error(`Build release exige ${name} (keystore externo ao repositório).`);
  }
}

export function readAndroidVersion(webPackageRaw, versionJsonRaw) {
  const version = JSON.parse(webPackageRaw).version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('apps/web/package.json.version deve ser SemVer 0.x.y para release Android.');
  }
  const versionCode = JSON.parse(versionJsonRaw).versionCode;
  if (!Number.isInteger(versionCode) || versionCode < 1) {
    throw new Error('android/version.json.versionCode deve ser inteiro positivo.');
  }
  return { version, versionCode };
}

export function readSdkVersions(variablesGradleRaw) {
  const minSdk = Number(variablesGradleRaw.match(/minSdkVersion\s*=\s*(\d+)/)?.[1]);
  const targetSdk = Number(variablesGradleRaw.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1]);
  if (!minSdk || !targetSdk) {
    throw new Error('Não foi possível ler minSdkVersion/targetSdkVersion de android/variables.gradle.');
  }
  return { minSdk, targetSdk };
}

export function computeSha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function buildReleaseMetadata({
  version,
  versionCode,
  sha256,
  size,
  createdAt,
  gitCommit,
  applicationId,
  minSdk,
  targetSdk,
  apiBaseUrl,
}) {
  return {
    version,
    versionCode,
    sha256,
    size,
    createdAt,
    gitCommit,
    applicationId,
    minSdk,
    targetSdk,
    apiBaseUrl,
  };
}

function extractApksignerSha256(output) {
  const match = output.match(/certificate SHA-256 digest:\s*([0-9a-fA-F]+)/);
  return match ? match[1].toLowerCase() : null;
}

function extractKeytoolSha256(output) {
  const match = output.match(/SHA256:\s*([0-9A-Fa-f:]+)/);
  return match ? match[1].replaceAll(':', '').toLowerCase() : null;
}

/**
 * Verificação best-effort do APK gerado usando apksigner/aapt quando disponíveis no PATH.
 * Ferramentas ausentes geram apenas aviso (não fecham o build); um APK presente porém
 * inconsistente (applicationId/versão/assinatura de debug) falha fechado.
 */
export function verifyApkBestEffort(apkPath, { applicationId, versionName, versionCode }) {
  const messages = [];
  const spawnOpts = { shell: process.platform === 'win32' };

  const apksigner = spawnSync('apksigner', ['verify', '--print-certs', apkPath], spawnOpts);
  if (apksigner.error && apksigner.error.code === 'ENOENT') {
    messages.push('aviso: apksigner não encontrado no PATH; verificação de assinatura pulada.');
  } else {
    const output = `${apksigner.stdout ?? ''}${apksigner.stderr ?? ''}`;
    if (apksigner.status !== 0) {
      throw new Error(`apksigner reportou falha na verificação da assinatura release: ${output}`);
    }
    const releaseFingerprint = extractApksignerSha256(output);
    const debugKeystorePath = join(homedir(), '.android', 'debug.keystore');
    if (releaseFingerprint && existsSync(debugKeystorePath)) {
      const debugCert = spawnSync(
        'keytool',
        ['-list', '-v', '-keystore', debugKeystorePath, '-storepass', 'android', '-alias', 'androiddebugkey'],
        spawnOpts,
      );
      if (!debugCert.error) {
        const debugFingerprint = extractKeytoolSha256(`${debugCert.stdout ?? ''}`);
        if (debugFingerprint && debugFingerprint === releaseFingerprint) {
          throw new Error(
            'APK release está assinado com a keystore de debug local — assinatura de produção inválida.',
          );
        }
      }
    }
    messages.push('apksigner: assinatura verificada com sucesso.');
  }

  const aapt = spawnSync('aapt', ['dump', 'badging', apkPath], spawnOpts);
  if (aapt.error && aapt.error.code === 'ENOENT') {
    messages.push('aviso: aapt não encontrado no PATH; verificação de manifesto pulada.');
  } else {
    if (aapt.status !== 0) throw new Error('aapt não conseguiu inspecionar o APK release gerado.');
    const badging = `${aapt.stdout ?? ''}`;
    if (!badging.includes(`package: name='${applicationId}'`)) {
      throw new Error(`APK release gerado não corresponde ao applicationId ${applicationId}.`);
    }
    if (!badging.includes(`versionName='${versionName}'`)) {
      throw new Error(`APK release gerado não corresponde ao versionName ${versionName}.`);
    }
    if (!badging.includes(`versionCode='${versionCode}'`)) {
      throw new Error(`APK release gerado não corresponde ao versionCode ${versionCode}.`);
    }
    messages.push('aapt: applicationId/versionName/versionCode confirmados no APK.');
  }
  return messages;
}

function run(command, args, cwd = '.') {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`Comando falhou: ${command} ${args.join(' ')}`);
}

function readGitCommit() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Não foi possível resolver o commit git atual.');
  return result.stdout.trim();
}

function main() {
  const apiUrl = assertProductionWebApiBaseUrl(process.env.VITE_API_BASE_URL);
  assertReleaseSigningEnv(process.env);

  const { version, versionCode } = readAndroidVersion(
    readFileSync('package.json', 'utf8'),
    readFileSync(join('android', 'version.json'), 'utf8'),
  );
  const { minSdk, targetSdk } = readSdkVersions(readFileSync(join('android', 'variables.gradle'), 'utf8'));

  run('node', ['scripts/validate-android.mjs']);
  run(process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew', ['assembleRelease'], 'android');

  const apkSource = join('android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  const messages = verifyApkBestEffort(apkSource, {
    applicationId: 'com.plannerfin.app',
    versionName: version,
    versionCode,
  });
  for (const message of messages) console.log(message);

  const apkBuffer = readFileSync(apkSource);
  const sha256 = computeSha256(apkBuffer);
  const metadata = buildReleaseMetadata({
    version,
    versionCode,
    sha256,
    size: apkBuffer.byteLength,
    createdAt: new Date().toISOString(),
    gitCommit: readGitCommit(),
    applicationId: 'com.plannerfin.app',
    minSdk,
    targetSdk,
    apiBaseUrl: apiUrl,
  });

  const targetDir = join('..', '..', 'artifacts', 'android-releases', version);
  mkdirSync(targetDir, { recursive: true });
  const apkName = `planner-fin-${version}.apk`;
  copyFileSync(apkSource, join(targetDir, apkName));
  writeFileSync(join(targetDir, `${apkName}.sha256`), `${sha256}  ${apkName}\n`);
  writeFileSync(join(targetDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);

  console.log(
    `Release Android ${version} (versionCode ${versionCode}) gerada em ${targetDir}. sha256=${sha256} size=${apkBuffer.byteLength}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Erro desconhecido.');
    process.exitCode = 1;
  }
}
