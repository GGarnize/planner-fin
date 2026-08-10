import { Prisma } from '@prisma/client';
import { civilDate, civilString } from '../debts/debt-finance';

export const zero = () => new Prisma.Decimal(0);
export const money = (value: Prisma.Decimal) => value.toFixed(2);

/** Soma dias civis sem depender do fuso do processo. */
export function addCivilDays(value: string, days: number): string {
  const date = civilDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return civilString(date);
}

export function cashPosition(values: Array<Prisma.Decimal | null>) {
  const unavailableAccountCount = values.filter((value) => value === null).length;
  const available = values.filter((value): value is Prisma.Decimal => value !== null);
  return {
    totalRealizedBalance: unavailableAccountCount
      ? null
      : money(available.reduce((sum, value) => sum.plus(value), zero())),
    availableAccountCount: available.length,
    unavailableAccountCount,
  };
}

export function compareCivil(a: Date, b: Date) {
  return civilString(a).localeCompare(civilString(b));
}
