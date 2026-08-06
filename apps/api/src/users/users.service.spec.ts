import { describe, expect, it } from 'vitest';
import { toPublicUser } from './users.service';
describe('projeção pública', () =>
  it('não expõe credenciais', () => {
    const user = toPublicUser({
      id: 'u',
      name: 'Nome',
      email: 'nome@example.test',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(user).toEqual({
      id: 'u',
      name: 'Nome',
      email: 'nome@example.test',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(user).not.toHaveProperty('passwordHash');
  }));
