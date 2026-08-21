import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertProductionWebApiBaseUrl,
} from './validate-prod-web-env.mjs';
import {
  assertReleaseSigningEnv,
  buildReleaseMetadata,
  computeSha256,
  readAndroidVersion,
  readSdkVersions,
} from './build-android-release.mjs';

const APPLICATION_ID = 'com.plannerfin.app';
const REQUIRED_TARGET_SDK = 36;

function run(command, args, cwd = '.') {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`Comando falhou: ${command} ${args.join(' ')}`);
}

function capture(command, args, cwd = '.') {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

function readGitCommit() {
  const result = capture('git', ['rev-parse', 'HEAD']);
  if (result.status !== 0) throw new Error('Nao foi possivel resolver o commit git atual.');
  return result.stdout.trim();
}

function verifyOutputMetadataOrThrow(metadataPath) {
  if (!existsSync(metadataPath)) {
    throw new Error(`Metadados do bundle nao encontrados: ${metadataPath}`);
  }
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  if (metadata.applicationId !== APPLICATION_ID) {
    throw new Error(`AAB nao corresponde ao applicationId ${APPLICATION_ID}.`);
  }
  if (metadata.artifactType?.type !== 'BUNDLE') {
    throw new Error('Metadados do bundle nao indicam artifactType BUNDLE.');
  }
  return 'output-metadata.json: applicationId e artifactType BUNDLE confirmados.';
}

function verifyMergedManifestOrThrow(manifestPath, { versionName, versionCode, minSdk, targetSdk }) {
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifesto merged release nao encontrado: ${manifestPath}`);
  }
  const manifest = readFileSync(manifestPath, 'utf8');
  const expected = [
    [`package="${APPLICATION_ID}"`, 'applicationId'],
    [`android:versionName="${versionName}"`, 'versionName'],
    [`android:versionCode="${versionCode}"`, 'versionCode'],
    [`android:minSdkVersion="${minSdk}"`, 'minSdk'],
    [`android:targetSdkVersion="${targetSdk}"`, 'targetSdk'],
  ];
  for (const [snippet, label] of expected) {
    if (!manifest.includes(snippet)) throw new Error(`Manifesto release nao confirma ${label}.`);
  }
  if (manifest.includes('usesCleartextTraffic="true"')) {
    throw new Error('Manifesto release nao pode habilitar cleartext global.');
  }
  return 'manifesto merged release: package/version/sdk/cleartext confirmados.';
}

function verifySignedBundleOrThrow(bundlePath) {
  if (!existsSync(bundlePath)) throw new Error(`AAB esperado nao encontrado: ${bundlePath}`);
  const jarsigner = capture('jarsigner', ['-verify', '-certs', bundlePath]);
  const output = `${jarsigner.stdout ?? ''}${jarsigner.stderr ?? ''}`;
  if (jarsigner.status !== 0 || !/jar verified|jar verificado/i.test(output)) {
    throw new Error(`jarsigner nao confirmou a assinatura do AAB: ${output}`);
  }
  return 'jarsigner: assinatura do AAB verificada com sucesso.';
}

function readSigningCertificate(env) {
  const keytool = capture('keytool', [
    '-list',
    '-v',
    '-keystore',
    env.PLANNER_FIN_KEYSTORE_FILE,
    '-alias',
    env.PLANNER_FIN_KEY_ALIAS,
    '-storepass',
    env.PLANNER_FIN_KEYSTORE_PASSWORD,
  ]);
  const output = `${keytool.stdout ?? ''}${keytool.stderr ?? ''}`;
  if (keytool.status !== 0) throw new Error('keytool nao conseguiu ler o certificado da keystore release.');
  const sha1 = output.match(/SHA1:\s*([0-9A-F:]+)/i)?.[1] ?? null;
  const sha256 = output.match(/SHA256:\s*([0-9A-F:]+)/i)?.[1] ?? null;
  const publicKeyAlgorithm =
    output.match(/(?:Subject Public Key Algorithm|Algoritmo de Chave P.blica do Assunto):\s*(.+)/i)?.[1]?.trim() ??
    null;
  const signatureAlgorithm =
    output.match(/(?:Signature algorithm name|Nome do algoritmo de assinatura):\s*(.+)/i)?.[1]?.trim() ??
    null;
  return {
    alias: env.PLANNER_FIN_KEY_ALIAS,
    sha1,
    sha256,
    publicKeyAlgorithm,
    signatureAlgorithm,
  };
}

function main() {
  const apiUrl = assertProductionWebApiBaseUrl(process.env.VITE_API_BASE_URL);
  assertReleaseSigningEnv(process.env);

  const { version, versionCode } = readAndroidVersion(
    readFileSync('package.json', 'utf8'),
    readFileSync(join('android', 'version.json'), 'utf8'),
  );
  const { minSdk, targetSdk } = readSdkVersions(readFileSync(join('android', 'variables.gradle'), 'utf8'));
  const compileSdk = Number(
    readFileSync(join('android', 'variables.gradle'), 'utf8').match(/compileSdkVersion\s*=\s*(\d+)/)?.[1],
  );
  if (targetSdk < REQUIRED_TARGET_SDK) {
    throw new Error(`Google Play exige targetSdk ${REQUIRED_TARGET_SDK}+; atual: ${targetSdk}.`);
  }
  if (compileSdk < REQUIRED_TARGET_SDK) {
    throw new Error(`compileSdk precisa ser ${REQUIRED_TARGET_SDK}+ para o bundle Play; atual: ${compileSdk}.`);
  }

  run('node', ['scripts/validate-android.mjs']);
  run(process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew', ['bundleRelease'], 'android');

  const bundleSource = join('android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  const metadataSource = join(
    'android',
    'app',
    'build',
    'intermediates',
    'bundle_ide_model',
    'release',
    'produceReleaseBundleIdeListingFile',
    'output-metadata.json',
  );
  const manifestSource = join(
    'android',
    'app',
    'build',
    'intermediates',
    'merged_manifests',
    'release',
    'processReleaseManifest',
    'AndroidManifest.xml',
  );
  const messages = [
    verifySignedBundleOrThrow(bundleSource),
    verifyOutputMetadataOrThrow(metadataSource),
    verifyMergedManifestOrThrow(manifestSource, { versionName: version, versionCode, minSdk, targetSdk }),
  ];
  for (const message of messages) console.log(message);

  const bundleBuffer = readFileSync(bundleSource);
  const sha256 = computeSha256(bundleBuffer);
  const certificate = readSigningCertificate(process.env);
  const metadata = {
    ...buildReleaseMetadata({
      version,
      versionCode,
      sha256,
      size: bundleBuffer.byteLength,
      createdAt: new Date().toISOString(),
      gitCommit: readGitCommit(),
      applicationId: APPLICATION_ID,
      minSdk,
      targetSdk,
      apiBaseUrl: apiUrl,
    }),
    compileSdk,
    signingCertificate: certificate,
    artifactType: 'aab',
  };

  const targetDir = join('..', '..', 'artifacts', 'android-play', version);
  mkdirSync(targetDir, { recursive: true });
  const bundleName = `planner-fin-${version}.aab`;
  copyFileSync(bundleSource, join(targetDir, bundleName));
  copyFileSync(metadataSource, join(targetDir, 'output-metadata.json'));
  copyFileSync(manifestSource, join(targetDir, 'AndroidManifest.merged.xml'));
  writeFileSync(join(targetDir, `${bundleName}.sha256`), `${sha256}  ${bundleName}\n`);
  writeFileSync(join(targetDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);

  console.log(
    `Bundle Play ${version} (versionCode ${versionCode}) gerado em ${targetDir}. sha256=${sha256} size=${bundleBuffer.byteLength}`,
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
