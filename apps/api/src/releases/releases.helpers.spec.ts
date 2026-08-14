import { describe, expect, it } from 'vitest';
import {
  isValidLatestPointerShape,
  isValidMetadataShape,
  isValidVersion,
  metadataKeyFor,
  releaseKeyFor,
} from './releases.helpers';

describe('isValidVersion', () => {
  it('aceita SemVer 0.x.y e rejeita qualquer outro formato, incluindo path traversal', () => {
    expect(isValidVersion('0.1.0')).toBe(true);
    for (const invalid of ['v0.1.0', '0.1', '0.1.0-beta', '../../etc/passwd', '0.1.0/x', '']) {
      expect(isValidVersion(invalid)).toBe(false);
    }
  });
});

describe('isValidMetadataShape', () => {
  const base = {
    version: '0.1.0',
    versionCode: 1,
    sha256: 'a'.repeat(64),
    size: 4,
    createdAt: '2026-08-14T00:00:00.000Z',
    gitCommit: 'abc123',
    applicationId: 'com.plannerfin.app',
    minSdk: 24,
    targetSdk: 36,
    apiBaseUrl: 'https://api.example.test/api',
  };

  it('aceita metadata completa e coerente com a versão esperada', () => {
    expect(isValidMetadataShape(base, '0.1.0')).toBe(true);
  });

  it('rejeita metadata com versão divergente ou campos ausentes/malformados', () => {
    expect(isValidMetadataShape(base, '0.1.1')).toBe(false);
    expect(isValidMetadataShape({ ...base, sha256: 'not-hex' }, '0.1.0')).toBe(false);
    expect(isValidMetadataShape({ ...base, versionCode: 1.5 }, '0.1.0')).toBe(false);
    expect(isValidMetadataShape(null, '0.1.0')).toBe(false);
    expect(isValidMetadataShape('nao-e-objeto', '0.1.0')).toBe(false);
    const withoutSize: Record<string, unknown> = { ...base };
    delete withoutSize.size;
    expect(isValidMetadataShape(withoutSize, '0.1.0')).toBe(false);
  });
});

describe('isValidLatestPointerShape', () => {
  const base = {
    version: '0.1.0',
    versionCode: 1,
    key: releaseKeyFor('0.1.0'),
    sha256: 'a'.repeat(64),
    size: 4,
    applicationId: 'com.plannerfin.app',
    createdAt: '2026-08-14T00:00:00.000Z',
  };

  it('aceita ponteiro coerente com a chave canônica da versão', () => {
    expect(isValidLatestPointerShape(base)).toBe(true);
  });

  it('rejeita ponteiro cuja key não corresponde à versão (evita redirecionar para objeto arbitrário)', () => {
    expect(isValidLatestPointerShape({ ...base, key: 'android/releases/0.9.9/outra.apk' })).toBe(false);
    expect(isValidLatestPointerShape({ ...base, version: 'v0.1.0' })).toBe(false);
    expect(isValidLatestPointerShape(undefined)).toBe(false);
  });
});

describe('releaseKeyFor / metadataKeyFor', () => {
  it('constrói caminhos determinísticos por versão', () => {
    expect(releaseKeyFor('0.1.0')).toBe('android/releases/0.1.0/planner-fin-0.1.0.apk');
    expect(metadataKeyFor('0.1.0')).toBe('android/releases/0.1.0/metadata.json');
  });
});
