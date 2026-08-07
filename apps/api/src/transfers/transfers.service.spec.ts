import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { TransfersService } from './transfers.service';
const id = '11111111-1111-4111-8111-111111111111',
  userId = '22222222-2222-4222-8222-222222222222',
  destination = '33333333-3333-4333-8333-333333333333';
const row = (extra = {}) => ({
  id,
  userId,
  sourceAccountId: id,
  destinationAccountId: destination,
  status: 'PENDING' as const,
  description: 'Reserva',
  notes: null,
  plannedAmount: new Prisma.Decimal('10'),
  actualAmount: null,
  dueDate: new Date('2026-08-07'),
  completedAt: null,
  createdAt: new Date('2026-08-07'),
  updatedAt: new Date('2026-08-07'),
  ...extra,
});
const config = { jwtSecret: 'x'.repeat(32) } as never;
describe('serviço de transferências', () => {
  it('rejeita estados incoerentes', async () => {
    const s = new TransfersService({} as never, config);
    await expect(
      s.create(userId, {
        sourceAccountId: id,
        destinationAccountId: destination,
        status: 'COMPLETED',
        description: 'x',
        plannedAmount: '1.00',
        dueDate: '2026-08-07',
      } as never),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });
  it('complete idêntico é idempotente e divergente conflita', async () => {
    const completed = row({
      status: 'COMPLETED',
      actualAmount: new Prisma.Decimal('10'),
      completedAt: new Date('2026-08-07'),
    });
    const tx = {
      financialTransfer: {
        findFirst: vi.fn().mockResolvedValue(completed),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const s = new TransfersService(
      { $transaction: (fn: (x: unknown) => unknown) => fn(tx) } as never,
      config,
    );
    expect(
      (await s.complete(userId, id, { actualAmount: '10.00', completedAt: '2026-08-07' })).status,
    ).toBe('COMPLETED');
    await expect(
      s.complete(userId, id, { actualAmount: '11.00', completedAt: '2026-08-07' }),
    ).rejects.toMatchObject({ response: { code: 'TRANSFER_ALREADY_COMPLETED' } });
  });
  it('reopen pendente é no-op e limpa concluída de modo condicional', async () => {
    const tx = {
      financialTransfer: {
        findFirst: vi.fn().mockResolvedValue(row()),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const s = new TransfersService(
      { $transaction: (fn: (x: unknown) => unknown) => fn(tx) } as never,
      config,
    );
    expect((await s.reopen(userId, id)).status).toBe('PENDING');
    expect(tx.financialTransfer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'COMPLETED' }) }),
    );
  });
  it('rejeita mesma conta, conta alheia e conta arquivada', async () => {
    const s = new TransfersService({} as never, config);
    const relations = Reflect.get(s, 'relations') as (...args: unknown[]) => Promise<void>;
    const tx = { financialAccount: { findFirst: vi.fn().mockResolvedValue({ archivedAt: null }) } };
    await expect(relations.call(s, tx, userId, id, id)).rejects.toMatchObject({
      response: { code: 'VALIDATION_ERROR' },
    });
    tx.financialAccount.findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ archivedAt: null });
    await expect(relations.call(s, tx, userId, id, destination)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
    tx.financialAccount.findFirst = vi
      .fn()
      .mockResolvedValueOnce({ archivedAt: new Date() })
      .mockResolvedValueOnce({ archivedAt: null });
    await expect(relations.call(s, tx, userId, id, destination)).rejects.toMatchObject({
      response: { code: 'RELATED_ACCOUNT_ARCHIVED' },
    });
  });
});
