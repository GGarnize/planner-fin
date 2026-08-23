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

  it('P01: recognizes a bare "valor de" amount without R$ and extracts the card last 4 digits', () => {
    const result = parser.parse({
      packageName: 'com.example.bank',
      text: 'Compra aprovada no valor de 3500 no cartão terminado em 6654',
    });
    expect(result.status).toBe('FINANCIAL_CANDIDATE');
    expect(result.parsedType).toBe('EXPENSE');
    expect(result.parsedAmount).toBe('3500.00');
    expect(result.parsedCardLast4).toBe('6654');
  });

  it('P02: recognizes a comma-decimal "valor de" amount and extracts the card last 4 digits', () => {
    const result = parser.parse({
      packageName: 'com.example.bank',
      text: 'Compra no valor de 8976,55 no cartão finalizado em 9999 descrição teste do telegram',
    });
    expect(result.status).toBe('FINANCIAL_CANDIDATE');
    expect(result.parsedType).toBe('EXPENSE');
    expect(result.parsedAmount).toBe('8976.55');
    expect(result.parsedCardLast4).toBe('9999');
  });

  it('P03: recognizes a thousands-separated R$ amount after "compra aprovada de"', () => {
    const result = parser.parse({
      packageName: 'com.example.bank',
      text: 'Compra aprovada de R$ 1.234,56',
    });
    expect(result.status).toBe('FINANCIAL_CANDIDATE');
    expect(result.parsedType).toBe('EXPENSE');
    expect(result.parsedAmount).toBe('1234.56');
  });

  it('P04: recognizes "pix recebido" with a "valor de" amount as INCOME', () => {
    const result = parser.parse({
      packageName: 'com.example.bank',
      text: 'Pix recebido no valor de 450,00',
    });
    expect(result.status).toBe('FINANCIAL_CANDIDATE');
    expect(result.parsedType).toBe('INCOME');
    expect(result.parsedAmount).toBe('450.00');
  });

  it('P05: never treats a card last-4 number as a monetary amount', () => {
    const result = parser.parse({
      packageName: 'com.example.bank',
      text: 'Seu cartão final 9999 está pronto',
    });
    expect(result.parsedAmount).toBeUndefined();
    expect(result.status).not.toBe('FINANCIAL_CANDIDATE');
  });

  it('P06: marketing content without a real amount never becomes a candidate', () => {
    const result = parser.parse({
      packageName: 'com.example.bank',
      title: 'Oferta imperdivel',
      text: 'Aproveite e confira o cashback disponivel no cartão final 9999',
    });
    expect(result.status).toBe('NON_FINANCIAL');
    expect(result.parsedAmount).toBeUndefined();
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
