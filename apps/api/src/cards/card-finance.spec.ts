import { describe, expect, it } from 'vitest';
import {
  addMonths,
  adjustedDate,
  initialCycle,
  invoiceDates,
  splitInstallments,
} from './card-finance';
describe('finanças de cartão', () => {
  it('distribui centavos sem float', () => {
    expect(splitInstallments('100.00', 3)).toEqual(['33.34', '33.33', '33.33']);
    expect(splitInstallments('0.03', 3)).toEqual(['0.01', '0.01', '0.01']);
    expect(() => splitInstallments('0.02', 3)).toThrow('INVALID_INSTALLMENTS');
  });
  it.each([
    [2026, 2, 31, '2026-02-28'],
    [2028, 2, 31, '2028-02-29'],
    [2026, 4, 31, '2026-04-30'],
    [2026, 1, 28, '2026-01-28'],
  ])('ajusta dia civil', (y, m, d, expected) => expect(adjustedDate(y, m, d)).toBe(expected));
  it('inclui fechamento e avança após ele', () => {
    expect(initialCycle('2026-08-10', 10)).toBe('2026-08');
    expect(initialCycle('2026-08-11', 10)).toBe('2026-09');
  });
  it('calcula vencimento estritamente posterior', () => {
    expect(invoiceDates('2026-02', 28, 5)).toEqual({
      closingDate: '2026-02-28',
      dueDate: '2026-03-05',
    });
    expect(invoiceDates('2028-02', 31, 30)).toEqual({
      closingDate: '2028-02-29',
      dueDate: '2028-03-30',
    });
  });
  it('mantém ciclos consecutivos com virada anual', () =>
    expect(addMonths('2026-12', 1)).toBe('2027-01'));
});
