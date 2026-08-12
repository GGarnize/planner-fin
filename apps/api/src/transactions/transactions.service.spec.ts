import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { TransactionsService } from './transactions.service';
const id = '11111111-1111-4111-8111-111111111111',
  userId = '22222222-2222-4222-8222-222222222222';
const row = (extra = {}) => ({
  id,
  userId,
  accountId: id,
  categoryId: id,
  type: 'EXPENSE' as const,
  status: 'PENDING' as const,
  description: 'Conta',
  notes: null,
  plannedAmount: new Prisma.Decimal('10'),
  actualAmount: null,
  dueDate: new Date('2026-08-07'),
  paidAt: null,
  recurrenceRuleId: null,
  occurrenceDate: null,
  deletedAt: null,
  createdAt: new Date('2026-08-07'),
  updatedAt: new Date('2026-08-07'),
  ...extra,
});
const config = { jwtSecret: 'x'.repeat(32) } as never;
describe('transições de lançamentos', () => {
  it('rejeita estados incoerentes antes da persistência', async () => {
    const s = new TransactionsService({} as never, config);
    await expect(
      s.create(userId, {
        accountId: id,
        categoryId: id,
        type: 'EXPENSE',
        status: 'PAID',
        description: 'x',
        plannedAmount: '1.00',
        dueDate: '2026-08-07',
      } as never),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    await expect(
      s.create(userId, {
        accountId: id,
        categoryId: id,
        type: 'EXPENSE',
        status: 'PENDING',
        description: 'x',
        plannedAmount: '1.00',
        dueDate: '2026-08-07',
        actualAmount: '1.00',
      } as never),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });
  it('pay idêntico é idempotente e divergente conflita', async () => {
    const paid = row({
      status: 'PAID',
      actualAmount: new Prisma.Decimal('10'),
      paidAt: new Date('2026-08-07'),
    });
    const tx = {
      financialTransaction: {
        findFirst: vi.fn().mockResolvedValue(paid),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = { $transaction: (fn: (x: unknown) => unknown) => fn(tx) };
    const s = new TransactionsService(prisma as never, config);
    expect((await s.pay(userId, id, { actualAmount: '10.00', paidAt: '2026-08-07' })).status).toBe(
      'PAID',
    );
    await expect(
      s.pay(userId, id, { actualAmount: '11.00', paidAt: '2026-08-07' }),
    ).rejects.toMatchObject({ response: { code: 'TRANSACTION_ALREADY_PAID' } });
    expect(tx.financialTransaction.updateMany).toHaveBeenCalled();
  });
  it('reopen pendente é idempotente sem update físico', async () => {
    const tx = {
      financialTransaction: {
        findFirst: vi.fn().mockResolvedValue(row()),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const s = new TransactionsService(
      { $transaction: (fn: (x: unknown) => unknown) => fn(tx) } as never,
      config,
    );
    const result = await s.reopen(userId, id);
    expect(result.status).toBe('PENDING');
    expect(tx.financialTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PAID', deletedAt: null }),
      }),
    );
  });
  it('remove ativo com soft delete e preserva tombstone em repeticao', async () => {
    const deletedAt = new Date('2026-08-12T12:00:00.000Z');
    const tx = {
      $queryRaw: vi.fn(),
      financialTransaction: {
        findFirst: vi.fn().mockResolvedValueOnce(row()).mockResolvedValueOnce(row({ deletedAt })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const s = new TransactionsService(
      { $transaction: (fn: (x: unknown) => unknown) => fn(tx) } as never,
      config,
    );
    await expect(s.remove(userId, id)).resolves.toBeUndefined();
    await expect(s.remove(userId, id)).resolves.toBeUndefined();
    expect(tx.financialTransaction.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.financialTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id, userId, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });
  it('consulta e mutacoes tratam tombstone como ausente', async () => {
    const tx = {
      $queryRaw: vi.fn(),
      financialTransaction: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn() },
    };
    const s = new TransactionsService(
      {
        financialTransaction: tx.financialTransaction,
        $transaction: (fn: (x: unknown) => unknown) => fn(tx),
      } as never,
      config,
    );
    await expect(s.get(userId, id)).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    await expect(
      s.pay(userId, id, { actualAmount: '10.00', paidAt: '2026-08-07' }),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });
  it('lista apenas lancamentos ativos', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const s = new TransactionsService({ financialTransaction: { findMany } } as never, config);
    await s.list(userId, {});
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });
  it('rejeita categoria incompatível e recurso arquivado', async () => {
    const account = { archivedAt: null },
      category = { archivedAt: null, type: 'INCOME' };
    const tx = {
      financialAccount: { findFirst: vi.fn().mockResolvedValue(account) },
      financialCategory: { findFirst: vi.fn().mockResolvedValue(category) },
    };
    const s = new TransactionsService({} as never, config);
    const relations = Reflect.get(s, 'relations') as (...args: unknown[]) => Promise<void>;
    await expect(relations.call(s, tx, userId, id, id, 'EXPENSE')).rejects.toMatchObject({
      response: { code: 'CATEGORY_TYPE_MISMATCH' },
    });
    category.archivedAt = new Date() as never;
    await expect(relations.call(s, tx, userId, id, id, 'INCOME')).rejects.toMatchObject({
      response: { code: 'RELATED_RESOURCE_ARCHIVED' },
    });
  });
});
