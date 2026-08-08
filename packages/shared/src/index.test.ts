import { describe, expect, it } from 'vitest';
import { HEALTH_RESPONSE, type PublicFinancialAccount } from './index';

describe('contrato de saúde', () => {
  it('mantém o contrato técnico mínimo', () => {
    expect(HEALTH_RESPONSE).toStrictEqual({ status: 'ok', service: 'planner-fin-api' });
    expect(Object.keys(HEALTH_RESPONSE).sort()).toStrictEqual(['service', 'status']);
  });
});

describe('contrato público de conta financeira', () => {
  const account = (realizedBalance: PublicFinancialAccount['realizedBalance']) =>
    ({ realizedBalance }) as PublicFinancialAccount;

  it('aceita saldo realizado decimal ou indisponível', () => {
    expect(account('123.45').realizedBalance).toBe('123.45');
    expect(account(null).realizedBalance).toBeNull();
  });
});
