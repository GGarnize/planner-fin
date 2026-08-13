import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composeApiBaseUrl,
  isVirtualAdapterName,
  selectLanIPv4,
  validateRemoteApiBaseUrl,
  withTemporaryEnv,
} from './dx-helpers.mjs';

test('detecta IPv4 LAN ignorando Docker e WSL', () => {
  const ip = selectLanIPv4([
    { name: 'vEthernet (WSL)', description: 'Hyper-V Virtual Ethernet Adapter', ip: '172.24.10.1' },
    { name: 'DockerNAT', description: 'Docker adapter', ip: '192.168.65.1' },
    { name: 'Wi-Fi', description: 'Intel Wi-Fi', ip: '192.168.15.22' },
  ]);
  assert.equal(ip, '192.168.15.22');
});

test('permite override explicito de IPv4 LAN privado', () => {
  assert.equal(selectLanIPv4([], '10.0.0.50'), '10.0.0.50');
  assert.throws(() => selectLanIPv4([], '8.8.8.8'), /IPv4 privado/);
});

test('classifica adapters virtuais conhecidos', () => {
  assert.equal(isVirtualAdapterName('Docker Desktop'), true);
  assert.equal(isVirtualAdapterName('vEthernet WSL'), true);
  assert.equal(isVirtualAdapterName('Intel Wi-Fi 6'), false);
});

test('compoe URLs Android por target', () => {
  assert.equal(composeApiBaseUrl({ target: 'emulator' }), 'https://10.0.2.2:3443/api');
  assert.equal(
    composeApiBaseUrl({ target: 'lan', lanIp: '192.168.1.20' }),
    'https://192.168.1.20:3443/api',
  );
});

test('valida URL remota HTTPS absoluta sem credenciais', () => {
  assert.equal(
    validateRemoteApiBaseUrl('https://dev.example.test:3443/api'),
    'https://dev.example.test:3443/api',
  );
  assert.throws(() => validateRemoteApiBaseUrl('http://dev.example.test/api'), /HTTPS/);
  assert.throws(() => validateRemoteApiBaseUrl('/api'), /absoluta/);
  assert.throws(
    () => validateRemoteApiBaseUrl('https://user:pass@example.test/api'),
    /credenciais/,
  );
  assert.throws(() => validateRemoteApiBaseUrl('https://example.test/api?x=1'), /query/);
});

test('restaura ambiente apos execucao temporaria', () => {
  const env = { KEEP: 'ok', VITE_API_BASE_URL: 'old' };
  withTemporaryEnv(env, { VITE_API_BASE_URL: 'new', TEMP_ONLY: '1' }, () => {
    assert.equal(env.VITE_API_BASE_URL, 'new');
    assert.equal(env.TEMP_ONLY, '1');
  });
  assert.deepEqual(env, { KEEP: 'ok', VITE_API_BASE_URL: 'old' });
});
