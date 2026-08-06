import { HttpException, Injectable } from '@nestjs/common';

@Injectable()
export class RateLimitService {
  private readonly entries = new Map<string, number[]>();
  check(key: string, max: number, windowMs: number): void {
    const now = Date.now();
    const attempts = (this.entries.get(key) ?? []).filter((at) => at > now - windowMs);
    if (attempts.length >= max)
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Muitas tentativas. Tente novamente mais tarde.',
          retryAfter: Math.ceil((attempts[0] + windowMs - now) / 1000),
        },
        429,
      );
    attempts.push(now);
    this.entries.set(key, attempts);
  }
  clear(key: string): void {
    this.entries.delete(key);
  }
}
