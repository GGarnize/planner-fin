import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DashboardResponse } from '@planner-fin/shared';
import { monthDateBounds, projectMonthlyExpenses, totals } from '../budgets/budget-finance';
import { civilDate, civilString, currentCivilDate, installmentTotal } from '../debts/debt-finance';
import { PrismaService } from '../prisma/prisma.service';
import { addCivilDays, cashPosition, money, zero } from './dashboard-finance';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get(userId: string, month: string): Promise<DashboardResponse> {
    return this.prisma.$transaction(async (tx) => this.compose(tx, userId, month), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }

  private async compose(
    tx: Prisma.TransactionClient,
    userId: string,
    month: string,
  ): Promise<DashboardResponse> {
    const now = this.now();
    const generatedAt = now.toISOString();
    const today = currentCivilDate(() => now);
    const todayDate = civilDate(today);
    const next7 = civilDate(addCivilDays(today, 7));
    const next30 = civilDate(addCivilDays(today, 30));
    const { from, to } = monthDateBounds(month);
    const accounts = await tx.financialAccount.findMany({
      where: { userId, archivedAt: null },
      select: { id: true, openingBalance: true, openingBalanceDate: true },
    });
    const earliest = accounts.reduce(
      (value, account) => (account.openingBalanceDate < value ? account.openingBalanceDate : value),
      todayDate,
    );
    const [
      cashTransactions,
      transfers,
      invoicePayments,
      fundings,
      debtPayments,
      transactions,
      installments,
      budget,
      invoices,
      debts,
    ] = await Promise.all([
      tx.financialTransaction.findMany({
        where: { userId, status: 'PAID', paidAt: { gt: earliest, lte: todayDate } },
        select: { accountId: true, type: true, actualAmount: true, paidAt: true },
      }),
      tx.financialTransfer.findMany({
        where: { userId, status: 'COMPLETED', completedAt: { gt: earliest, lte: todayDate } },
        select: {
          sourceAccountId: true,
          destinationAccountId: true,
          actualAmount: true,
          completedAt: true,
        },
      }),
      tx.cardInvoicePayment.findMany({
        where: { userId, paymentDate: { gt: earliest, lte: todayDate } },
        select: { accountId: true, amount: true, paymentDate: true },
      }),
      tx.debtFunding.findMany({
        where: { userId, fundingDate: { gt: earliest, lte: todayDate } },
        select: { accountId: true, amount: true, fundingDate: true },
      }),
      tx.debtPayment.findMany({
        where: {
          userId,
          OR: [
            { paymentDate: { gt: earliest, lte: todayDate } },
            { paymentDate: { gte: from, lt: to } },
          ],
        },
        select: {
          accountId: true,
          paymentDate: true,
          principalAmount: true,
          interestAmount: true,
          feeAmount: true,
        },
      }),
      tx.financialTransaction.findMany({
        where: {
          userId,
          OR: [{ dueDate: { gte: from, lt: to } }, { status: 'PENDING', dueDate: { lte: next7 } }],
        },
        select: {
          id: true,
          type: true,
          status: true,
          description: true,
          plannedAmount: true,
          actualAmount: true,
          dueDate: true,
          categoryId: true,
          category: { select: { name: true } },
        },
      }),
      tx.cardInstallment.findMany({
        where: { referenceMonth: month, purchase: { userId } },
        select: {
          amount: true,
          purchase: { select: { categoryId: true, category: { select: { name: true } } } },
        },
      }),
      tx.monthlyBudget.findFirst({
        where: { userId, month },
        select: { id: true, totalLimit: true },
      }),
      tx.cardInvoice.findMany({
        where: { userId, status: { in: ['OPEN', 'CLOSED'] } },
        select: {
          id: true,
          cardId: true,
          referenceMonth: true,
          status: true,
          dueDate: true,
          card: { select: { name: true } },
          installments: { select: { amount: true } },
        },
      }),
      tx.debtInstallment.findMany({
        where: { status: 'PENDING', debt: { userId }, dueDate: { lte: next30 } },
        select: {
          id: true,
          debtId: true,
          installmentNumber: true,
          dueDate: true,
          principalAmount: true,
          interestAmount: true,
          feeAmount: true,
          debt: { select: { creditorName: true } },
        },
      }),
    ]);

    const balances = accounts.map((account) => {
      const opening = civilString(account.openingBalanceDate);
      if (opening > today) return null;
      let balance = account.openingBalance;
      const applies = (date: Date | null) =>
        Boolean(date && civilString(date) > opening && civilString(date) <= today);
      cashTransactions.forEach((item) => {
        if (item.accountId === account.id && applies(item.paidAt))
          balance =
            item.type === 'INCOME'
              ? balance.plus(item.actualAmount ?? 0)
              : balance.minus(item.actualAmount ?? 0);
      });
      transfers.forEach((item) => {
        if (!applies(item.completedAt)) return;
        if (item.sourceAccountId === account.id) balance = balance.minus(item.actualAmount ?? 0);
        if (item.destinationAccountId === account.id)
          balance = balance.plus(item.actualAmount ?? 0);
      });
      invoicePayments.forEach((item) => {
        if (item.accountId === account.id && applies(item.paymentDate))
          balance = balance.minus(item.amount);
      });
      fundings.forEach((item) => {
        if (item.accountId === account.id && applies(item.fundingDate))
          balance = balance.plus(item.amount);
      });
      debtPayments.forEach((item) => {
        if (item.accountId === account.id && applies(item.paymentDate))
          balance = balance.minus(installmentTotal(item));
      });
      return balance;
    });

    const monthly = transactions.filter((item) => item.dueDate >= from && item.dueDate < to);
    let incomeRealized = zero(),
      incomePlanned = zero();
    monthly.forEach((item) => {
      if (item.type === 'INCOME') {
        incomePlanned = incomePlanned.plus(item.plannedAmount);
        if (item.status === 'PAID') incomeRealized = incomeRealized.plus(item.actualAmount ?? 0);
      }
    });
    const monthlyDebt = debtPayments.filter(
      (item) => item.paymentDate >= from && item.paymentDate < to,
    );
    const expenseProjection = projectMonthlyExpenses({
      transactions: monthly
        .filter((item) => item.type === 'EXPENSE')
        .map((item) => ({
          categoryId: item.categoryId,
          categoryName: item.category.name,
          status: item.status as 'PENDING' | 'PAID',
          plannedAmount: item.plannedAmount,
          actualAmount: item.actualAmount,
        })),
      installments: installments.map((item) => ({
        categoryId: item.purchase.categoryId,
        categoryName: item.purchase.category.name,
        amount: item.amount,
      })),
      debtPayments: monthlyDebt.map((item) => ({
        interestAmount: item.interestAmount,
        feeAmount: item.feeAmount,
      })),
    });
    const expenseRealized = expenseProjection.realizedExpense;
    const expenseCommitted = expenseProjection.committedExpense;
    const budgetTotals = budget
      ? totals(budget.totalLimit, expenseRealized, expenseCommitted)
      : null;

    const eligibleTransactions = transactions
      .filter((item) => item.status === 'PENDING' && item.dueDate <= next7)
      .sort(
        (a, b) =>
          (a.dueDate < todayDate === b.dueDate < todayDate ? 0 : a.dueDate < todayDate ? -1 : 1) ||
          civilString(a.dueDate).localeCompare(civilString(b.dueDate)) ||
          a.id.localeCompare(b.id),
      );
    const sortedInvoices = invoices.sort(
      (a, b) =>
        civilString(a.dueDate).localeCompare(civilString(b.dueDate)) || a.id.localeCompare(b.id),
    );
    const sortedDebts = debts.sort(
      (a, b) =>
        (a.dueDate < todayDate === b.dueDate < todayDate ? 0 : a.dueDate < todayDate ? -1 : 1) ||
        civilString(a.dueDate).localeCompare(civilString(b.dueDate)) ||
        a.installmentNumber - b.installmentNumber ||
        a.id.localeCompare(b.id),
    );

    return {
      month,
      generatedAt,
      cashPosition: cashPosition(balances),
      monthlyFlow: {
        incomeRealized: money(incomeRealized),
        incomePlanned: money(incomePlanned),
        expenseRealized: money(expenseRealized),
        expenseCommitted: money(expenseCommitted),
        realizedNet: money(incomeRealized.minus(expenseRealized)),
        plannedNet: money(incomePlanned.minus(expenseCommitted)),
      },
      budget:
        budget && budgetTotals
          ? {
              id: budget.id,
              totalLimit: money(budget.totalLimit),
              ...budgetTotals,
              exceeded: budget.totalLimit.minus(expenseCommitted).isNegative(),
            }
          : null,
      upcomingTransactions: eligibleTransactions.slice(0, 10).map((item) => ({
        id: item.id,
        type: item.type,
        description: item.description,
        plannedAmount: money(item.plannedAmount),
        dueDate: civilString(item.dueDate),
        categoryName: item.category.name,
        overdue: item.dueDate < todayDate,
      })),
      cardInvoices: sortedInvoices.slice(0, 5).map((item) => ({
        invoiceId: item.id,
        cardId: item.cardId,
        cardName: item.card.name,
        referenceMonth: item.referenceMonth,
        status: item.status as 'OPEN' | 'CLOSED',
        total: money(item.installments.reduce((sum, line) => sum.plus(line.amount), zero())),
        dueDate: civilString(item.dueDate),
        projectedOverdue: item.status === 'CLOSED' && item.dueDate < todayDate,
      })),
      debtInstallments: sortedDebts.slice(0, 5).map((item) => ({
        debtId: item.debtId,
        installmentId: item.id,
        creditorName: item.debt.creditorName,
        installmentNumber: item.installmentNumber,
        dueDate: civilString(item.dueDate),
        totalAmount: money(installmentTotal(item)),
        projectedStatus: item.dueDate < todayDate ? 'OVERDUE' : 'PENDING',
        principalAmount: money(item.principalAmount),
        interestAmount: money(item.interestAmount),
        feeAmount: money(item.feeAmount),
      })),
      expenseByCategory: {
        categories: [...expenseProjection.categoryValues.entries()]
          .filter(([, value]) => value.realized.greaterThan(0))
          .map(([categoryId, value]) => ({
            categoryId,
            categoryName: value.categoryName,
            amount: money(value.realized),
          }))
          .sort(
            (a, b) =>
              new Prisma.Decimal(b.amount).comparedTo(a.amount) ||
              a.categoryName.localeCompare(b.categoryName) ||
              a.categoryId.localeCompare(b.categoryId),
          ),
        uncategorizedDebtCostRealized: money(expenseProjection.debtCost),
      },
      counters: {
        overdueTransactions: eligibleTransactions.filter((item) => item.dueDate < todayDate).length,
        upcomingTransactions: eligibleTransactions.filter((item) => item.dueDate >= todayDate)
          .length,
        unpaidCardInvoices: invoices.length,
        overdueDebtInstallments: debts.filter((item) => item.dueDate < todayDate).length,
      },
    };
  }
}
