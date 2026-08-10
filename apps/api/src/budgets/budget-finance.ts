import { Prisma } from '@prisma/client';

export const MONTH_PATTERN = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

export function isCivilMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

export function monthDateBounds(month: string): { from: Date; to: Date } {
  if (!isCivilMonth(month)) throw new Error('Mês civil inválido.');
  const [year, value] = month.split('-').map((item) => parseInt(item, 10));
  return {
    from: new Date(Date.UTC(year!, value! - 1, 1)),
    to: new Date(Date.UTC(value === 12 ? year! + 1 : year!, value === 12 ? 0 : value!, 1)),
  };
}

export function adjacentMonth(month: string, offset: -1 | 1): string {
  if (!isCivilMonth(month)) throw new Error('Mês civil inválido.');
  const [year, value] = month.split('-').map((item) => parseInt(item, 10));
  const date = new Date(Date.UTC(year!, value! - 1 + offset, 1));
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const money = (value: Prisma.Decimal): string => value.toFixed(2);

export type MonthlyExpenseTransactionFact = {
  categoryId: string;
  categoryName: string;
  status: 'PENDING' | 'PAID';
  plannedAmount: Prisma.Decimal;
  actualAmount: Prisma.Decimal | null;
};

export type MonthlyExpenseInstallmentFact = {
  categoryId: string;
  categoryName: string;
  amount: Prisma.Decimal;
};

export type MonthlyDebtCostFact = {
  interestAmount: Prisma.Decimal;
  feeAmount: Prisma.Decimal;
};

export function projectMonthlyExpenses(input: {
  transactions: MonthlyExpenseTransactionFact[];
  installments: MonthlyExpenseInstallmentFact[];
  debtPayments: MonthlyDebtCostFact[];
}) {
  const zero = new Prisma.Decimal(0);
  const categoryValues = new Map<
    string,
    { categoryName: string; realized: Prisma.Decimal; committed: Prisma.Decimal }
  >();
  const add = (
    categoryId: string,
    categoryName: string,
    realized: Prisma.Decimal,
    committed: Prisma.Decimal,
  ) => {
    const current = categoryValues.get(categoryId) ?? {
      categoryName,
      realized: zero,
      committed: zero,
    };
    categoryValues.set(categoryId, {
      categoryName: current.categoryName || categoryName,
      realized: current.realized.add(realized),
      committed: current.committed.add(committed),
    });
  };
  input.transactions.forEach((item) =>
    add(
      item.categoryId,
      item.categoryName,
      item.status === 'PAID' ? (item.actualAmount ?? zero) : zero,
      item.plannedAmount,
    ),
  );
  input.installments.forEach((item) =>
    add(item.categoryId, item.categoryName, item.amount, item.amount),
  );
  const debtCost = input.debtPayments.reduce(
    (sum, item) => sum.add(item.interestAmount).add(item.feeAmount),
    zero,
  );
  let categorizedRealized = zero;
  let categorizedCommitted = zero;
  categoryValues.forEach((value) => {
    categorizedRealized = categorizedRealized.add(value.realized);
    categorizedCommitted = categorizedCommitted.add(value.committed);
  });
  return {
    categoryValues,
    categorizedRealized,
    categorizedCommitted,
    debtCost,
    realizedExpense: categorizedRealized.add(debtCost),
    committedExpense: categorizedCommitted.add(debtCost),
  };
}

export const percent = (spent: Prisma.Decimal, limit: Prisma.Decimal): string =>
  spent.mul(100).div(limit).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
export function totals(limit: Prisma.Decimal, realized: Prisma.Decimal, committed: Prisma.Decimal) {
  return {
    realizedExpense: money(realized),
    committedExpense: money(committed),
    remainingAgainstRealized: money(limit.sub(realized)),
    remainingAgainstCommitted: money(limit.sub(committed)),
    realizedPercent: percent(realized, limit),
    committedPercent: percent(committed, limit),
  };
}
