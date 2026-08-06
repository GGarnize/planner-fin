import { describe, expect, it } from 'vitest';
import {
  digestToken,
  hashPassword,
  normalizeEmail,
  passwordIsValid,
  randomToken,
  verifyPassword,
} from './auth.utils';
describe('primitivas de autenticação', () => {
  it('normaliza somente espaços externos e caixa Unicode', () =>
    expect(normalizeEmail(' Pessoa+tag@EXEMPLO.com ')).toBe('pessoa+tag@exemplo.com'));
  it('aplica a política de senha', () => {
    expect(passwordIsValid('segura12345')).toBe(true);
    expect(passwordIsValid('apenasletras')).toBe(false);
    expect(passwordIsValid('1234567890')).toBe(false);
  });
  it('produz e verifica Argon2id nos custos mínimos', async () => {
    const hash = await hashPassword('segura12345');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    await expect(verifyPassword(hash, 'segura12345')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'errada12345')).resolves.toBe(false);
  });
  it('gera refresh opaco e digest HMAC determinístico', () => {
    const token = randomToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(digestToken(token, 'k'.repeat(32))).toHaveLength(64);
    expect(digestToken(token, 'k'.repeat(32))).not.toBe(token);
  });
});
