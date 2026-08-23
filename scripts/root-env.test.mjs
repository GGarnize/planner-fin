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

test('A01: sem API_CROSS_SITE_ORIGINS no .env, assume o mesmo default de apps/api/src/config/env.ts', () => {
  const fixture = rootEnvFixture('API_CORS_ORIGINS="http://localhost:9000,https://localhost"\n');

  const result = inspectRootEnv(fixture.root, fixture.options);

  assert.deepEqual(result.corsOrigins, ['http://localhost:9000', 'https://localhost']);
  assert.deepEqual(result.crossSiteOrigins, ['https://localhost']);
});

test('API_CROSS_SITE_ORIGINS explícito no .env é respeitado', () => {
  const fixture = rootEnvFixture(
    'API_CORS_ORIGINS="https://web-planner-fin.up.railway.app,https://localhost"\n' +
      'API_CROSS_SITE_ORIGINS="https://web-planner-fin.up.railway.app,https://localhost"\n',
  );

  const result = inspectRootEnv(fixture.root, fixture.options);

  assert.deepEqual(result.crossSiteOrigins, [
    'https://web-planner-fin.up.railway.app',
    'https://localhost',
  ]);
});
