import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertBuildExists } from './check-build.mjs';

test('lança erro claro quando dist/main.js não existe', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'planner-fin-check-build-'));
  const missing = path.join(dir, 'dist', 'main.js');
  try {
    assert.throws(() => assertBuildExists(missing), /Build de produção ausente/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('não lança quando dist/main.js existe', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'planner-fin-check-build-'));
  const file = path.join(dir, 'main.js');
  writeFileSync(file, '// build fake para teste\n');
  try {
    assert.doesNotThrow(() => assertBuildExists(file));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
