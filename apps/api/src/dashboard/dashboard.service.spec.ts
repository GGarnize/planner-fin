import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service';

const decimal = (value: string) => new Prisma.Decimal(value);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const transaction = (
  id: string,
  type: 'INCOME' | 'EXPENSE',
  status: 'PENDING' | 'PAID',
  planned: string,
  actual: string | null,
  dueDate: string,
  categoryId = 'category',
  categoryName = 'Categoria',
) => ({
  id,
  type,
  status,
  description: id,
  plannedAmount: decimal(planned),
  actualAmount: actual === null ? null : decimal(actual),
  dueDate: date(dueDate),
  categoryId,
  category: { name: categoryName },
});

function prismaFixture(rows: Record<string, unknown[]> = {}, budget: unknown = null) {
  const many = (name: string) => ({ findMany: vi.fn(async () => rows[name] ?? []) });
  const tx = {
    financialAccount: many('accounts'),
    financialTransaction: {
      findMany: vi
        .fn()
        .mockImplementationOnce(async () => rows.cashTransactions ?? [])
        .mockImplementationOnce(async () => rows.transactions ?? []),
    },
    financialTransfer: many('transfers'),
    cardInvoicePayment: many('invoicePayments'),
    debtFunding: many('fundings'),
    debtPayment: many('debtPayments'),
    cardInstallment: many('installments'),
    monthlyBudget: { findFirst: vi.fn(async () => budget) },
    cardInvoice: many('invoices'),
    debtInstallment: many('debts'),
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn(async (callback, options) => {
        expect(options).toEqual({ isolationLevel: 'RepeatableRead' });
        return callback(tx);
      }),
    },
  };
}

