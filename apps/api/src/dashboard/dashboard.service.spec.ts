import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service';

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
    const service = new DashboardService(
      { $transaction: transaction } as never,
      () => new Date('2026-08-10T12:00:00.000Z'),
    );
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
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it('propaga falha essencial sem devolver resposta parcial', async () => {
    const failure = new Error('database unavailable');
    const service = new DashboardService({
      $transaction: vi.fn().mockRejectedValue(failure),
    } as never);
    await expect(service.get('user-id', '2026-08')).rejects.toBe(failure);
  });
});
