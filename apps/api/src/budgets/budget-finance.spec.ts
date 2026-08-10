import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  adjacentMonth,
  isCivilMonth,
  money,
  monthDateBounds,
  percent,
  projectMonthlyExpenses,
  totals,
} from './budget-finance';

describe('cálculos do orçamento mensal', () => {
  it('valida estritamente o mês civil e produz limites DATE', () => {
    expect(isCivilMonth('2026-08')).toBe(true);
    for (const invalid of ['2026-8', '2026-00', '2026-13', 'x2026-08', '2026-08-01'])
      expect(isCivilMonth(invalid)).toBe(false);
    expect(monthDateBounds('2026-08')).toEqual({
      from: new Date('2026-08-01T00:00:00.000Z'),
      to: new Date('2026-09-01T00:00:00.000Z'),
    });
  });
  it('navega corretamente na virada do ano', () => {
    expect(adjacentMonth('2026-12', 1)).toBe('2027-01');
    expect(adjacentMonth('2026-01', -1)).toBe('2025-12');
  });
  it('mantém dinheiro decimal, restante negativo e percentual acima de 100', () => {
    const result = totals(
      new Prisma.Decimal('500.00'),
      new Prisma.Decimal('0.00'),
      new Prisma.Decimal('550.00'),
    );
    expect(result.remainingAgainstCommitted).toBe('-50.00');
    expect(result.committedPercent).toBe('110.00');
    expect(money(new Prisma.Decimal('0.1').add('0.2'))).toBe('0.30');
  });
  it('arredonda somente o percentual final em HALF_UP', () => {
    expect(percent(new Prisma.Decimal('1.00'), new Prisma.Decimal('32.00'))).toBe('3.13');
  });
  it('projeta despesas mensais por uma única regra decimal canônica', () => {
    const decimal = (value: string) => new Prisma.Decimal(value);
    const result = projectMonthlyExpenses({
      transactions: [
        {
          categoryId: 'c1',
          categoryName: 'Casa',
          status: 'PENDING',
          plannedAmount: decimal('300.00'),
          actualAmount: null,
        },
        {
          categoryId: 'c1',
          categoryName: 'Casa',
          status: 'PAID',
          plannedAmount: decimal('500.00'),
          actualAmount: decimal('480.00'),
        },
      ],
      installments: [{ categoryId: 'c2', categoryName: 'Compras', amount: decimal('200.00') }],
      debtPayments: [{ interestAmount: decimal('20.00'), feeAmount: decimal('5.00') }],
    });
    expect(money(result.categoryValues.get('c1')!.realized)).toBe('480.00');
    expect(money(result.categoryValues.get('c1')!.committed)).toBe('800.00');
    expect(money(result.categorizedRealized)).toBe('680.00');
    expect(money(result.debtCost)).toBe('25.00');
    expect(money(result.realizedExpense)).toBe('705.00');
    expect(money(result.committedExpense)).toBe('1025.00');
  });
});
