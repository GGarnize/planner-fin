import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  adjacentMonth,
  isCivilMonth,
  money,
  monthDateBounds,
  percent,
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
});
