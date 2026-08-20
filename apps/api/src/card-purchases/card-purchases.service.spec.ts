import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CardPurchasesService } from './card-purchases.service';

const row = {
  id: 'purchase',
  userId: 'owner',
  cardId: 'card',
  categoryId: 'category',
  description: 'Compra fictícia',
  notes: null,
  purchaseDate: new Date('2026-08-07T00:00:00.000Z'),
  totalAmount: new Prisma.Decimal('100.00'),
  installmentCount: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  installments: [{ invoice: { status: 'OPEN' } }],
};

function serviceWith(card: object, category: object) {
  const tx = {
    cardPurchase: { findFirst: vi.fn().mockResolvedValue(row) },
    financialCreditCard: { findFirst: vi.fn().mockResolvedValue(card) },
    financialCategory: { findFirst: vi.fn().mockResolvedValue(category) },
  };
  const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
  return new CardPurchasesService(prisma as never, { jwtSecret: 'secret' } as never);
}

function serviceForRemoval(purchase: object | null) {
  const tx = {
    cardPurchase: {
      findFirst: vi.fn().mockResolvedValue(purchase),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    cardInstallment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
  return { service: new CardPurchasesService(prisma as never, { jwtSecret: 'secret' } as never), tx };
}

describe('serviço de compras no cartão', () => {
  const activeCategory = { id: 'category', archivedAt: null, type: 'EXPENSE' };

  it('bloqueia alteração estrutural quando o mesmo cartão está arquivado', async () => {
    const service = serviceWith(
      { id: 'card', closingDay: 10, dueDay: 17, archivedAt: new Date() },
      activeCategory,
    );
    await expect(
      service.update('owner', 'purchase', { totalAmount: '90.00' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it.each([
    [{ id: 'category', archivedAt: new Date(), type: 'EXPENSE' }, 'RELATED_RESOURCE_ARCHIVED'],
    [{ id: 'category', archivedAt: null, type: 'INCOME' }, 'CATEGORY_TYPE_MISMATCH'],
  ])('rejeita categoria própria inválida com 422 e código público', async (category, code) => {
    const service = serviceWith(
      { id: 'card', closingDay: 10, dueDay: 17, archivedAt: null },
      category,
    );
    await expect(
      service.update('owner', 'purchase', { description: 'Outra' }),
    ).rejects.toMatchObject({ status: 422, response: expect.objectContaining({ code }) });
  });

  it('remove exclui parcelas e a compra quando todas as faturas estão abertas', async () => {
    const { service, tx } = serviceForRemoval({ ...row, installments: [{ invoice: { status: 'OPEN' } }] });
    await service.remove('owner', 'purchase');
    expect(tx.cardInstallment.deleteMany).toHaveBeenCalledWith({
      where: { purchaseId: 'purchase' },
    });
    expect(tx.cardPurchase.delete).toHaveBeenCalledWith({ where: { id: 'purchase' } });
  });

  it('remove rejeita com 404 quando a compra não existe', async () => {
    const { service } = serviceForRemoval(null);
    await expect(service.remove('owner', 'purchase')).rejects.toMatchObject({ status: 404 });
  });

  it('remove bloqueia com 409 quando alguma parcela está em fatura não aberta', async () => {
    const { service, tx } = serviceForRemoval({
      ...row,
      installments: [{ invoice: { status: 'CLOSED' } }],
    });
    await expect(service.remove('owner', 'purchase')).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'PURCHASE_IN_CLOSED_INVOICE' }),
    });
    expect(tx.cardPurchase.delete).not.toHaveBeenCalled();
  });
});
