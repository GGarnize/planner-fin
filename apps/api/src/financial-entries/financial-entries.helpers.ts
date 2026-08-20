import { BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FinancialEntryListQuery, FinancialEntrySource } from '@planner-fin/shared';
import { isCivilDate } from '../transactions/dto';

export const civilDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
export const civilString = (value: Date) => value.toISOString().slice(0, 10);

type Cursor = {
  date: string;
  createdAt: string;
  source: FinancialEntrySource;
  id: string;
  fingerprint: string;
};
const encode = (value: string) => Buffer.from(value).toString('base64url');
export function entryQueryFingerprint(query: FinancialEntryListQuery, limit: number) {
  return JSON.stringify({ ...query, cursor: undefined, limit: String(limit) });
}
export function signEntryCursor(data: Cursor, secret: string) {
  const body = encode(JSON.stringify(data));
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function readEntryCursor(token: string, secret: string, fingerprint: string): Cursor {
  try {
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra) throw new Error();
    const expected = createHmac('sha256', secret).update(body).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const value = JSON.parse(Buffer.from(body, 'base64url').toString()) as Cursor;
    if (
      value.fingerprint !== fingerprint ||
      !isCivilDate(value.date) ||
      Number.isNaN(Date.parse(value.createdAt)) ||
      (value.source !== 'TRANSACTION' && value.source !== 'CARD_INSTALLMENT') ||
      !/^[0-9a-f-]{36}$/i.test(value.id)
    )
      throw new Error();
    return value;
  } catch {
    throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Reinicie a paginação.' });
  }
}
