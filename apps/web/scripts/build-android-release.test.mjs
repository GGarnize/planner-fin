import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RELEASE_SIGNING_VARS,
  assertReleaseSigningEnv,
  buildReleaseMetadata,
  computeSha256,
  readAndroidVersion,
  readSdkVersions,
  verifyApkOrThrow,
} from './build-android-release.mjs';

const EXPECTED = { applicationId: 'com.plannerfin.app', versionName: '0.1.0', versionCode: 1 };
const ENOENT = { error: { code: 'ENOENT' } };
const APKSIGNER_OK = {
  status: 0,
  stdout: 'Signer #1 certificate SHA-256 digest: aa11bb22\n',
  stderr: '',
};
const AAPT_OK = {
  status: 0,
  stdout: "package: name='com.plannerfin.app' versionCode='1' versionName='0.1.0'\n",
};

function fakeSpawn(byCommand) {
  return (command) => byCommand[command] ?? { status: 0, stdout: '', stderr: '' };
}

test('verifyApkOrThrow falha fechado quando apksigner não está no PATH', () => {
  assert.throws(
    () => verifyApkOrThrow('app.apk', EXPECTED, fakeSpawn({ apksigner: ENOENT })),
    /apksigner não encontrado/,
  );
});

test('verifyApkOrThrow falha fechado quando apksigner reporta assinatura inválida', () => {
  const spawn = fakeSpawn({ apksigner: { status: 1, stdout: '', stderr: 'assinatura inválida' } });
  assert.throws(() => verifyApkOrThrow('app.apk', EXPECTED, spawn), /apksigner reportou falha/);
});

test('verifyApkOrThrow falha fechado quando nem aapt nem apkanalyzer estão no PATH', () => {
  const spawn = fakeSpawn({ apksigner: APKSIGNER_OK, aapt: ENOENT, apkanalyzer: ENOENT });
  assert.throws(() => verifyApkOrThrow('app.apk', EXPECTED, spawn), /Nem aapt nem apkanalyzer/);
});

test('verifyApkOrThrow aprova quando apksigner e aapt confirmam o APK', () => {
  const spawn = fakeSpawn({ apksigner: APKSIGNER_OK, aapt: AAPT_OK });
  const messages = verifyApkOrThrow('app.apk', EXPECTED, spawn);
  assert.ok(messages.some((m) => m.includes('apksigner: assinatura verificada')));
  assert.ok(messages.some((m) => m.includes('aapt: applicationId/versionName/versionCode')));
});

test('verifyApkOrThrow falha fechado quando aapt reporta applicationId divergente', () => {
  const spawn = fakeSpawn({
    apksigner: APKSIGNER_OK,
    aapt: { status: 0, stdout: "package: name='com.other.app' versionCode='1' versionName='0.1.0'\n" },
  });
  assert.throws(() => verifyApkOrThrow('app.apk', EXPECTED, spawn), /applicationId/);
});

test('verifyApkOrThrow usa apkanalyzer quando aapt está ausente e aprova quando os três campos batem', () => {
  const dispatch = (command, args) => {
    if (command === 'apksigner') return APKSIGNER_OK;
    if (command === 'aapt') return ENOENT;
    if (command === 'apkanalyzer') {
      if (args[1] === 'application-id') return { status: 0, stdout: 'com.plannerfin.app\n' };
      if (args[1] === 'version-name') return { status: 0, stdout: '0.1.0\n' };
      if (args[1] === 'version-code') return { status: 0, stdout: '1\n' };
    }
    throw new Error(`comando inesperado: ${command}`);
  };
  const messages = verifyApkOrThrow('app.apk', EXPECTED, dispatch, () => false);
  assert.ok(messages.some((m) => m.includes('apkanalyzer: applicationId/versionName/versionCode')));
});

