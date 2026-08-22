import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { inspectRootEnv, loadRootEnv } from './root-env.mjs';

function rootEnvFixture(content, env = {}) {
  const root = resolve('C:\\planner-fin-test');
  const envPath = resolve(root, '.env');
  return {
    root,
    env,
    options: {
      env,
      exists: (path) => resolve(path) === envPath,
      readFile: () => content,
    },
  };
}

test('carrega DATABASE_URL do .env único na raiz', () => {
  const fixture = rootEnvFixture(
    'DATABASE_URL="postgresql://local:local@localhost:5432/planner_fin_local"\n',
  );

  const result = loadRootEnv(fixture.root, fixture.options);

  assert.equal(result.loaded, true);
  assert.equal(
    fixture.env.DATABASE_URL,
    'postgresql://local:local@localhost:5432/planner_fin_local',
  );
});

test('preserva process.env existente acima do .env raiz', () => {
  const fixture = rootEnvFixture(
    'DATABASE_URL="postgresql://arquivo:arquivo@localhost:5432/arquivo"\n',
    { DATABASE_URL: 'postgresql://railway:railway@postgres.internal:5432/railway' },
  );

  loadRootEnv(fixture.root, fixture.options);

  assert.equal(
    fixture.env.DATABASE_URL,
    'postgresql://railway:railway@postgres.internal:5432/railway',
  );
  assert.equal(inspectRootEnv(fixture.root, fixture.options).databaseUrlSource, 'process.env');
});

test('não inventa configuração quando o .env raiz está ausente', () => {
  const root = resolve('C:\\planner-fin-sem-env');
  const env = {};
  const options = { env, exists: () => false, readFile: () => '' };

  assert.deepEqual(loadRootEnv(root, options).loadedKeys, []);
  assert.equal(inspectRootEnv(root, options).databaseUrl, undefined);
});
