import { describe, expect, it, vi } from 'vitest';
import { UserPreferencesService, toPublicPreferences } from './preferences.service';

const row = (overrides: Partial<{ appearance: 'SYSTEM' | 'LIGHT' | 'DARK'; accent: 'BLUE' | 'TEAL' | 'PURPLE' | 'ORANGE'; updatedAt: Date }> = {}) => ({
  userId: 'user-1',
  appearance: overrides.appearance ?? ('SYSTEM' as const),
  accent: overrides.accent ?? ('BLUE' as const),
  createdAt: new Date('2026-08-12T10:00:00.000Z'),
  updatedAt: overrides.updatedAt ?? new Date('2026-08-12T10:00:00.000Z'),
});

describe('UserPreferencesService', () => {
  it('projeta somente contrato canonico', () => {
    expect(toPublicPreferences(row({ appearance: 'DARK', accent: 'PURPLE' }))).toEqual({
      appearance: 'DARK',
      accent: 'PURPLE',
      updatedAt: '2026-08-12T10:00:00.000Z',
    });
  });

  it('materializa defaults para usuario legado', async () => {
    const created = row();
    const prisma = {
      userPreferences: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
    };
    const service = new UserPreferencesService(prisma as never);

    await expect(service.get('user-1')).resolves.toEqual({
      appearance: 'SYSTEM',
      accent: 'BLUE',
      updatedAt: '2026-08-12T10:00:00.000Z',
    });
    expect(prisma.userPreferences.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', appearance: 'SYSTEM', accent: 'BLUE' },
    });
  });

  it('PATCH parcial preserva campos omitidos e retorna updatedAt do servidor', async () => {
    const current = row({ appearance: 'LIGHT', accent: 'BLUE' });
    const updated = row({
      appearance: 'LIGHT',
      accent: 'ORANGE',
      updatedAt: new Date('2026-08-12T10:01:00.000Z'),
    });
    const tx = {
      userPreferences: {
        findUnique: vi.fn().mockResolvedValue(current),
        update: vi.fn().mockResolvedValue(updated),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const service = new UserPreferencesService(prisma as never);

    await expect(service.patch('user-1', { accent: 'ORANGE' })).resolves.toEqual({
      appearance: 'LIGHT',
      accent: 'ORANGE',
      updatedAt: '2026-08-12T10:01:00.000Z',
    });
    expect(tx.userPreferences.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { appearance: 'LIGHT', accent: 'ORANGE' },
    });
  });

  it('PATCH idempotente nao avanca updatedAt', async () => {
    const current = row({ appearance: 'DARK', accent: 'TEAL' });
    const tx = {
      userPreferences: {
        findUnique: vi.fn().mockResolvedValue(current),
        update: vi.fn(),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const service = new UserPreferencesService(prisma as never);

    await expect(service.patch('user-1', { appearance: 'DARK' })).resolves.toEqual({
      appearance: 'DARK',
      accent: 'TEAL',
      updatedAt: '2026-08-12T10:00:00.000Z',
    });
    expect(tx.userPreferences.update).not.toHaveBeenCalled();
  });

  it('duas atualizacoes consecutivas seguem last-write-wins', async () => {
    const values = [
      row({ appearance: 'SYSTEM', accent: 'BLUE' }),
      row({
        appearance: 'LIGHT',
        accent: 'BLUE',
        updatedAt: new Date('2026-08-12T10:01:00.000Z'),
      }),
      row({
        appearance: 'DARK',
        accent: 'BLUE',
        updatedAt: new Date('2026-08-12T10:02:00.000Z'),
      }),
    ];
    const tx = {
      userPreferences: {
        findUnique: vi.fn().mockImplementation(() => Promise.resolve(values.shift())),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve(row({ ...data, updatedAt: new Date(`2026-08-12T10:0${data.appearance === 'LIGHT' ? 1 : 2}:00.000Z`) })),
        ),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const service = new UserPreferencesService(prisma as never);

    await service.patch('user-1', { appearance: 'LIGHT' });
    await expect(service.patch('user-1', { appearance: 'DARK' })).resolves.toEqual({
      appearance: 'DARK',
      accent: 'BLUE',
      updatedAt: '2026-08-12T10:02:00.000Z',
    });
  });

  it('rejeita PATCH vazio', async () => {
    const service = new UserPreferencesService({} as never);
    await expect(service.patch('user-1', {})).rejects.toMatchObject({
      response: expect.objectContaining({
        details: [{ field: 'body', message: 'Informe ao menos uma preferencia.' }],
      }),
    });
  });
});
