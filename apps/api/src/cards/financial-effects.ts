import { Prisma } from '@prisma/client';
export function expenseTotal(
  transactionExpenses: string[],
  installments: string[],
  payments: string[] = [],
) {
  void payments;
  return [...transactionExpenses, ...installments]
    .reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0))
    .toFixed(2);
}
export function accountBalance(
  opening: string,
  incomes: string[],
  expenses: string[],
  outgoing: string[],
  incoming: string[],
  invoicePayments: string[],
) {
  let total = new Prisma.Decimal(opening);
  for (const value of incomes) total = total.plus(value);
  for (const value of [...expenses, ...outgoing, ...invoicePayments]) total = total.minus(value);
  for (const value of incoming) total = total.plus(value);
  return total.toFixed(2);
}
