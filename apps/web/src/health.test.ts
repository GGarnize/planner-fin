import { describe, expect, it } from 'vitest';
import { fetchHealth, isHealthResponse } from './health';

describe('health web', () => {
  it('valida o contrato exato da API', () => {
    expect(isHealthResponse({ status: 'ok', service: 'planner-fin-api' })).toBe(true);
    expect(isHealthResponse({ status: 'ok', service: 'planner-fin-api', extra: true })).toBe(false);
  });
  it('retorna disponível quando a API responde o contrato esperado', async () => {
    const fetcher = async () =>
      new Response(JSON.stringify({ status: 'ok', service: 'planner-fin-api' }));
    await expect(fetchHealth('http://localhost:3000/api', fetcher as typeof fetch)).resolves.toBe(
      'available',
    );
  });
  it('retorna indisponível quando a API falha', async () => {
    const fetcher = async () => {
      throw new Error('indisponível');
    };
    await expect(fetchHealth('http://localhost:3000/api', fetcher as typeof fetch)).resolves.toBe(
      'unavailable',
    );
  });
});
