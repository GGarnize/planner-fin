import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createInMemoryReleaseStorage } from '@planner-fin/storage';
import {
  LATEST_KEY,
  assertMetadataMatchesArtifacts,
  assertValidVersion,
  loadBucketConfigFromEnv,
  metadataKeyFor,
  parseArgs,
  publishRelease,
  readCurrentLatest,
  releaseKeyFor,
  sha256KeyFor,
} from './publish-android-release.mjs';

function metadataFor(version, overrides = {}) {
  return {
    version,
    versionCode: 1,
    sha256: 'a'.repeat(64),
    size: 4,
    createdAt: '2026-08-14T00:00:00.000Z',
    gitCommit: 'abc123',
    applicationId: 'com.plannerfin.app',
    minSdk: 24,
    targetSdk: 36,
    apiBaseUrl: 'https://api.example.test/api',
    ...overrides,
  };
}

test('assertValidVersion aceita SemVer e rejeita o resto (bloqueia path traversal)', () => {
  assert.doesNotThrow(() => assertValidVersion('0.1.0'));
  for (const invalid of ['v0.1.0', '../../etc/passwd', '0.1', '0.1.0-beta', '']) {
    assert.throws(() => assertValidVersion(invalid), /SemVer/);
  }
});

test('assertMetadataMatchesArtifacts detecta divergência de versão/sha256/tamanho', () => {
  const metadata = metadataFor('0.1.0');
  assert.doesNotThrow(() =>
    assertMetadataMatchesArtifacts(metadata, { version: '0.1.0', sha256: metadata.sha256, size: 4 }),
  );
  assert.throws(
    () => assertMetadataMatchesArtifacts(metadata, { version: '0.1.1', sha256: metadata.sha256, size: 4 }),
    /version/,
  );
  assert.throws(
    () => assertMetadataMatchesArtifacts(metadata, { version: '0.1.0', sha256: 'b'.repeat(64), size: 4 }),
    /sha256/,
  );
  assert.throws(
    () => assertMetadataMatchesArtifacts(metadata, { version: '0.1.0', sha256: metadata.sha256, size: 5 }),
    /size/,
  );
});

test('parseArgs entende --version= e --yes', () => {
  assert.deepEqual(parseArgs([]), { version: undefined, yes: false });
  assert.deepEqual(parseArgs(['--version=0.1.0', '--yes']), { version: '0.1.0', yes: true });
});

test('loadBucketConfigFromEnv falha fechado quando falta qualquer variável do bucket', () => {
  const full = {
    BUCKET: 'b',
    ENDPOINT: 'https://storage.railway.app',
    REGION: 'auto',
    ACCESS_KEY_ID: 'id',
    SECRET_ACCESS_KEY: 'secret',
  };
  assert.deepEqual(loadBucketConfigFromEnv(full), {
    bucket: 'b',
    endpoint: 'https://storage.railway.app',
    region: 'auto',
    accessKeyId: 'id',
    secretAccessKey: 'secret',
  });
  for (const missing of ['BUCKET', 'ENDPOINT', 'REGION', 'ACCESS_KEY_ID', 'SECRET_ACCESS_KEY']) {
    const partial = { ...full, [missing]: undefined };
    assert.throws(() => loadBucketConfigFromEnv(partial), new RegExp(missing));
  }
});

test('publishRelease exige confirmação explícita', async () => {
  const storage = createInMemoryReleaseStorage();
  await assert.rejects(
    publishRelease({
      storage,
      version: '0.1.0',
      apkBuffer: Buffer.from('apk!'),
      sha256: metadataFor('0.1.0').sha256,
      metadata: metadataFor('0.1.0'),
      confirm: false,
    }),
    /confirmação explícita/,
  );
});

test('publishRelease publica, verifica remoto e atualiza latest.json por último', async () => {
  const storage = createInMemoryReleaseStorage();
  const apkBuffer = Buffer.from('apk!');
  const metadata = metadataFor('0.1.0', { sha256: shaOf(apkBuffer) });
  const logs = [];

  const latest = await publishRelease({
    storage,
    version: '0.1.0',
    apkBuffer,
    sha256: metadata.sha256,
    metadata,
    confirm: true,
    log: (message) => logs.push(message),
  });

  assert.equal(latest.version, '0.1.0');
  assert.equal(latest.versionCode, 1);
  await assert.doesNotReject(storage.getObject(releaseKeyFor('0.1.0')));
  await assert.doesNotReject(storage.getObject(sha256KeyFor('0.1.0')));
  await assert.doesNotReject(storage.getObject(metadataKeyFor('0.1.0')));
  const storedLatest = await readCurrentLatest(storage);
  assert.equal(storedLatest.version, '0.1.0');
  assert.ok(logs.some((line) => line.includes('Upload concluído')));
  assert.ok(logs.some((line) => line.includes('latest.json atualizado')));
});

test('publishRelease bloqueia sobrescrita de release já publicada (imutabilidade)', async () => {
  const storage = createInMemoryReleaseStorage();
  const apkBuffer = Buffer.from('apk!');
  const metadata = metadataFor('0.1.0', { sha256: shaOf(apkBuffer) });
  await publishRelease({ storage, version: '0.1.0', apkBuffer, sha256: metadata.sha256, metadata, confirm: true });

  await assert.rejects(
    publishRelease({ storage, version: '0.1.0', apkBuffer, sha256: metadata.sha256, metadata, confirm: true }),
    /imutável/,
  );
});

test('publishRelease bloqueia versionCode não crescente em relação ao latest atual', async () => {
  const storage = createInMemoryReleaseStorage();
  const apkA = Buffer.from('apk-a');
  const metadataA = metadataFor('0.1.0', { sha256: shaOf(apkA), size: apkA.byteLength, versionCode: 2 });
  await publishRelease({ storage, version: '0.1.0', apkBuffer: apkA, sha256: metadataA.sha256, metadata: metadataA, confirm: true });

  const apkB = Buffer.from('apk-b');
  const metadataB = metadataFor('0.1.1', { sha256: shaOf(apkB), size: apkB.byteLength, versionCode: 2 });
  await assert.rejects(
    publishRelease({ storage, version: '0.1.1', apkBuffer: apkB, sha256: metadataB.sha256, metadata: metadataB, confirm: true }),
    /versionCode/,
  );
});

test('readCurrentLatest retorna null quando latest.json ainda não existe', async () => {
  const storage = createInMemoryReleaseStorage();
  assert.equal(await readCurrentLatest(storage), null);
});

test('LATEST_KEY aponta para o caminho lógico documentado', () => {
  assert.equal(LATEST_KEY, 'android/latest.json');
});

function shaOf(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}
