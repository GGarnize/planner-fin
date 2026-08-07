import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CardInvoicesService } from './card-invoices.service';

const invoice = (status: 'OPEN' | 'CLOSED' | 'PAID' = 'CLOSED') => ({
  id: 'invoice',
  userId: 'owner',
  cardId: 'card',
  referenceMonth: '2026-08',
  closingDate: new Date('2026-08-10T00:00:00.000Z'),
  dueDate: new Date('2026-08-17T00:00:00.000Z'),
  status,
  closedAt: status === 'OPEN' ? null : new Date('2026-08-11T00:00:00.000Z'),
  paidAt: status === 'PAID' ? new Date('2026-08-12T00:00:00.000Z') : null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  installments: [
    {
      id: 'installment',
      purchaseId: 'purchase',
      installmentNumber: 1,
      installmentCount: 1,
      amount: new Prisma.Decimal('120.00'),
      referenceMonth: '2026-08',
      invoiceId: 'invoice',
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      purchase: { description: 'Compra fictícia' },
    },
  ],
  payment: null,
});

function setup(row = invoice()) {
  const tx = {
    cardInvoice: {
      findFirst: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    cardInvoicePayment: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    financialAccount: { findFirst: vi.fn().mockResolvedValue({ id: 'account', archivedAt: null }) },
    cardInstallment: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal('120.00') } }),
    },
  };
  const prisma = { ...tx, $transaction: vi.fn((callback) => callback(tx)) };
  return {
    tx,
    service: new CardInvoicesService(prisma as never, { jwtSecret: 'secret' } as never),
  };
}

describe('serviço de faturas', () => {
  it('close repetido preserva estado e não reabre PAID', async () => {
    const closed = setup(invoice('CLOSED'));
    await closed.service.close('owner', 'invoice');
    expect(closed.tx.cardInvoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'OPEN' }) }),
    );
    const paid = setup(invoice('PAID'));
    expect((await paid.service.close('owner', 'invoice')).status).toBe('PAID');
  });

  it('pay igual é no-op e pay divergente retorna 409', async () => {
    const same = setup(invoice('PAID'));
    same.tx.cardInvoicePayment.findUnique.mockResolvedValue({
      accountId: 'account',
      paymentDate: new Date('2026-08-12T00:00:00.000Z'),
    });
    await same.service.pay('owner', 'invoice', { accountId: 'account', paymentDate: '2026-08-12' });
    expect(same.tx.cardInvoicePayment.create).not.toHaveBeenCalled();
    await expect(
      same.service.pay('owner', 'invoice', { accountId: 'other', paymentDate: '2026-08-12' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('não paga OPEN e trata conta própria arquivada como 422', async () => {
    await expect(
      setup(invoice('OPEN')).service.pay('owner', 'invoice', {
        accountId: 'account',
        paymentDate: '2026-08-12',
      }),
    ).rejects.toMatchObject({ status: 409 });
    const archived = setup();
    archived.tx.financialAccount.findFirst.mockResolvedValue({
      id: 'account',
      archivedAt: new Date(),
    });
    await expect(
      archived.service.pay('owner', 'invoice', { accountId: 'account', paymentDate: '2026-08-12' }),
    ).rejects.toMatchObject({ status: 422 });
    expect(archived.tx.cardInvoicePayment.create).not.toHaveBeenCalled();
  });
});
