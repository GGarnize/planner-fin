import { describe, expect, it } from 'vitest';
import { HEALTH_RESPONSE } from './index';

describe('contrato de saúde', () => {
  it('mantém o contrato técnico mínimo', () => {
    expect(HEALTH_RESPONSE).toStrictEqual({ status: 'ok', service: 'planner-fin-api' });
    expect(Object.keys(HEALTH_RESPONSE).sort()).toStrictEqual(['service', 'status']);
  });
});
