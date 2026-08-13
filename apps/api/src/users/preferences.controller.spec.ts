import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { UsersController } from './users.controller';

describe('UsersController preferences', () => {
  it('aplica no-store no GET e PATCH de preferencias', async () => {
    const users = { getPublic: vi.fn() };
    const preferences = {
      get: vi.fn().mockResolvedValue({
        appearance: 'SYSTEM',
        accent: 'BLUE',
        updatedAt: '2026-08-12T10:00:00.000Z',
      }),
      patch: vi.fn().mockResolvedValue({
        appearance: 'DARK',
        accent: 'BLUE',
        updatedAt: '2026-08-12T10:01:00.000Z',
      }),
    };
    const controller = new UsersController(users as never, preferences as never);
    const response = { setHeader: vi.fn() } as unknown as Response;

    await controller.preferencesMe({ userId: 'user-1', sessionId: 's' }, response);
    await controller.updatePreferences(
      { userId: 'user-1', sessionId: 's' },
      { appearance: 'DARK' },
      response,
    );

    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(preferences.get).toHaveBeenCalledWith('user-1');
    expect(preferences.patch).toHaveBeenCalledWith('user-1', { appearance: 'DARK' });
  });
});
