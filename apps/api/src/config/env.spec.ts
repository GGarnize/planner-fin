import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './env';

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe('loadApiConfig', () => {
  it('aceita configuração local válida', () => {
    process.env.API_PORT = '3000';
    process.env.DATABASE_URL = 'postgresql://local:local@localhost:5432/local';
    process.env.API_CORS_ORIGIN = 'http://localhost:9000';
    process.env.JWT_SECRET = 'jwt-local-sintetico-ABCDEF-1234567890-xyz';
    process.env.REFRESH_HMAC_SECRET = 'hmac-local-sintetico-9876543210-ZYX-fed';
    process.env.COOKIE_SECURE = 'false';
    expect(loadApiConfig()).toMatchObject({
      port: 3000,
      host: undefined,
      databaseUrl: process.env.DATABASE_URL,
      corsOrigins: ['http://localhost:9000'],
      accessTokenSeconds: 900,
      refreshTokenSeconds: 2592000,
      cookieSecure: false,
    });
  });
  it('falha de forma controlada com DATABASE_URL ausente', () => {
    delete process.env.DATABASE_URL;
    expect(() => loadApiConfig()).toThrow('DATABASE_URL é obrigatória');
  });
  it('falha de forma controlada com porta inválida', () => {
    process.env.API_PORT = 'invalida';
    process.env.DATABASE_URL = 'postgresql://local:local@localhost:5432/local';
    process.env.JWT_SECRET = 'jwt-local-sintetico-ABCDEF-1234567890-xyz';
    process.env.REFRESH_HMAC_SECRET = 'hmac-local-sintetico-9876543210-ZYX-fed';
    expect(() => loadApiConfig()).toThrow('API_PORT');
  });
  it('aceita host explicito para tooling local', () => {
    process.env.API_PORT = '3000';
    process.env.API_HOST = '127.0.0.1';
    process.env.DATABASE_URL = 'postgresql://local:local@localhost:5432/local';
    process.env.API_CORS_ORIGIN = 'https://localhost';
    process.env.JWT_SECRET = 'jwt-local-sintetico-ABCDEF-1234567890-xyz';
    process.env.REFRESH_HMAC_SECRET = 'hmac-local-sintetico-9876543210-ZYX-fed';
    expect(loadApiConfig().host).toBe('127.0.0.1');
  });
  it('rejeita segredos ausentes, fracos e placeholders sem expô-los', () => {
    process.env.DATABASE_URL = 'postgresql://local:local@localhost:5432/local';
    delete process.env.JWT_SECRET;
    expect(() => loadApiConfig()).toThrow('JWT_SECRET é obrigatória');
    process.env.JWT_SECRET = 'fraco';
    expect(() => loadApiConfig()).toThrow('JWT_SECRET deve conter');
    process.env.JWT_SECRET = 'jwt-local-sintetico-ABCDEF-1234567890-xyz';
    process.env.REFRESH_HMAC_SECRET = 'placeholder'.padEnd(32, 'x');
    expect(() => loadApiConfig()).toThrow('REFRESH_HMAC_SECRET deve conter');
  });
});

describe('PORT/host em produção', () => {
  const validProd = () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@postgres.railway.internal:5432/railway';
    process.env.API_CORS_ORIGINS = 'https://web.example.test';
    process.env.JWT_SECRET = 'jwt-prod-sintetico-ABCDEF-1234567890-xyz';
    process.env.REFRESH_HMAC_SECRET = 'hmac-prod-sintetico-9876543210-ZYX-fed';
  };

  it('exige PORT em produção e ignora API_PORT', () => {
    validProd();
    process.env.API_PORT = '9999';
    process.env.PORT = '8080';
    expect(loadApiConfig().port).toBe(8080);
  });

  it('falha se PORT ausente em produção', () => {
    validProd();
    delete process.env.PORT;
    expect(() => loadApiConfig()).toThrow('PORT');
  });

  it('faz bind em 0.0.0.0 por padrão em produção', () => {
    validProd();
    process.env.PORT = '8080';
    delete process.env.API_HOST;
    expect(loadApiConfig().host).toBe('0.0.0.0');
  });

  it('preserva API_HOST explícito em produção quando definido', () => {
    validProd();
    process.env.PORT = '8080';
    process.env.API_HOST = '10.0.0.5';
    expect(loadApiConfig().host).toBe('10.0.0.5');
  });

  it('fora de produção continua usando API_PORT (default 3000) e ignora PORT', () => {
    process.env.DATABASE_URL = 'postgresql://local:local@localhost:5432/local';
    process.env.JWT_SECRET = 'jwt-local-sintetico-ABCDEF-1234567890-xyz';
    process.env.REFRESH_HMAC_SECRET = 'hmac-local-sintetico-9876543210-ZYX-fed';
    process.env.PORT = '9999';
    delete process.env.API_PORT;
    expect(loadApiConfig().port).toBe(3000);
  });

  it('bloqueia start com configuração insegura em produção (guard PRD)', () => {
    validProd();
    process.env.PORT = '8080';
    process.env.COOKIE_SECURE = 'false';
    expect(() => loadApiConfig()).toThrow('COOKIE_SECURE');
  });
});

describe('crossSiteOrigins', () => {
  it('usa https://localhost como padrão (compatível com o comportamento atual do Android)', () => {
    process.env.DATABASE_URL = 'postgresql://local:local@localhost:5432/local';
    process.env.JWT_SECRET = 'jwt-local-sintetico-ABCDEF-1234567890-xyz';
    process.env.REFRESH_HMAC_SECRET = 'hmac-local-sintetico-9876543210-ZYX-fed';
    delete process.env.API_CROSS_SITE_ORIGINS;
    expect(loadApiConfig().crossSiteOrigins).toEqual(['https://localhost']);
  });

  it('aceita lista customizada separada por vírgula', () => {
    process.env.DATABASE_URL = 'postgresql://local:local@localhost:5432/local';
    process.env.JWT_SECRET = 'jwt-local-sintetico-ABCDEF-1234567890-xyz';
    process.env.REFRESH_HMAC_SECRET = 'hmac-local-sintetico-9876543210-ZYX-fed';
    process.env.API_CROSS_SITE_ORIGINS = ' https://localhost , https://web.example.test ';
    expect(loadApiConfig().crossSiteOrigins).toEqual(['https://localhost', 'https://web.example.test']);
  });
});

describe('allowlist CORS', () => {
  const valid = () => {
    process.env.DATABASE_URL = 'postgresql://local:local@localhost:5432/local';
    process.env.JWT_SECRET = 'jwt-local-sintetico-ABCDEF-1234567890-xyz';
    process.env.REFRESH_HMAC_SECRET = 'hmac-local-sintetico-9876543210-ZYX-fed';
  };
  it('aceita, normaliza espaços e remove duplicatas', () => {
    valid();
    process.env.API_CORS_ORIGINS =
      ' http://localhost:9000 , https://localhost,http://localhost:9000 ';
    expect(loadApiConfig().corsOrigins).toEqual(['http://localhost:9000', 'https://localhost']);
  });
  it.each(['*', '', 'https://example.test/path', 'https://*.example.test', 'invalida'])(
    'rejeita configuração inválida %j',
    (origins) => {
      valid();
      process.env.API_CORS_ORIGINS = origins;
      if (!origins) process.env.API_CORS_ORIGIN = '';
      expect(() => loadApiConfig()).toThrow('API_CORS_ORIGINS');
    },
  );
});