test('verifyApkOrThrow falha fechado quando apkanalyzer reporta versionCode divergente', () => {
  const dispatch = (command, args) => {
    if (command === 'apksigner') return APKSIGNER_OK;
    if (command === 'aapt') return ENOENT;
    if (command === 'apkanalyzer') {
      if (args[1] === 'application-id') return { status: 0, stdout: 'com.plannerfin.app\n' };
      if (args[1] === 'version-name') return { status: 0, stdout: '0.1.0\n' };
      if (args[1] === 'version-code') return { status: 0, stdout: '2\n' };
    }
    throw new Error(`comando inesperado: ${command}`);
  };
  assert.throws(() => verifyApkOrThrow('app.apk', EXPECTED, dispatch, () => false), /versionCode/);
});

test('verifyApkOrThrow falha fechado quando o APK está assinado com a keystore de debug local', () => {
  const spawn = fakeSpawn({
    apksigner: APKSIGNER_OK,
    keytool: { status: 0, stdout: 'SHA256: AA:11:BB:22\n' },
  });
  const fileExists = () => true;
  assert.throws(
    () => verifyApkOrThrow('app.apk', EXPECTED, spawn, fileExists),
    /assinado com a keystore de debug local/,
  );
});

test('assertReleaseSigningEnv exige as quatro variáveis de keystore', () => {
  assert.throws(() => assertReleaseSigningEnv({}), /PLANNER_FIN_KEYSTORE_FILE/);
  const partial = Object.fromEntries(RELEASE_SIGNING_VARS.slice(0, 2).map((name) => [name, 'x']));
  assert.throws(() => assertReleaseSigningEnv(partial), /PLANNER_FIN_KEY_ALIAS/);
  const full = Object.fromEntries(RELEASE_SIGNING_VARS.map((name) => [name, 'x']));
  assert.doesNotThrow(() => assertReleaseSigningEnv(full));
});

test('readAndroidVersion valida SemVer e versionCode inteiro positivo', () => {
  const result = readAndroidVersion(
    JSON.stringify({ version: '0.1.0' }),
    JSON.stringify({ versionCode: 3 }),
  );
  assert.deepEqual(result, { version: '0.1.0', versionCode: 3 });

  assert.throws(
    () => readAndroidVersion(JSON.stringify({ version: 'v1' }), JSON.stringify({ versionCode: 1 })),
    /SemVer/,
  );
  assert.throws(
    () =>
      readAndroidVersion(JSON.stringify({ version: '0.1.0' }), JSON.stringify({ versionCode: 0 })),
    /inteiro positivo/,
  );
  assert.throws(
    () =>
      readAndroidVersion(
        JSON.stringify({ version: '0.1.0' }),
        JSON.stringify({ versionCode: 1.5 }),
      ),
    /inteiro positivo/,
  );
});

test('readSdkVersions extrai minSdk/targetSdk de variables.gradle', () => {
  const gradle = "ext {\n    minSdkVersion = 24\n    targetSdkVersion = 36\n}\n";
  assert.deepEqual(readSdkVersions(gradle), { minSdk: 24, targetSdk: 36 });
  assert.throws(() => readSdkVersions('ext {}'), /minSdk/);
});

test('computeSha256 é determinístico', () => {
  const a = computeSha256(Buffer.from('conteudo'));
  const b = computeSha256(Buffer.from('conteudo'));
  const c = computeSha256(Buffer.from('outro'));
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('buildReleaseMetadata não inclui segredos e mantém todos os campos exigidos', () => {
  const metadata = buildReleaseMetadata({
    version: '0.1.0',
    versionCode: 1,
    sha256: 'a'.repeat(64),
    size: 123,
    createdAt: '2026-08-14T00:00:00.000Z',
    gitCommit: 'abc123',
    applicationId: 'com.plannerfin.app',
    minSdk: 24,
    targetSdk: 36,
    apiBaseUrl: 'https://api.example.test/api',
  });
  assert.deepEqual(Object.keys(metadata).sort(), [
    'apiBaseUrl',
    'applicationId',
    'createdAt',
    'gitCommit',
    'minSdk',
    'sha256',
    'size',
    'targetSdk',
    'version',
    'versionCode',
  ]);
  for (const forbidden of ['keystore', 'password', 'secret', 'token']) {
    assert.equal(JSON.stringify(metadata).toLowerCase().includes(forbidden), false);
  }
});
