import { Prisma } from '@prisma/client';
import { isCivilDate } from '../accounts/dto';

export const civilDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
export const civilString = (value: Date) => value.toISOString().slice(0, 10);
const pad = (value: number) => String(value).padStart(2, '0');
export function adjustedDate(year: number, month: number, day: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(day, last))}`;
}
export function addMonths(referenceMonth: string, amount: number): string {
  const [year, month] = referenceMonth.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}
export function invoiceDates(referenceMonth: string, closingDay: number, dueDay: number) {
  const [year, month] = referenceMonth.split('-').map(Number);
  const closingDate = adjustedDate(year!, month!, closingDay);
  const sameMonthDue = adjustedDate(year!, month!, dueDay);
  const next = addMonths(referenceMonth, 1).split('-').map(Number);
  const dueDate =
    sameMonthDue > closingDate ? sameMonthDue : adjustedDate(next[0]!, next[1]!, dueDay);
  return { closingDate, dueDate };
}
export function initialCycle(purchaseDate: string, closingDay: number): string {
  if (!isCivilDate(purchaseDate)) throw new Error('INVALID_DATE');
  const reference = purchaseDate.slice(0, 7);
  const [year, month] = reference.split('-').map(Number);
  return purchaseDate <= adjustedDate(year!, month!, closingDay)
    ? reference
    : addMonths(reference, 1);
}
export function splitInstallments(total: string, count: number): string[] {
  const decimal = new Prisma.Decimal(total);
  const cents = BigInt(decimal.mul(100).toFixed(0));
  if (count < 1 || count > 36 || cents < BigInt(count)) throw new Error('INVALID_INSTALLMENTS');
  const base = cents / BigInt(count),
    remainder = Number(cents % BigInt(count));
  return Array.from({ length: count }, (_, index) => {
    const value = base + (index < remainder ? 1n : 0n);
    return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
  });
}
export const normalizeOptional = (value?: string | null) => value?.trim() || null;