describe('DashboardService', () => {
  it('compõe resposta vazia em um RepeatableRead com quantidade fixa de onze queries', async () => {
    let queries = 0;
    const empty = () => ({
      findMany: vi.fn(async () => {
        queries += 1;
        return [];
      }),
    });
    const tx = {
      financialAccount: empty(),
      financialTransaction: empty(),
      financialTransfer: empty(),
      cardInvoicePayment: empty(),
      debtFunding: empty(),
      debtPayment: empty(),
      cardInstallment: empty(),
      monthlyBudget: {
        findFirst: vi.fn(async () => {
          queries += 1;
          return null;
        }),
      },
      cardInvoice: empty(),
      debtInstallment: empty(),
    };
    const transaction = vi.fn(async (callback, options) => {
      expect(options).toEqual({ isolationLevel: 'RepeatableRead' });
      return callback(tx);
    });
    const now = vi.fn(() => new Date('2026-08-10T12:00:00.000Z'));
    const service = new DashboardService({ $transaction: transaction } as never, now);
    const result = await service.get('user-id', '2026-08');
    expect(result).toMatchObject({
      cashPosition: {
        totalRealizedBalance: '0.00',
        availableAccountCount: 0,
        unavailableAccountCount: 0,
      },
      budget: null,
      counters: {
        overdueTransactions: 0,
        upcomingTransactions: 0,
        unpaidCardInvoices: 0,
        overdueDebtInstallments: 0,
      },
    });
    expect(result.monthlyFlow).toEqual({
      incomeRealized: '0.00',
      incomePlanned: '0.00',
      expenseRealized: '0.00',
      expenseCommitted: '0.00',
      realizedNet: '0.00',
      plannedNet: '0.00',
    });
    expect(queries).toBe(11);
    expect(now).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it('propaga falha essencial sem devolver resposta parcial', async () => {
    const failure = new Error('database unavailable');
    const service = new DashboardService({
      $transaction: vi.fn().mockRejectedValue(failure),
    } as never);
    await expect(service.get('user-id', '2026-08')).rejects.toBe(failure);
  });
  it('prova o cenário consolidado e a equivalência da projeção SPEC-010/SPEC-011', async () => {
    const fixture = prismaFixture(
      {
        transactions: [
          transaction('income-pending', 'INCOME', 'PENDING', '1000.00', null, '2026-08-10'),
          transaction('income-paid', 'INCOME', 'PAID', '2000.00', '1950.00', '2026-08-10'),
          transaction('expense-pending', 'EXPENSE', 'PENDING', '300.00', null, '2026-08-10'),
          transaction('expense-paid', 'EXPENSE', 'PAID', '500.00', '480.00', '2026-08-10'),
        ],
        installments: [
          {
            amount: decimal('200.00'),
            purchase: { categoryId: 'card', category: { name: 'Cartão' } },
          },
        ],
        debtPayments: [
          {
            accountId: 'account',
            paymentDate: date('2026-08-10'),
            principalAmount: decimal('400.00'),
            interestAmount: decimal('20.00'),
            feeAmount: decimal('5.00'),
          },
        ],
        transfers: [
          {
            sourceAccountId: 'a',
            destinationAccountId: 'b',
            actualAmount: decimal('999.00'),
            completedAt: date('2026-08-10'),
          },
        ],
        invoicePayments: [
          { accountId: 'a', amount: decimal('680.00'), paymentDate: date('2026-08-10') },
        ],
        fundings: [{ accountId: 'a', amount: decimal('1000.00'), fundingDate: date('2026-08-10') }],
      },
      { id: 'budget', totalLimit: decimal('1000.00') },
    );
    const result = await new DashboardService(
      fixture.prisma as never,
      () => new Date('2026-08-10T12:00:00.000Z'),
    ).get('user', '2026-08');
    expect(result.monthlyFlow).toEqual({
      incomeRealized: '1950.00',
      incomePlanned: '3000.00',
      expenseRealized: '705.00',
      expenseCommitted: '1025.00',
      realizedNet: '1245.00',
      plannedNet: '1975.00',
    });
    expect(result.budget).toMatchObject({
      realizedExpense: result.monthlyFlow.expenseRealized,
      committedExpense: result.monthlyFlow.expenseCommitted,
      remainingAgainstCommitted: '-25.00',
      committedPercent: '102.50',
      exceeded: true,
    });
    expect(result.expenseByCategory.uncategorizedDebtCostRealized).toBe('25.00');
  });
  it('não soma caixa parcial quando uma conta possui corte futuro', async () => {
    const fixture = prismaFixture({
      accounts: [
        { id: 'a', openingBalance: decimal('1000'), openingBalanceDate: date('2026-01-31') },
        { id: 'b', openingBalance: decimal('500'), openingBalanceDate: date('2026-01-31') },
        { id: 'future', openingBalance: decimal('1'), openingBalanceDate: date('2026-08-11') },
      ],
    });
    const result = await new DashboardService(
      fixture.prisma as never,
      () => new Date('2026-08-10T12:00:00.000Z'),
    ).get('user', '2026-08');
    expect(result.cashPosition).toEqual({
      totalRealizedBalance: null,
      availableAccountCount: 2,
      unavailableAccountCount: 1,
    });
  });
  it('aplica evento conjunto somente às contas cujo corte o antecede', async () => {
    const fixture = prismaFixture({
      accounts: [
        { id: 'a', openingBalance: decimal('1000'), openingBalanceDate: date('2026-01-31') },
        { id: 'b', openingBalance: decimal('500'), openingBalanceDate: date('2026-02-28') },
      ],
      transfers: [
        {
          sourceAccountId: 'a',
          destinationAccountId: 'b',
          actualAmount: decimal('100.00'),
          completedAt: date('2026-02-15'),
        },
      ],
    });
    const result = await new DashboardService(
      fixture.prisma as never,
      () => new Date('2026-03-01T12:00:00.000Z'),
    ).get('user', '2026-03');
    expect(result.cashPosition.totalRealizedBalance).toBe('1400.00');
    expect(fixture.tx.financialTransfer.findMany).toHaveBeenCalledTimes(1);
  });
  it('ordena, limita e conta listas sobre o conjunto elegível completo', async () => {
    const upcoming = Array.from({ length: 9 }, (_, index) =>
      transaction(
        `future-${String(index).padStart(2, '0')}`,
        'EXPENSE',
        'PENDING',
        '1.00',
        null,
        '2026-08-17',
      ),
    );
    const invoices = Array.from({ length: 6 }, (_, index) => ({
      id: `invoice-${index}`,
      cardId: 'card',
      referenceMonth: '2026-08',
      status: index === 0 ? 'OPEN' : 'CLOSED',
      dueDate: date(index === 1 ? '2026-08-09' : '2026-08-20'),
      card: { name: 'Cartão' },
      installments: [{ amount: decimal('10.10') }, { amount: decimal('0.20') }],
    }));
    const debts = Array.from({ length: 6 }, (_, index) => ({
      id: `debt-${index}`,
      debtId: 'debt',
      installmentNumber: index + 1,
      dueDate: date(index === 0 ? '2026-08-09' : index === 5 ? '2026-09-09' : '2026-08-10'),
      principalAmount: decimal('100.00'),
      interestAmount: decimal('2.00'),
      feeAmount: decimal('3.00'),
      debt: { creditorName: 'Credor' },
    }));
    const fixture = prismaFixture({
      transactions: [
        transaction('overdue-b', 'EXPENSE', 'PENDING', '1.00', null, '2026-08-09'),
        transaction('overdue-a', 'EXPENSE', 'PENDING', '1.00', null, '2026-08-09'),
        transaction('today', 'EXPENSE', 'PENDING', '1.00', null, '2026-08-10'),
        ...upcoming,
        transaction('plus-eight', 'EXPENSE', 'PENDING', '999.00', null, '2026-08-18'),
        transaction('paid', 'EXPENSE', 'PAID', '999.00', '999.00', '2026-08-10'),
      ],
      invoices,
      debts,
    });
    const result = await new DashboardService(
      fixture.prisma as never,
      () => new Date('2026-08-10T12:00:00.000Z'),
    ).get('user', '2026-08');
    expect(result.upcomingTransactions).toHaveLength(10);
    expect(result.upcomingTransactions.slice(0, 3).map((item) => item.id)).toEqual([
      'overdue-a',
      'overdue-b',
      'today',
    ]);
    expect(result.upcomingTransactions.map((item) => item.id)).not.toContain('plus-eight');
    expect(result.upcomingTransactions.map((item) => item.id)).not.toContain('paid');
    expect(result.counters).toMatchObject({
      overdueTransactions: 2,
      upcomingTransactions: 10,
      unpaidCardInvoices: 6,
      overdueDebtInstallments: 1,
    });
    expect(result.cardInvoices).toHaveLength(5);
    expect(result.cardInvoices[0]).toMatchObject({
      invoiceId: 'invoice-1',
      total: '10.30',
      projectedOverdue: true,
    });
    expect(result.cardInvoices.find((item) => item.status === 'OPEN')?.projectedOverdue).toBe(
      false,
    );
    expect(result.debtInstallments).toHaveLength(5);
    expect(result.debtInstallments[0]).toMatchObject({
      installmentId: 'debt-0',
      totalAmount: '105.00',
      projectedStatus: 'OVERDUE',
    });
  });
  it('mantém todas as categorias realizadas, ordena empates e não categoriza custo de dívida', async () => {
    const categories = Array.from({ length: 6 }, (_, index) =>
      transaction(
        `category-${index}`,
        'EXPENSE',
        index === 5 ? 'PENDING' : 'PAID',
        '10.00',
        index === 5 ? null : index === 0 ? '20.00' : '10.00',
        '2026-08-10',
        `c${index}`,
        index === 1 ? 'A' : index === 2 ? 'A' : `C${index}`,
      ),
    );
    const fixture = prismaFixture({
      transactions: categories,
      installments: [
        {
          amount: decimal('5.00'),
          purchase: { categoryId: 'c5', category: { name: 'C5' } },
        },
      ],
      debtPayments: [
        {
          accountId: 'a',
          paymentDate: date('2026-08-10'),
          principalAmount: decimal('900'),
          interestAmount: decimal('0'),
          feeAmount: decimal('0'),
        },
      ],
    });
    const result = await new DashboardService(
      fixture.prisma as never,
      () => new Date('2026-08-10T12:00:00.000Z'),
    ).get('user', '2026-08');
    expect(result.expenseByCategory.categories).toHaveLength(6);
    expect(result.expenseByCategory.categories.slice(0, 3).map((item) => item.categoryId)).toEqual([
      'c0',
      'c1',
      'c2',
    ]);
    expect(
      result.expenseByCategory.categories.find((item) => item.categoryId === 'c5')?.amount,
    ).toBe('5.00');
    expect(result.expenseByCategory.uncategorizedDebtCostRealized).toBe('0.00');
  });
});
