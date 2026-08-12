import 'reflect-metadata';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateTransactionDto, isCivilDate, isMoney } from './dto';
import { publicTransaction, realizedBalance, readCursor, signCursor } from './transactions.helpers';
const valid = {
  accountId: '11111111-1111-4111-8111-111111111111',
  categoryId: '22222222-2222-4222-8222-222222222222',
  type: 'EXPENSE',
  status: 'PENDING',
  description: ' Mercado ',
  plannedAmount: '10.00',
  dueDate: '2026-08-07',
};
const row = (extra = {}) => ({
  id: valid.accountId,
  userId: valid.categoryId,
  accountId: valid.accountId,
  categoryId: valid.categoryId,
  type: 'EXPENSE' as const,
  status: 'PENDING' as const,
  description: 'Mercado',
  notes: null,
  plannedAmount: new Prisma.Decimal('10'),
  actualAmount: null,
  dueDate: new Date('2026-08-06T00:00:00Z'),
  paidAt: null,
  recurrenceRuleId: null,
  occurrenceDate: null,
  deletedAt: null,
  createdAt: new Date('2026-08-07T01:00:00Z'),
  updatedAt: new Date('2026-08-07T01:00:00Z'),
  ...extra,
});
describe('regras de lançamentos', () => {
  it.each(['0.01', '1.0', '99999999999999999.99'])('aceita decimal estrito %s', (v) =>
    expect(isMoney(v)).toBe(true),
  );
  it.each([
    1,
    '0.00',
    '-1.00',
    '+1.00',
    '1',
    '01.00',
    '1.001',
    '1e2',
    '1,00',
    '100000000000000000.00',
  ])('rejeita decimal inválido %s', (v) => expect(isMoney(v)).toBe(false));
  it('valida coerência, descrição e notas', async () => {
    expect(await validate(plainToInstance(CreateTransactionDto, valid))).toHaveLength(0);
    for (const change of [
      { plannedAmount: 1 },
      { description: 'linha\nnova' },
      { description: '😀'.repeat(201) },
      { notes: 'x'.repeat(2001) },
    ])
      expect(
        (await validate(plainToInstance(CreateTransactionDto, { ...valid, ...change }))).length,
      ).toBeGreaterThan(0);
  });
  it('valida datas gregorianas', () => {
    expect(isCivilDate('2028-02-29')).toBe(true);
    expect(isCivilDate('2027-02-29')).toBe(false);
    expect(isCivilDate('2026-08-07T00:00:00Z')).toBe(false);
  });
  it('projeta valores/data e vencido sem userId', () => {
    const result = publicTransaction(row() as never, '2026-08-07');
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('deletedAt');
    expect(result.plannedAmount).toBe('10.00');
    expect(result.dueDate).toBe('2026-08-06');
    expect(result.isOverdue).toBe(true);
    expect(
      publicTransaction(
        row({
          status: 'PAID',
          actualAmount: new Prisma.Decimal('9'),
          paidAt: new Date('2026-08-07'),
        }) as never,
        '2026-08-07',
      ).isOverdue,
    ).toBe(false);
    expect(
      publicTransaction(
        row({
          recurrenceRuleId: '33333333-3333-4333-8333-333333333333',
          occurrenceDate: new Date('2026-08-06T00:00:00Z'),
        }) as never,
      ).isRecurringOccurrence,
    ).toBe(true);
  });
  it('calcula saldo somente pelo realizado e pela natureza', () => {
    const rows = [
      row({ status: 'PAID', type: 'INCOME', actualAmount: new Prisma.Decimal('25.10') }),
      row({ status: 'PAID', type: 'EXPENSE', actualAmount: new Prisma.Decimal('5.05') }),
      row({ plannedAmount: new Prisma.Decimal('900') }),
    ];
    expect(realizedBalance(new Prisma.Decimal('100'), rows as never).toFixed(2)).toBe('120.05');
  });
  it('assina cursor e rejeita adulteração/filtro diferente', () => {
    const data = {
      dueDate: '2026-08-07',
      createdAt: '2026-08-07T00:00:00.000Z',
      id: valid.accountId,
      fingerprint: 'f',
    };
    const token = signCursor(data, 'segredo');
    expect(readCursor(token, 'segredo', 'f')).toEqual(data);
    expect(() => readCursor(token + 'x', 'segredo', 'f')).toThrow();
    expect(() => readCursor(token, 'segredo', 'outro')).toThrow();
  });
});
