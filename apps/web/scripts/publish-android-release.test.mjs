import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createInMemoryReleaseStorage } from '@planner-fin/storage';
import {
  LATEST_KEY,
  assertMetadataMatchesArtifacts,
  assertRemoteReleaseMatchesLocal,
  assertValidVersion,
  loadBucketConfigFromEnv,
  metadataKeyFor,
  parseArgs,
  publishRelease,
  readCurrentLatest,
  releaseKeyFor,
  sha256KeyFor,
} from './publish-android-release.mjs';

function createSpyStorage(storage) {
  const calls = { putObjectIfAbsent: 0, putObject: 0, deleteObject: 0 };
  return {
    storage: {
      ...storage,
      async putObjectIfAbsent(...args) {
        calls.putObjectIfAbsent++;
        return storage.putObjectIfAbsent(...args);
      },
      async putObject(...args) {
        calls.putObject++;
        return storage.putObject(...args);
      },
      async deleteObject(...args) {
        calls.deleteObject++;
        return storage.deleteObject(...args);
      },
    },
    calls,
  };
}

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

test('assertRemoteReleaseMatchesLocal aceita artefato idêntico e detecta cada campo divergente', () => {
  const remote = {
    version: '0.1.1',
    versionCode: 2,
    sha256: 'a'.repeat(64),
    size: 100,
    applicationId: 'com.plannerfin.app',
  };
  assert.doesNotThrow(() => assertRemoteReleaseMatchesLocal(remote, { ...remote }));

  assert.throws(
    () => assertRemoteReleaseMatchesLocal(remote, { ...remote, sha256: 'b'.repeat(64) }),
    /sha256/,
  );
  assert.throws(() => assertRemoteReleaseMatchesLocal(remote, { ...remote, size: 101 }), /size/);
  assert.throws(
    () => assertRemoteReleaseMatchesLocal(remote, { ...remote, versionCode: 3 }),
    /versionCode/,
  );
  assert.throws(
    () => assertRemoteReleaseMatchesLocal(remote, { ...remote, applicationId: 'com.other.app' }),
    /applicationId/,
  );
});

test('publishRelease é idempotente quando a release já existe com o mesmo artefato (retry seguro)', async () => {
  const baseStorage = createInMemoryReleaseStorage();
  const apkBuffer = Buffer.from('apk!');
  const metadata = metadataFor('0.1.0', { sha256: shaOf(apkBuffer) });
  await publishRelease({ storage: baseStorage, version: '0.1.0', apkBuffer, sha256: metadata.sha256, metadata, confirm: true });

  const { storage: spyStorage, calls } = createSpyStorage(baseStorage);
  const logs = [];
  const result = await publishRelease({
    storage: spyStorage,
    version: '0.1.0',
    apkBuffer,
    sha256: metadata.sha256,
    metadata,
    confirm: true,
    log: (message) => logs.push(message),
  });

  assert.equal(result.idempotent, true);
  assert.equal(result.version, '0.1.0');
  assert.ok(logs.some((line) => line.includes('já publicada com o mesmo artefato')));
  // republish idêntico nunca reenvia o APK histórico (nem .sha256/metadata.json) — imutável de verdade.
  assert.equal(calls.putObjectIfAbsent, 0);
  // e nunca apaga nada.
  assert.equal(calls.deleteObject, 0);
  // latest.json já estava correto — nada para reescrever.
  assert.equal(calls.putObject, 0);

  await assert.doesNotReject(baseStorage.getObject(releaseKeyFor('0.1.0')));
});

test('publishRelease idempotente restaura latest.json quando ele está ausente/desatualizado para a mesma versão', async () => {
  const storage = createInMemoryReleaseStorage();
  const apkBuffer = Buffer.from('apk!');
  const metadata = metadataFor('0.1.0', { sha256: shaOf(apkBuffer) });
  await publishRelease({ storage, version: '0.1.0', apkBuffer, sha256: metadata.sha256, metadata, confirm: true });

  // Simula latest.json perdido/corrompido (ex: falha anterior no meio de uma retomada).
  await storage.deleteObject(LATEST_KEY);
  assert.equal(await readCurrentLatest(storage), null);

  const logs = [];
  const result = await publishRelease({
    storage,
    version: '0.1.0',
    apkBuffer,
    sha256: metadata.sha256,
    metadata,
    confirm: true,
    log: (message) => logs.push(message),
  });

  assert.equal(result.idempotent, true);
  assert.ok(logs.some((line) => line.includes('latest.json atualizado')));
  const restoredLatest = await readCurrentLatest(storage);
  assert.equal(restoredLatest.version, '0.1.0');
  assert.equal(restoredLatest.sha256, metadata.sha256);
});

test('publishRelease idempotente não rebaixa latest.json quando uma versão mais nova já foi publicada depois', async () => {
  const storage = createInMemoryReleaseStorage();
  const apkA = Buffer.from('apk-a');
  const metadataA = metadataFor('0.1.0', { sha256: shaOf(apkA), size: apkA.byteLength, versionCode: 1 });
  await publishRelease({ storage, version: '0.1.0', apkBuffer: apkA, sha256: metadataA.sha256, metadata: metadataA, confirm: true });

  const apkB = Buffer.from('apk-b');
  const metadataB = metadataFor('0.1.1', { sha256: shaOf(apkB), size: apkB.byteLength, versionCode: 2 });
  await publishRelease({ storage, version: '0.1.1', apkBuffer: apkB, sha256: metadataB.sha256, metadata: metadataB, confirm: true });

  // Republicar 0.1.0 de novo (idempotente) não pode fazer latest.json "voltar" para 0.1.0.
  const result = await publishRelease({ storage, version: '0.1.0', apkBuffer: apkA, sha256: metadataA.sha256, metadata: metadataA, confirm: true });
  assert.equal(result.idempotent, true);
  const latest = await readCurrentLatest(storage);
  assert.equal(latest.version, '0.1.1');
});

