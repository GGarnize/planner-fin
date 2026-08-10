import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DashboardController } from './dashboard.controller';
describe('DashboardController', () => {
  const get = vi.fn();
  const controller = new DashboardController({ get } as never);
  const auth = { userId: 'u' } as never;
  it('aceita somente uma ocorrência canônica de month', () => {
    controller.get(auth, { month: '2026-08' });
    expect(get).toHaveBeenCalledWith('u', '2026-08');
    for (const query of [
      {},
      { month: '2026-13' },
      { month: ['2026-08'] },
      { month: '2026-08', extra: 'x' },
    ])
      expect(() => controller.get(auth, query)).toThrow(BadRequestException);
  });
});
