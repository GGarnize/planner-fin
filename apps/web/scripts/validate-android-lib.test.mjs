import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanStorage, storageScanContent } from './validate-android-lib.mjs';

function withFixture(files, fn) {
  const root = mkdtempSync(join(tmpdir(), 'planner-fin-validate-android-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(root, 'src', name), content, 'utf8');
    }
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('V01: sessionStorage citado só no <template> de um .vue é permitido', () => {
  withFixture(
    {
      'PrivacyPolicyPage.vue': [
        '<script setup lang="ts"></script>',
        '<template>',
        '  <p>A interface web não grava dados em sessionStorage ou IndexedDB.</p>',
        '</template>',
      ].join('\n'),
    },
    (root) => {
      const matches = scanStorage(root, 'src', /sessionStorage|indexedDB/);
      assert.deepEqual(matches, []);
    },
  );
});

test('V02: sessionStorage usado no <script setup> de um .vue é bloqueado', () => {
  withFixture(
    {
      'Broken.vue': [
        '<script setup lang="ts">',
        'sessionStorage.getItem("token");',
        '</script>',
        '<template><div /></template>',
      ].join('\n'),
    },
    (root) => {
      const matches = scanStorage(root, 'src', /sessionStorage|indexedDB/);
      assert.deepEqual(matches, [join('src', 'Broken.vue')]);
    },
  );
});

test('V03: localStorage fora da allowlist continua bloqueado em arquivo .ts', () => {
  withFixture(
    {
      'unsafe-cache.ts': 'localStorage.setItem("accessToken", token);',
    },
    (root) => {
      const matches = scanStorage(root, 'src', /localStorage/);
      assert.deepEqual(matches, [join('src', 'unsafe-cache.ts')]);
    },
  );
});

test('storageScanContent devolve o conteúdo integral para arquivos não .vue', () => {
  const content = 'localStorage.getItem("x");';
  assert.equal(storageScanContent('src/foo.ts', content), content);
});

test('storageScanContent ignora múltiplos blocos fora de <script> em um .vue', () => {
  const content = [
    '<template><p>sessionStorage no texto</p></template>',
    '<script setup lang="ts">const safe = true;</script>',
    '<style>/* sessionStorage em comentário de estilo */</style>',
  ].join('\n');
  const scanned = storageScanContent('src/Mixed.vue', content);
  assert.equal(scanned.includes('sessionStorage'), false);
  assert.equal(scanned.includes('safe'), true);
});
