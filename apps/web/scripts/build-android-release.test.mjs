import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RELEASE_SIGNING_VARS,
  assertReleaseSigningEnv,
  buildReleaseMetadata,
  computeSha256,
  readAndroidVersion,
  readSdkVersions,
} from './build-android-release.mjs';

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
