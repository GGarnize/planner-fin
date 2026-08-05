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
    expect(loadApiConfig()).toStrictEqual({
      port: 3000,
      databaseUrl: process.env.DATABASE_URL,
      corsOrigin: 'http://localhost:9000',
    });
  });
  it('falha de forma controlada com DATABASE_URL ausente', () => {
    delete process.env.DATABASE_URL;
    expect(() => loadApiConfig()).toThrow('DATABASE_URL é obrigatória');
  });
  it('falha de forma controlada com porta inválida', () => {
    process.env.API_PORT = 'invalida';
    process.env.DATABASE_URL = 'postgresql://local:local@localhost:5432/local';
    expect(() => loadApiConfig()).toThrow('API_PORT');
  });
});
