import { describe, expect, it } from 'vitest';
import {
  HEALTH_RESPONSE,
  type BudgetTotals,
  type DashboardResponse,
  type PublicFinancialAccount,
  type PublicMonthlyBudget,
} from './index';

describe('contrato de saúde', () => {
  it('mantém o contrato técnico mínimo', () => {
    expect(HEALTH_RESPONSE).toStrictEqual({ status: 'ok', service: 'planner-fin-api' });
    expect(Object.keys(HEALTH_RESPONSE).sort()).toStrictEqual(['service', 'status']);
  });
});

describe('contrato público de orçamento mensal', () => {
  it('mantém totais aninhados e limite somente na categoria', () => {
    const totals: BudgetTotals = {
      realizedExpense: '10.00',
      committedExpense: '20.00',
      remainingAgainstRealized: '90.00',
      remainingAgainstCommitted: '80.00',
      realizedPercent: '10.00',
      committedPercent: '20.00',
      unbudgetedRealizedExpense: '0.00',
      unbudgetedCommittedExpense: '0.00',
      uncategorizedDebtCostRealized: '0.00',
      uncategorizedDebtCostCommitted: '0.00',
    };
    const budget: PublicMonthlyBudget = {
      id: 'budget-id',
      month: '2026-08',
      totalLimit: '100.00',
      notes: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      totals,
      categories: [
        {
          categoryId: 'category-id',
          categoryName: 'Moradia',
          categoryArchived: false,
          limitAmount: '50.00',
          realizedExpense: '10.00',
          committedExpense: '20.00',
          remainingAgainstRealized: '40.00',
          remainingAgainstCommitted: '30.00',
          realizedPercent: '20.00',
          committedPercent: '40.00',
        },
      ],
    };

    expect(budget.totals.realizedExpense).toBe('10.00');
    expect(budget.categories[0]!.limitAmount).toBe('50.00');
    expect(totals).not.toHaveProperty('limitAmount');
  });
});

describe('contrato público de conta financeira', () => {
  const account = (realizedBalance: PublicFinancialAccount['realizedBalance']) =>
    ({ realizedBalance }) as PublicFinancialAccount;

  it('aceita saldo realizado decimal ou indisponível', () => {
    expect(account('123.45').realizedBalance).toBe('123.45');
    expect(account(null).realizedBalance).toBeNull();
  });
});

describe('contrato público do dashboard', () => {
  it('tipa o shape completo, nulável e sem campos internos', () => {
    const dashboard: DashboardResponse = {
      month: '2026-08',
      generatedAt: '2026-08-10T12:00:00.000Z',
      cashPosition: {
        totalRealizedBalance: null,
        availableAccountCount: 2,
        unavailableAccountCount: 1,
      },
      monthlyFlow: {
        incomeRealized: '1950.00',
        incomePlanned: '3000.00',
        expenseRealized: '705.00',
        expenseCommitted: '1025.00',
        realizedNet: '1245.00',
        plannedNet: '1975.00',
      },
      budget: null,
      upcomingTransactions: [
        {
          id: 't',
          type: 'INCOME',
          description: 'Receita',
          plannedAmount: '1.00',
          dueDate: '2026-08-10',
          categoryName: null,
          overdue: false,
        },
      ],
      cardInvoices: [
        {
          invoiceId: 'i',
          cardId: 'c',
          cardName: 'Cartão',
          referenceMonth: '2026-08',
          status: 'CLOSED',
          total: '1.00',
          dueDate: '2026-08-10',
          projectedOverdue: false,
        },
      ],
      debtInstallments: [
        {
          debtId: 'd',
          installmentId: 'p',
          creditorName: 'Credor',
          installmentNumber: 1,
          dueDate: '2026-08-10',
          totalAmount: '1.00',
          projectedStatus: 'PENDING',
          principalAmount: '1.00',
          interestAmount: '0.00',
          feeAmount: '0.00',
        },
      ],
      expenseByCategory: {
        categories: [{ categoryId: 'x', categoryName: 'Casa', amount: '1.00' }],
        uncategorizedDebtCostRealized: '0.00',
      },
      counters: {
        overdueTransactions: 0,
        upcomingTransactions: 1,
        unpaidCardInvoices: 1,
        overdueDebtInstallments: 0,
        pendingNotificationReviews: 0,
      },
    };
    expect(dashboard.cashPosition.totalRealizedBalance).toBeNull();
    expect('userId' in dashboard).toBe(false);
  });
});
