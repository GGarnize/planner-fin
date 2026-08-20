import { describe, expect, it } from 'vitest';
import {
  civilDueDate,
  normalizeMoney,
  templateDefaults,
  templateErrorMessage,
} from './transaction-template';

describe('modelos de lançamento', () => {
  it.each([
    ['1800', '1800.00'],
    ['1800,5', '1800.50'],
    ['1800.50', '1800.50'],
    ['5.000,50', '5000.50'],
    ['R$ 5.000,50', '5000.50'],
    ['R$5000', '5000.00'],
    ['  5000  ', '5000.00'],
    ['99999999999999999.99', '99999999999999999.99'],
  ])('normaliza dinheiro por string sem perder precisão: %s', (input, expected) => {
    expect(normalizeMoney(input)).toBe(expected);
  });
  it.each(['', '0', '-1.00', '1e3', '1,234.50', '1.001', '100000000000000000.00'])(
    'rejeita formato monetário inválido: %s',
    (input) => expect(normalizeMoney(input)).toBeNull(),
  );
  it.each([
    ['-10,25', '-10.25'],
    ['-10', '-10.00'],
  ])('com allowNegative aceita valores negativos: %s', (input, expected) => {
    expect(normalizeMoney(input, { allowNegative: true })).toBe(expected);
  });
  it('com allowZero aceita zero, sem allowZero continua rejeitando', () => {
    expect(normalizeMoney('0.00', { allowZero: true })).toBe('0.00');
    expect(normalizeMoney('0.00')).toBeNull();
  });
  it('limita o dia ao último dia civil sem conversão de fuso', () => {
    expect(civilDueDate(2024, 2, 31)).toBe('2024-02-29');
    expect(civilDueDate(2025, 2, 31)).toBe('2025-02-28');
  });
  it('copia defaults, inicia pendente e descarta referências indisponíveis', () => {
    const result = templateDefaults(
      {
        id: 't',
        name: 'Aluguel',
        type: 'EXPENSE',
        categoryId: 'c',
        categoryAvailable: false,
        description: 'Aluguel',
        plannedAmount: '1000.00',
        defaultAccountId: 'a',
        defaultAccountAvailable: false,
        notes: 'nota',
        dueDay: 31,
        archivedAt: null,
        createdAt: '',
        updatedAt: '',
      },
      2025,
      2,
    );
    expect(result).toMatchObject({
      status: 'PENDING',
      categoryId: '',
      accountId: '',
      dueDate: '2025-02-28',
      actualAmount: '',
      paidAt: '',
    });
    expect(result).not.toHaveProperty('templateId');
  });
  it('traduz códigos seguros da API', () => {
    expect(templateErrorMessage('TEMPLATE_NAME_CONFLICT')).toContain('Já existe');
    expect(templateErrorMessage('CATEGORY_TYPE_MISMATCH')).toContain('mesma natureza');
  });
});
