import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NON_SECRET_CONFIG_FIELDS,
  assertConfigComplete,
  assertNoSecretLikeFields,
  assertRepoCleanForRelease,
  assertRequiredSecrets,
  computeNextPatchVersion,
  computeNextVersionCode,
  findCompleteBuildTools,
  loadOrInitReleaseConfig,
  redactSecrets,
  saveReleaseConfig,
} from './release-helpers.mjs';

test('computeNextPatchVersion incrementa apenas o patch', () => {
  assert.equal(computeNextPatchVersion('0.1.0'), '0.1.1');
  assert.equal(computeNextPatchVersion('1.2.9'), '1.2.10');
  assert.throws(() => computeNextPatchVersion('0.1'), /inválida/);
  assert.throws(() => computeNextPatchVersion('v0.1.0'), /inválida/);
});

test('computeNextVersionCode incrementa e falha fechado para valores inválidos', () => {
  assert.equal(computeNextVersionCode(1), 2);
  assert.equal(computeNextVersionCode(41), 42);
  for (const invalid of [0, -1, 1.5, NaN, undefined]) {
    assert.throws(() => computeNextVersionCode(invalid), /inválido/);
  }
});

test('findCompleteBuildTools ignora versão mais nova incompleta (ex: 36.0.0 sem apksigner/aapt)', () => {
  const files = {
    '34.0.0': ['apksigner.bat', 'aapt.exe'],
    '35.0.0': ['apksigner.bat', 'aapt.exe'],
    '36.0.0': ['aapt.exe'],
  };
  const listDirFn = () => Object.keys(files);
  const existsFn = (path) => {
    const normalized = path.replaceAll('\\', '/');
    const dir = Object.keys(files).find((version) => normalized.includes(version));
    if (!dir) return true;
    return files[dir].some((file) => normalized.endsWith(file));
  };
  const result = findCompleteBuildTools('C:/Sdk', { listDirFn, existsFn, platform: 'win32' });
  assert.equal(result.version, '35.0.0');
});

test('findCompleteBuildTools falha fechado quando nenhuma versão está completa', () => {
  const listDirFn = () => ['36.0.0'];
  const existsFn = (path) => path.replaceAll('\\', '/').endsWith('build-tools');
  assert.throws(
    () => findCompleteBuildTools('C:/Sdk', { listDirFn, existsFn, platform: 'win32' }),
    /Nenhuma versão completa/,
  );
});

test('findCompleteBuildTools falha fechado quando build-tools não existe', () => {
  assert.throws(
    () => findCompleteBuildTools('C:/Sdk', { existsFn: () => false }),
    /não encontrado/,
  );
});

test('assertNoSecretLikeFields bloqueia chaves de segredo no config não secreto', () => {
  assert.doesNotThrow(() => assertNoSecretLikeFields({ apiBaseUrlProd: 'https://x/api' }));
  for (const badKey of ['keystorePassword', 'ACCESS_KEY_ID', 'railwaySecret', 'apiToken']) {
    assert.throws(() => assertNoSecretLikeFields({ [badKey]: 'x' }), /segredo/);
  }
});

test('loadOrInitReleaseConfig cria template quando ausente e não sobrescreve quando já existe', () => {
  const defaults = { apiBaseUrlProd: 'https://api.example.test/api' };
  let written = null;
  const created = loadOrInitReleaseConfig('C:/fake/release-config.json', defaults, {
    existsFn: () => false,
    writeFileFn: (path, content) => {
      written = { path, content };
    },
    mkdirFn: () => {},
  });
  assert.equal(created.created, true);
  assert.deepEqual(created.config, defaults);
  assert.ok(written.content.includes('api.example.test'));

  const existing = { apiBaseUrlProd: 'https://real.example.test/api' };
  const loaded = loadOrInitReleaseConfig('C:/fake/release-config.json', defaults, {
    existsFn: () => true,
    readFileFn: () => JSON.stringify(existing),
  });
  assert.equal(loaded.created, false);
  assert.deepEqual(loaded.config, existing);
});

test('loadOrInitReleaseConfig falha fechado se o config existente contiver campo de segredo', () => {
  assert.throws(
    () =>
      loadOrInitReleaseConfig(
        'C:/fake/release-config.json',
        { apiBaseUrlProd: 'https://x/api' },
        { existsFn: () => true, readFileFn: () => JSON.stringify({ keystorePassword: 'nope' }) },
      ),
    /segredo/,
  );
});

test('saveReleaseConfig sempre sobrescreve e falha fechado para campos de segredo', () => {
  let written = null;
  const config = { apiBaseUrlProd: 'https://updated.example.test/api' };
  saveReleaseConfig('C:/fake/release-config.json', config, {
    writeFileFn: (path, content) => {
      written = { path, content };
    },
    mkdirFn: () => {},
  });
  assert.ok(written.content.includes('updated.example.test'));
  assert.throws(
    () => saveReleaseConfig('C:/fake/release-config.json', { keyPassword: 'nope' }),
    /segredo/,
  );
});

test('assertConfigComplete detecta campos não secretos faltando', () => {
  const full = Object.fromEntries(NON_SECRET_CONFIG_FIELDS.map((field) => [field, 'x']));
  assert.deepEqual(assertConfigComplete(full), full);
  const partial = { ...full, bucket: '' };
  assert.throws(() => assertConfigComplete(partial), /bucket/);
});

test('assertRequiredSecrets falha fechado quando segredo obrigatório falta', () => {
  assert.doesNotThrow(() =>
    assertRequiredSecrets({ KeystorePassword: 'a', KeyPassword: 'b' }, ['KeystorePassword', 'KeyPassword']),
  );
  assert.throws(
    () => assertRequiredSecrets({ KeystorePassword: 'a' }, ['KeystorePassword', 'KeyPassword']),
    /KeyPassword/,
  );
  assert.throws(() => assertRequiredSecrets({}, ['KeystorePassword']), /Credential Manager/);
});

test('redactSecrets nunca deixa o valor real de uma chave de segredo escapar para o log', () => {
  const redacted = redactSecrets(
    { bucket: 'b', accessKeyId: 'AKIA_REAL_VALUE', secretAccessKey: 'super-secret' },
    ['accessKeyId', 'secretAccessKey'],
  );
  assert.equal(redacted.bucket, 'b');
  assert.notEqual(redacted.accessKeyId, 'AKIA_REAL_VALUE');
  assert.notEqual(redacted.secretAccessKey, 'super-secret');
  assert.ok(!JSON.stringify(redacted).includes('AKIA_REAL_VALUE'));
  assert.ok(!JSON.stringify(redacted).includes('super-secret'));
});

test('assertRepoCleanForRelease aceita repo limpo e apenas os arquivos de bump previstos', () => {
  assert.deepEqual(assertRepoCleanForRelease(''), []);
  assert.doesNotThrow(() =>
    assertRepoCleanForRelease(' M apps/web/package.json\n M apps/web/android/version.json\n'),
  );
});

test('assertRepoCleanForRelease bloqueia qualquer arquivo fora do bump previsto', () => {
  assert.throws(
    () => assertRepoCleanForRelease(' M apps/web/package.json\n?? some-other-file.ts\n'),
    /some-other-file\.ts/,
  );
});
