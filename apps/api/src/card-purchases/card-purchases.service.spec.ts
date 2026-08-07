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
});
