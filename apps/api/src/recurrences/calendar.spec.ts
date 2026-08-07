import { describe, expect, it } from 'vitest';
import { addDays, cursorFor, nextAfter, nextOnOrAfter } from './calendar';
describe('calendário civil de recorrências', () => {
  it('encontra a próxima semana sem deslocamento', () =>
    expect(nextOnOrAfter({ frequency: 'WEEKLY', dayOfWeek: 1 }, '2026-08-07')).toBe('2026-08-10'));
  it.each([
    [28, '2025-02-28'],
    [29, '2025-02-28'],
    [30, '2024-02-29'],
    [31, '2026-04-30'],
  ])('ajusta dia mensal %i', (day, result) =>
    expect(nextOnOrAfter({ frequency: 'MONTHLY', dayOfMonth: day }, result)).toBe(result),
  );
  it('preserva fevereiro bissexto e ajusta anual não bissexto', () => {
    expect(
      nextOnOrAfter({ frequency: 'YEARLY', monthOfYear: 2, dayOfMonth: 29 }, '2024-01-01'),
    ).toBe('2024-02-29');
    expect(nextAfter({ frequency: 'YEARLY', monthOfYear: 2, dayOfMonth: 29 }, '2024-02-29')).toBe(
      '2025-02-28',
    );
  });
  it('respeita start, end e ausência de retroatividade', () => {
    expect(
      cursorFor(
        { frequency: 'MONTHLY', dayOfMonth: 31, startDate: '2026-01-01', endDate: '2026-02-28' },
        '2026-02-01',
      ),
    ).toBe('2026-02-28');
    expect(
      cursorFor(
        { frequency: 'MONTHLY', dayOfMonth: 31, startDate: '2026-01-01', endDate: '2026-02-28' },
        '2026-03-01',
      ),
    ).toBeNull();
  });
  it('calcula horizonte inclusivo de sessenta dias', () =>
    expect(addDays('2026-08-07', 60)).toBe('2026-10-06'));
});
