import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedContext } from '../auth/auth.types';
import { TransactionTemplatesController } from './transaction-templates.controller';
import type { TransactionTemplatesService } from './transaction-templates.service';
import { describe, expect, it, vi } from 'vitest';

const auth: AuthenticatedContext = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
};
const request = (query: Record<string, unknown> = {}, body: Record<string, unknown> = {}) =>
  ({ query, body }) as never;

function controller() {
  const templates = {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({}),
    archive: vi.fn().mockResolvedValue({}),
    restore: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  } as unknown as TransactionTemplatesService;
  return { templates, controller: new TransactionTemplatesController(templates) };
}

describe('controller de modelos de lancamento', () => {
  it('aceita query de listagem declarada e normaliza busca', async () => {
    const setup = controller();
    await setup.controller.list(auth, {
      includeArchived: 'true',
      type: 'EXPENSE',
      q: '  aluguel  ',
    });
    expect(setup.templates.list).toHaveBeenCalledWith(userId(), true, 'EXPENSE', 'aluguel');
  });

  it.each([
    [{ unknown: 'x' }],
    [{ includeArchived: 'all' }],
    [{ includeArchived: ['true', 'false'] }],
    [{ type: 'TRANSFER' }],
    [{ q: '' }],
    [{ q: 'a'.repeat(81) }],
  ])('rejeita query invalida de listagem %o', async (query) => {
    expect(() => controller().controller.list(auth, query)).toThrow(BadRequestException);
  });

  it('rejeita query em PATCH', async () => {
    expect(() =>
      controller().controller.update(auth, userId(), { name: 'Novo' }, { includeArchived: 'true' }),
    ).toThrow(BadRequestException);
  });

  it.each(['get', 'archive', 'restore'] as const)(
    'rejeita body/query em %s por nao aceitar input',
    async (method) => {
      const setup = controller();
      expect(() => setup.controller[method](auth, userId(), request({ x: '1' }))).toThrow(
        BadRequestException,
      );
      expect(() => setup.controller[method](auth, userId(), request({}, { x: '1' }))).toThrow(
        BadRequestException,
      );
    },
  );
});

function userId() {
  return '11111111-1111-4111-8111-111111111111';
}
