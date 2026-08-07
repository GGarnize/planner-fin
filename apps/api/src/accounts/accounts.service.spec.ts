import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it, vi } from 'vitest';
import { CreateAccountDto, isCivilDate } from './dto';
import { AccountsService, publicAccount } from './accounts.service';
import { Prisma } from '@prisma/client';

const valid = {
  name: ' Conta ',
  type: 'CHECKING',
  institution: ' Banco ',
  currency: 'BRL',
  openingBalance: '123.45',
  openingBalanceDate: '2026-08-07',
};
const row = (extra = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  name: 'Conta',
  type: 'CHECKING' as const,
  institution: null,
  currency: 'BRL',
  openingBalance: new Prisma.Decimal('10.10'),
  openingBalanceDate: new Date('2026-08-07T00:00:00Z'),
  archivedAt: null,
  createdAt: new Date('2026-08-07T01:00:00Z'),
  updatedAt: new Date('2026-08-07T01:00:00Z'),
  ...extra,
});

describe('validação de contas', () => {
  it('aceita, apara e valida os campos aprovados', async () => {
    const dto = plainToInstance(CreateAccountDto, valid);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.name).toBe('Conta');
    expect(dto.institution).toBe('Banco');
  });
  it.each([
    { name: ' ' },
    { type: 'INVESTMENT' },
    { currency: 'USD' },
    { openingBalance: 1 },
    { openingBalance: '01.00' },
    { openingBalance: '1e2' },
    { openingBalance: '1.001' },
    { openingBalance: '100000000000000000.00' },
  ])('rejeita entrada inválida %o', async (change) =>
    expect(
      (await validate(plainToInstance(CreateAccountDto, { ...valid, ...change }))).length,
    ).toBeGreaterThan(0),
  );
  it.each(['123.45', '0', '-0', '-123.45', '99999999999999999.99', '-99999999999999999.99'])(
    'aceita saldo %s',
    async (openingBalance) =>
      expect(
        await validate(plainToInstance(CreateAccountDto, { ...valid, openingBalance })),
      ).toHaveLength(0),
  );
  it('valida datas gregorianas reais', () => {
    expect(isCivilDate('2024-02-29')).toBe(true);
    expect(isCivilDate('2023-02-29')).toBe(false);
    expect(isCivilDate('2026-13-01')).toBe(false);
  });
  it('projeta sem userId e normaliza decimal/data', () => {
    const result = publicAccount(row());
    expect(result.openingBalance).toBe('10.10');
    expect(result.openingBalanceDate).toBe('2026-08-07');
    expect(result).not.toHaveProperty('userId');
  });
});

describe('ciclo de vida', () => {
  it('impede edição de conta arquivada', async () => {
    const prisma = {
      financialAccount: { findFirst: vi.fn().mockResolvedValue(row({ archivedAt: new Date() })) },
    };
    await expect(
      new AccountsService(prisma as never).update(row().userId, row().id, { name: 'Nova' }),
    ).rejects.toMatchObject({ response: { code: 'ACCOUNT_ARCHIVED' } });
  });
  it('mantém archive e restore repetidos sem update', async () => {
    const update = vi.fn();
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(row({ archivedAt: new Date('2026-08-07T02:00:00Z') }))
      .mockResolvedValueOnce(row());
    const service = new AccountsService({ financialAccount: { findFirst, update } } as never);
    await service.archive(row().userId, row().id);
    await service.restore(row().userId, row().id);
    expect(update).not.toHaveBeenCalled();
  });
});
