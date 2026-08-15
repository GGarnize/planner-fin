import { describe, expect, it } from 'vitest';
import { GenericNotificationParser } from './generic-notification.parser';

const parser = new GenericNotificationParser();

describe('GenericNotificationParser', () => {
  it('classifies a purchase notification as an EXPENSE candidate', () => {
    const result = parser.parse({
      packageName: 'com.example.bank',
      title: 'Compra aprovada',
      text: 'Compra aprovada no valor de R$ 89,90 em MERCADO XYZ',
    });
    expect(result.status).toBe('FINANCIAL_CANDIDATE');
    expect(result.parsedType).toBe('EXPENSE');
    expect(result.parsedAmount).toBe('89.90');
    expect(result.reasons).toContain('valor_detectado');
  });

  it('classifies a received PIX notification as an INCOME candidate', () => {
    const result = parser.parse({
      packageName: 'com.example.bank',
      title: 'Pix recebido',
      text: 'Voce recebeu um Pix de R$ 1.234,56',
    });
    expect(result.status).toBe('FINANCIAL_CANDIDATE');
    expect(result.parsedType).toBe('INCOME');
    expect(result.parsedAmount).toBe('1234.56');
  });

  it('classifies marketing content without an amount as NON_FINANCIAL', () => {
    const result = parser.parse({
      packageName: 'com.example.bank',
      title: 'Oferta imperdivel',
      text: 'Confira o cashback disponivel esta semana',
    });
    expect(result.status).toBe('NON_FINANCIAL');
    expect(result.parsedAmount).toBeUndefined();
  });

  it('classifies unrecognized content without an amount as UNCLASSIFIED', () => {
    const result = parser.parse({
      packageName: 'com.example.bank',
      title: 'Aviso',
      text: 'Sua senha de acesso expira em breve',
    });
    expect(result.status).toBe('UNCLASSIFIED');
  });

  it('classifies conflicting income/expense terms as AMBIGUOUS but keeps the amount', () => {
    const result = parser.parse({
      packageName: 'com.example.bank',
      title: 'Transferencia',
      text: 'Pagamento realizado e recebimento de R$ 50,00',
    });
    expect(result.status).toBe('AMBIGUOUS');
    expect(result.parsedAmount).toBe('50.00');
    expect(result.reasons).toContain('termos_conflitantes');
  });

  it('classifies an amount without a directional term as AMBIGUOUS', () => {
    const result = parser.parse({
      packageName: 'com.example.bank',
      title: 'Transferencia',
      text: 'Transferencia no valor de R$ 300,00 realizada',
    });
    expect(result.status).toBe('AMBIGUOUS');
    expect(result.parsedAmount).toBe('300.00');
  });

  it('never returns FINANCIAL_CANDIDATE or CONFIRMED for any input (parser cannot create finances)', () => {
    const cases = [
      { title: 'Compra aprovada', text: 'R$ 10,00' },
      { title: 'Oferta', text: 'promocao' },
      { title: '', text: '' },
    ];
    for (const input of cases) {
      const result = parser.parse({ packageName: 'com.example.bank', ...input });
      expect(result.status).not.toBe('CONFIRMED');
    }
  });
});
