import { describe, expect, it } from 'vitest';
import {
  accountBalance,
  accountBalanceWithDebts,
  debtFinancialCost,
  expenseTotal,
} from './financial-effects';
describe('efeitos financeiros do cartão', () => {
  it('reconhece parcela uma vez e ignora pagamento na despesa', () => {
    expect(expenseTotal(['30.00'], ['100.00'], ['100.00'])).toBe('130.00');
  });
  it('inclui funding e pagamento uma vez no saldo, mas só juros e tarifa no custo', () => {
    expect(
      accountBalanceWithDebts(
        '100.00',
        ['1000.00'],
        [{ principalAmount: '100.00', interestAmount: '10.00', feeAmount: '2.00' }],
      ),
    ).toBe('988.00');
    expect(debtFinancialCost([{ interestAmount: '10.00', feeAmount: '2.00' }])).toBe('12.00');
  });
  it('reduz saldo somente no pagamento', () => {
    expect(accountBalance('500.00', [], [], [], [], [])).toBe('500.00');
    expect(accountBalance('500.00', [], [], [], [], ['120.00'])).toBe('380.00');
  });
  it('preserva fórmula completa da conta', () =>
    expect(accountBalance('100.00', ['50.00'], ['10.00'], ['20.00'], ['5.00'], ['25.00'])).toBe(
      '100.00',
    ));
});
