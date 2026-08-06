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
      databaseUrl: process.env.DATABASE_URL,
      corsOrigin: 'http://localhost:9000',
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
