export const civil = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
export const civilText = (value: Date): string => value.toISOString().slice(0, 10);
export const todayCivil = (): string => new Date().toISOString().slice(0, 10);
export const addDays = (value: string, days: number): string => {
  const date = civil(value);
  date.setUTCDate(date.getUTCDate() + days);
  return civilText(date);
};
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
export type Calendar = {
  frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
};
export function nextOnOrAfter(rule: Calendar, lower: string): string {
  const base = civil(lower);
  if (rule.frequency === 'WEEKLY') {
    const iso = base.getUTCDay() || 7;
    return addDays(lower, (rule.dayOfWeek! - iso + 7) % 7);
  }
  let year = base.getUTCFullYear(),
    month = base.getUTCMonth() + 1;
  if (rule.frequency === 'YEARLY') month = rule.monthOfYear!;
  const candidate = () => {
    const day = Math.min(rule.dayOfMonth!, lastDay(year, month));
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  while (candidate() < lower) {
    if (rule.frequency === 'YEARLY') year++;
    else {
      month++;
      if (month === 13) {
        month = 1;
        year++;
      }
    }
  }
  return candidate();
}
export function nextAfter(rule: Calendar, current: string): string {
  if (rule.frequency === 'WEEKLY') return addDays(current, 7);
  const date = civil(current);
  let year = date.getUTCFullYear(),
    month = date.getUTCMonth() + 1;
  if (rule.frequency === 'MONTHLY') {
    month++;
    if (month === 13) {
      month = 1;
      year++;
    }
  } else year++;
  const targetMonth = rule.frequency === 'YEARLY' ? rule.monthOfYear! : month;
  const day = Math.min(rule.dayOfMonth!, lastDay(year, targetMonth));
  return `${String(year).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export const cursorFor = (
  rule: Calendar & { startDate: string; endDate?: string | null },
  today: string,
  after?: string | null,
) => {
  let lower = rule.startDate > today ? rule.startDate : today;
  if (after && addDays(after, 1) > lower) lower = addDays(after, 1);
  const next = nextOnOrAfter(rule, lower);
  return rule.endDate && next > rule.endDate ? null : next;
};
