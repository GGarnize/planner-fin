import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertProductionWebApiBaseUrl } from './validate-prod-web-env.mjs';

test('aceita URL HTTPS terminada em /api', () => {
  assert.equal(
    assertProductionWebApiBaseUrl('https://api.example.test/api'),
    'https://api.example.test/api',
  );
});

test('rejeita ausência de valor', () => {
  assert.throws(() => assertProductionWebApiBaseUrl(''), /obrigatória/);
  assert.throws(() => assertProductionWebApiBaseUrl(undefined), /obrigatória/);
});

test('rejeita HTTP', () => {
  assert.throws(() => assertProductionWebApiBaseUrl('http://api.example.test/api'), /HTTPS/);
});

test('rejeita URL sem sufixo /api', () => {
  assert.throws(() => assertProductionWebApiBaseUrl('https://api.example.test'), /\/api/);
});

test('rejeita host local/LAN', () => {
  for (const url of [
    'https://localhost/api',
    'https://127.0.0.1/api',
    'https://10.0.2.2/api',
    'https://192.168.0.10/api',
  ]) {
    assert.throws(() => assertProductionWebApiBaseUrl(url), /local\/LAN/);
  }
});
