import { describe, expect, it } from 'vitest';
import { isCorsOriginAllowed } from './cors';

describe('isCorsOriginAllowed', () => {
  const allowlist = ['http://localhost:9000', 'https://localhost'];

  it('aceita origem aprovada', () => {
    expect(isCorsOriginAllowed('https://localhost', allowlist)).toBe(true);
  });

  it('rejeita origem fora da allowlist sem wildcard', () => {
    expect(isCorsOriginAllowed('https://evil.example', allowlist)).toBe(false);
  });

  it('aceita requisição sem Origin para clientes diretos e health checks', () => {
    expect(isCorsOriginAllowed(undefined, allowlist)).toBe(true);
  });
});
