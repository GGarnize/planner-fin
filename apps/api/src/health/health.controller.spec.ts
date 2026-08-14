import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

function buildModule(prismaStub: Partial<PrismaService>) {
  return Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: PrismaService, useValue: prismaStub }],
  }).compile();
}

describe('HealthController', () => {
  it('responde exatamente o contrato de saúde (liveness)', async () => {
    const moduleRef = await buildModule({});
    const controller = moduleRef.get(HealthController);
    expect(controller.getHealth()).toStrictEqual({ status: 'ok', service: 'planner-fin-api' });
    expect(Object.keys(controller.getHealth()).sort()).toStrictEqual(['service', 'status']);
  });

  it('readiness responde 200 quando o banco responde', async () => {
    const moduleRef = await buildModule({ $queryRaw: vi.fn(async () => [{ '?column?': 1 }]) } as never);
    const controller = moduleRef.get(HealthController);
    await expect(controller.getReadiness()).resolves.toStrictEqual({
      status: 'ok',
      service: 'planner-fin-api',
    });
  });

  it('readiness falha (não-2xx) quando o banco está indisponível, sem vazar detalhe sensível', async () => {
    const moduleRef = await buildModule({
      $queryRaw: vi.fn(async () => {
        throw new Error('connect ECONNREFUSED postgresql://user:pass@db.internal:5432/prod');
      }),
    } as never);
    const controller = moduleRef.get(HealthController);
    await expect(controller.getReadiness()).rejects.toMatchObject({
      response: { code: 'DB_UNAVAILABLE', message: 'Serviço indisponível.' },
    });
    try {
      await controller.getReadiness();
    } catch (error) {
      const serialized = JSON.stringify((error as { response?: unknown }).response);
      expect(serialized).not.toMatch(/postgres|ECONNREFUSED|db\.internal/i);
    }
  });

  it('readiness falha quando o banco excede o timeout', async () => {
    const moduleRef = await buildModule({
      $queryRaw: vi.fn(() => new Promise(() => {})),
    } as never);
    const controller = moduleRef.get(HealthController);
    await expect(controller.getReadiness()).rejects.toMatchObject({
      response: { code: 'DB_UNAVAILABLE' },
    });
  }, 5000);
});