test('publishRelease bloqueia sobrescrita de release já publicada com artefato diferente (imutabilidade)', async () => {
  const storage = createInMemoryReleaseStorage();
  const apkBuffer = Buffer.from('apk!');
  const metadata = metadataFor('0.1.0', { sha256: shaOf(apkBuffer) });
  await publishRelease({ storage, version: '0.1.0', apkBuffer, sha256: metadata.sha256, metadata, confirm: true });

  const otherApkBuffer = Buffer.from('apk diferente!!');
  const otherSha256 = shaOf(otherApkBuffer);
  const otherMetadata = metadataFor('0.1.0', { sha256: otherSha256, size: otherApkBuffer.byteLength });

  await assert.rejects(
    publishRelease({
      storage,
      version: '0.1.0',
      apkBuffer: otherApkBuffer,
      sha256: otherSha256,
      metadata: otherMetadata,
      confirm: true,
    }),
    /imutável/,
  );
  // release remota original permanece intacta e sem alteração.
  const remoteBuffer = await storage.getObject(releaseKeyFor('0.1.0'));
  assert.equal(shaOf(remoteBuffer), metadata.sha256);
});

test('publishRelease bloqueia quando só o versionCode do artefato diverge do já publicado', async () => {
  const storage = createInMemoryReleaseStorage();
  const apkBuffer = Buffer.from('apk!');
  const metadata = metadataFor('0.1.0', { sha256: shaOf(apkBuffer), versionCode: 1 });
  await publishRelease({ storage, version: '0.1.0', apkBuffer, sha256: metadata.sha256, metadata, confirm: true });

  const conflictingMetadata = metadataFor('0.1.0', { sha256: metadata.sha256, versionCode: 5 });
  await assert.rejects(
    publishRelease({ storage, version: '0.1.0', apkBuffer, sha256: metadata.sha256, metadata: conflictingMetadata, confirm: true }),
    /versionCode/,
  );
});

test('publishRelease bloqueia quando só o applicationId do artefato diverge do já publicado', async () => {
  const storage = createInMemoryReleaseStorage();
  const apkBuffer = Buffer.from('apk!');
  const metadata = metadataFor('0.1.0', { sha256: shaOf(apkBuffer), applicationId: 'com.plannerfin.app' });
  await publishRelease({ storage, version: '0.1.0', apkBuffer, sha256: metadata.sha256, metadata, confirm: true });

  const conflictingMetadata = metadataFor('0.1.0', { sha256: metadata.sha256, applicationId: 'com.evil.app' });
  await assert.rejects(
    publishRelease({ storage, version: '0.1.0', apkBuffer, sha256: metadata.sha256, metadata: conflictingMetadata, confirm: true }),
    /applicationId/,
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

test('publishRelease atualiza latest.json de 0.1.0 para 0.1.1 via PUT direto, mantendo o histórico de 0.1.0', async () => {
  const storage = createInMemoryReleaseStorage();
  const logs = [];

  const apkA = Buffer.from('apk-0.1.0');
  const metadataA = metadataFor('0.1.0', { sha256: shaOf(apkA), size: apkA.byteLength, versionCode: 1 });
  await publishRelease({
    storage,
    version: '0.1.0',
    apkBuffer: apkA,
    sha256: metadataA.sha256,
    metadata: metadataA,
    confirm: true,
    log: (message) => logs.push(message),
  });
  const latestAfterFirst = await readCurrentLatest(storage);
  assert.equal(latestAfterFirst.version, '0.1.0');

  const apkB = Buffer.from('apk-0.1.1');
  const metadataB = metadataFor('0.1.1', { sha256: shaOf(apkB), size: apkB.byteLength, versionCode: 2 });
  const latestAfterSecond = await publishRelease({
    storage,
    version: '0.1.1',
    apkBuffer: apkB,
    sha256: metadataB.sha256,
    metadata: metadataB,
    confirm: true,
    log: (message) => logs.push(message),
  });

  assert.equal(latestAfterSecond.version, '0.1.1');
  assert.equal(latestAfterSecond.versionCode, 2);
  const storedLatest = await readCurrentLatest(storage);
  assert.deepEqual(storedLatest, latestAfterSecond);

  // 0.1.0 continua disponível no histórico — publicar 0.1.1 não apaga nem move a release anterior.
  await assert.doesNotReject(storage.getObject(releaseKeyFor('0.1.0')));
  await assert.doesNotReject(storage.getObject(metadataKeyFor('0.1.0')));
  await assert.doesNotReject(storage.getObject(releaseKeyFor('0.1.1')));

  // latest.json é atualizado por PUT direto (mutável), nunca fica ausente entre as duas publicações.
  assert.ok(logs.filter((line) => line.includes('latest.json atualizado')).length === 2);
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
