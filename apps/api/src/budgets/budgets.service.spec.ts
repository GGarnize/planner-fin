import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BudgetsService, normalizeBudgetNotes } from './budgets.service';

const decimal = (value: string) => new Prisma.Decimal(value);
const category = (id: string, name: string) => ({
  id,
  userId: 'user',
  name,
  normalizedName: name.toLowerCase(),
  type: 'EXPENSE' as const,
  color: null,
  icon: null,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});
describe('projeção do orçamento', () => {
  it.each([
    ['omitida', undefined, undefined],
    ['nula', null, null],
    ['vazia', '', null],
    ['somente espaços', '   ', null],
    ['texto', '  planejamento  ', 'planejamento'],
  ])('normaliza nota %s', (_case, input, expected) => {
    expect(normalizeBudgetNotes(input)).toBe(expected);
  });

  it('consolida apenas as fontes aprovadas, separa sem limite e dívida, sem N+1', async () => {
    const mercado = '00000000-0000-4000-8000-000000000001';
    const lazer = '00000000-0000-4000-8000-000000000002';
    const outra = '00000000-0000-4000-8000-000000000003';
    const tx = {
      monthlyBudget: {
        findFirst: vi.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000010',
          userId: 'user',
          month: '2026-08',
          totalLimit: decimal('1000.00'),
          notes: null,
          createdAt: new Date('2026-08-01'),
          updatedAt: new Date('2026-08-01'),
          categories: [
            {
              categoryId: mercado,
              limitAmount: decimal('400.00'),
              category: category(mercado, 'Mercado'),
            },
            {
              categoryId: lazer,
              limitAmount: decimal('200.00'),
              category: category(lazer, 'Lazer'),
            },
          ],
        }),
      },
      financialTransaction: {
        groupBy: vi.fn().mockResolvedValue([
          {
            categoryId: mercado,
            status: 'PENDING',
            _sum: { plannedAmount: decimal('100.00'), actualAmount: null },
          },
          {
            categoryId: mercado,
            status: 'PAID',
            _sum: { plannedAmount: decimal('80.00'), actualAmount: decimal('75.00') },
          },
          {
            categoryId: outra,
            status: 'PAID',
            _sum: { plannedAmount: decimal('50.00'), actualAmount: decimal('55.00') },
          },
        ]),
      },
      cardInstallment: {
        findMany: vi.fn().mockResolvedValue([
          { amount: decimal('120.00'), purchase: { categoryId: lazer } },
          { amount: decimal('30.00'), purchase: { categoryId: outra } },
        ]),
      },
      debtPayment: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { interestAmount: decimal('10.00'), feeAmount: decimal('2.00') },
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
    };
    const result = await new BudgetsService(prisma as never).getByMonth('user', '2026-08');
    expect(result.totals).toEqual({
      realizedExpense: '292.00',
      committedExpense: '392.00',
      unbudgetedRealizedExpense: '85.00',
      unbudgetedCommittedExpense: '80.00',
      uncategorizedDebtCostRealized: '12.00',
      uncategorizedDebtCostCommitted: '12.00',
      remainingAgainstRealized: '708.00',
      remainingAgainstCommitted: '608.00',
      realizedPercent: '29.20',
      committedPercent: '39.20',
    });
    expect(result).not.toHaveProperty('realizedExpense');
    expect(result).not.toHaveProperty('unbudgetedRealizedExpense');
    expect(result.categories).toEqual([
      expect.objectContaining({
        categoryName: 'Lazer',
        limitAmount: '200.00',
        realizedExpense: '120.00',
        committedExpense: '120.00',
      }),
      expect.objectContaining({
        categoryName: 'Mercado',
        realizedExpense: '75.00',
        committedExpense: '180.00',
      }),
    ]);
    expect(tx.financialTransaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'EXPENSE', dueDate: expect.anything() }),
      }),
    );
    expect(tx.cardInstallment.findMany).toHaveBeenCalledTimes(1);
    expect(tx.debtPayment.aggregate).toHaveBeenCalledTimes(1);
    expect(Object.keys(tx)).not.toContain('financialTransfer');
    expect(Object.keys(tx)).not.toContain('cardInvoicePayment');
    expect(Object.keys(tx)).not.toContain('debtFunding');
  });
});
