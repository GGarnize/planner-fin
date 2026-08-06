import { createHmac, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

export const normalizeEmail = (email: string): string => email.trim().toLocaleLowerCase();
export const passwordIsValid = (password: string): boolean =>
  password.length >= 10 &&
  password.length <= 128 &&
  /\p{L}/u.test(password) &&
  /\p{N}/u.test(password);

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    version: 0x13,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
    salt: randomBytes(16),
  });
}
export const verifyPassword = (hash: string, password: string): Promise<boolean> =>
  argon2.verify(hash, password);
export const randomToken = (): string => randomBytes(32).toString('base64url');
export const digestToken = (token: string, key: string): string =>
  createHmac('sha256', key).update(token).digest('hex');
