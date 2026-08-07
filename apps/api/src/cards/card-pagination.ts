import { BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

type CursorPayload = {
  key: string;
  id: string;
  fingerprint: string;
};

export function paginationFingerprint(query: object, limit: number): string {
  return JSON.stringify({ ...query, cursor: undefined, limit: String(limit) });
}

export function createCardCursor(payload: CursorPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

export function readCardCursor(token: string, secret: string, fingerprint: string): CursorPayload {
  try {
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra) throw new Error();
    const actual = Buffer.from(signature, 'base64url');
    const expected = createHmac('sha256', secret).update(body).digest();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const value = JSON.parse(Buffer.from(body, 'base64url').toString()) as CursorPayload;
    if (
      typeof value.key !== 'string' ||
      typeof value.id !== 'string' ||
      value.fingerprint !== fingerprint
    )
      throw new Error();
    return value;
  } catch {
    throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Reinicie a paginação.' });
  }
}
