import { BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
export const fingerprint = (q: object, limit: number) =>
  JSON.stringify({ ...q, cursor: undefined, limit: String(limit) });
export const signDebtCursor = (
  p: { createdAt: string; id: string; fingerprint: string },
  secret: string,
) => {
  const b = Buffer.from(JSON.stringify(p)).toString('base64url');
  return `${b}.${createHmac('sha256', secret).update(b).digest('base64url')}`;
};
export const readDebtCursor = (token: string, secret: string, fp: string) => {
  try {
    const [b, s, x] = token.split('.');
    if (!b || !s || x) throw 0;
    const a = Buffer.from(s, 'base64url'),
      e = createHmac('sha256', secret).update(b).digest();
    if (a.length !== e.length || !timingSafeEqual(a, e)) throw 0;
    const p = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (typeof p.createdAt !== 'string' || typeof p.id !== 'string' || p.fingerprint !== fp)
      throw 0;
    return p as { createdAt: string; id: string; fingerprint: string };
  } catch {
    throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Reinicie a paginação.' });
  }
};
