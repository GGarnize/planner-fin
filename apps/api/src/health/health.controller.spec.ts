import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('responde exatamente o contrato de saúde', async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    const controller = moduleRef.get(HealthController);
    expect(controller.getHealth()).toStrictEqual({ status: 'ok', service: 'planner-fin-api' });
    expect(Object.keys(controller.getHealth()).sort()).toStrictEqual(['service', 'status']);
  });
});
