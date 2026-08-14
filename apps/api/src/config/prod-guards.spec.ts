import { describe, expect, it } from 'vitest';
import { assertProductionSafety, type ProdGuardConfig } from './prod-guards';

function validConfig(): ProdGuardConfig {
  return {
    cookieSecure: true,
    corsOrigins: ['https://web.example.test', 'https://localhost'],
    databaseUrl: 'postgresql://user:pass@postgres.railway.internal:5432/railway',
  };
}

describe('assertProductionSafety', () => {
  it('aceita configuração segura de produção', () => {
    expect(() => assertProductionSafety(validConfig(), {})).not.toThrow();
  });

  it('rejeita COOKIE_SECURE=false', () => {
    expect(() =>
      assertProductionSafety({ ...validConfig(), cookieSecure: false }, {}),
    ).toThrow('COOKIE_SECURE');
  });

  it('rejeita origem CORS HTTP em produção', () => {
    expect(() =>
      assertProductionSafety(
        { ...validConfig(), corsOrigins: ['http://web.example.test'] },
        {},
      ),
    ).toThrow('HTTPS');
  });

  it.each(['localhost:8443', '127.0.0.1', '10.0.2.2', '192.168.0.10'])(
    'rejeita origem CORS local/LAN %s (exceto o literal exato https://localhost do Android)',
    (host) => {
      expect(() =>
        assertProductionSafety(
          { ...validConfig(), corsOrigins: [`https://${host}`] },
          {},
        ),
      ).toThrow('local/LAN');
    },
  );

  it('mantém a exceção documentada para https://localhost (Android WebView)', () => {
    expect(() =>
      assertProductionSafety({ ...validConfig(), corsOrigins: ['https://localhost'] }, {}),
    ).not.toThrow();
  });

  it('rejeita ALLOW_LOCAL_TEST_SEED=true em produção', () => {
    expect(() =>
      assertProductionSafety(validConfig(), { ALLOW_LOCAL_TEST_SEED: 'true' }),
    ).toThrow('ALLOW_LOCAL_TEST_SEED');
  });

  it.each(['localhost', '127.0.0.1'])(
    'rejeita DATABASE_URL apontando a host local (%s)',
    (host) => {
      expect(() =>
        assertProductionSafety(
          { ...validConfig(), databaseUrl: `postgresql://user:pass@${host}:5432/railway` },
          {},
        ),
      ).toThrow('DATABASE_URL');
    },
  );

  it.each(['planner_fin_local', 'planner_fin_test', 'planner_fin_spec022_e2e'])(
    'rejeita DATABASE_URL com nome de banco sintético/local (%s)',
    (name) => {
      expect(() =>
        assertProductionSafety(
          { ...validConfig(), databaseUrl: `postgresql://user:pass@db.railway.internal:5432/${name}` },
          {},
        ),
      ).toThrow('DATABASE_URL');
    },
  );
});
