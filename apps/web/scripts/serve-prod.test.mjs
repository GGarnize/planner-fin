import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProdServer } from './serve-prod.mjs';

function makeFixtureDist() {
  const dir = mkdtempSync(join(tmpdir(), 'planner-fin-web-dist-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html><body>PlannerFin</body></html>');
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'app.abc123.js'), 'console.log("app");');
  return dir;
}

async function withServer(fn) {
  const distDir = makeFixtureDist();
  const server = createProdServer({ distDir });
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
    rmSync(distDir, { recursive: true, force: true });
  }
}

test('/health responde 200 sem depender de arquivo em disco', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('raiz serve index.html com cache no-cache', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /PlannerFin/);
    assert.equal(response.headers.get('cache-control'), 'no-cache');
  });
});

test('rota SPA inexistente recebe fallback para index.html (200)', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/transactions/123`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /PlannerFin/);
  });
});

test('asset existente recebe cache longo/imutável', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/assets/app.abc123.js`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.match(await response.text(), /app/);
  });
});

test('asset inexistente sob /assets/ recebe 404 puro, não index.html', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/assets/missing.js`);
    assert.equal(response.status, 404);
    const body = await response.text();
    assert.doesNotMatch(body, /PlannerFin/);
  });
});
