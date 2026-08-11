import { describe, expect, it } from 'vitest';
import { civilDueDate, templateDefaults, templateErrorMessage } from './transaction-template';

describe('modelos de lançamento', () => {
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
