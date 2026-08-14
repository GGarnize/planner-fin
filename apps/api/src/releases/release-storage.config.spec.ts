import { describe, expect, it } from 'vitest';
import { loadReleaseStorageConfig } from './release-storage.config';

const FULL_ENV = {
  BUCKET: 'planner-fin-releases',
  ENDPOINT: 'https://storage.railway.app',
  REGION: 'auto',
  ACCESS_KEY_ID: 'id',
  SECRET_ACCESS_KEY: 'secret',
};

describe('loadReleaseStorageConfig', () => {
  it('retorna null quando o bucket ainda não foi provisionado (nenhuma variável definida)', () => {
    expect(loadReleaseStorageConfig({})).toBeNull();
  });

  it('retorna a configuração completa quando todas as variáveis estão definidas', () => {
    expect(loadReleaseStorageConfig(FULL_ENV)).toStrictEqual({
      bucket: 'planner-fin-releases',
      endpoint: 'https://storage.railway.app',
      region: 'auto',
      accessKeyId: 'id',
      secretAccessKey: 'secret',
    });
  });

  it('falha fechado quando a configuração está parcialmente definida', () => {
    for (const missing of Object.keys(FULL_ENV)) {
      const partial = { ...FULL_ENV, [missing]: undefined };
      expect(() => loadReleaseStorageConfig(partial)).toThrow(missing);
    }
  });
});
