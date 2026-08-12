import { BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma, type FinancialTransaction } from '@prisma/client';
import type { PublicFinancialTransaction, TransactionListQuery } from '@planner-fin/shared';
import { isCivilDate } from './dto';
export const civilDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
export const civilString = (value: Date) => value.toISOString().slice(0, 10);
export const normalizeNotes = (value?: string | null) => value?.trim() || null;
export const currentCivilDate = (now: () => Date = () => new Date()) =>
  now().toISOString().slice(0, 10);
export function publicTransaction(
  row: FinancialTransaction,
  today = currentCivilDate(),
): PublicFinancialTransaction {
  return {
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId,
    type: row.type,
    status: row.status,
    description: row.description,
    notes: row.notes,
    plannedAmount: row.plannedAmount.toFixed(2),
    actualAmount: row.actualAmount?.toFixed(2) ?? null,
    dueDate: civilString(row.dueDate),
    paidAt: row.paidAt ? civilString(row.paidAt) : null,
    isOverdue: row.status === 'PENDING' && civilString(row.dueDate) < today,
    isRecurringOccurrence: Boolean(row.recurrenceRuleId && row.occurrenceDate),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export function realizedBalance(
  opening: Prisma.Decimal,
  rows: Pick<FinancialTransaction, 'status' | 'type' | 'actualAmount'>[],
) {
  return rows.reduce(
    (total, row) =>
      row.status !== 'PAID' || !row.actualAmount
        ? total
        : row.type === 'INCOME'
          ? total.plus(row.actualAmount)
          : total.minus(row.actualAmount),
    opening,
  );
}
type Cursor = { dueDate: string; createdAt: string; id: string; fingerprint: string };
const encode = (value: string) => Buffer.from(value).toString('base64url');
export function queryFingerprint(query: TransactionListQuery, limit: number) {
  return JSON.stringify({ ...query, cursor: undefined, limit: String(limit) });
}
export function signCursor(data: Cursor, secret: string) {
  const body = encode(JSON.stringify(data));
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function readCursor(token: string, secret: string, fingerprint: string): Cursor {
  try {
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra) throw new Error();
    const expected = createHmac('sha256', secret).update(body).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const value = JSON.parse(Buffer.from(body, 'base64url').toString()) as Cursor;
    if (
      value.fingerprint !== fingerprint ||
      !isCivilDate(value.dueDate) ||
      Number.isNaN(Date.parse(value.createdAt)) ||
      !/^[0-9a-f-]{36}$/i.test(value.id)
    )
      throw new Error();
    return value;
  } catch {
    throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Reinicie a paginação.' });
  }
}
