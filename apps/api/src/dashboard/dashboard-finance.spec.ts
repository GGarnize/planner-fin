import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { addCivilDays, cashPosition } from './dashboard-finance';
describe('finanças do dashboard', () => {
  it('soma caixa disponível e não publica soma parcial', () => {
    expect(cashPosition([new Prisma.Decimal('1000.00'), new Prisma.Decimal('500.00')])).toEqual({
      totalRealizedBalance: '1500.00',
      availableAccountCount: 2,
      unavailableAccountCount: 0,
    });
    expect(
      cashPosition([new Prisma.Decimal('1000.00'), new Prisma.Decimal('500.00'), null]),
    ).toEqual({ totalRealizedBalance: null, availableAccountCount: 2, unavailableAccountCount: 1 });
    expect(cashPosition([])).toEqual({
      totalRealizedBalance: '0.00',
      availableAccountCount: 0,
      unavailableAccountCount: 0,
    });
  });
  it('adiciona dias civis em viradas de ano', () =>
    expect(addCivilDays('2026-12-29', 7)).toBe('2027-01-05'));
});
