import type { FinancialCategoryIcon } from '@planner-fin/shared';

export const CATEGORY_ICON_OPTIONS: Array<{ value: FinancialCategoryIcon; label: string }> = [
  { value: 'HOME', label: 'Casa' },
  { value: 'WORK', label: 'Trabalho' },
  { value: 'SHOPPING_CART', label: 'Compras' },
  { value: 'RESTAURANT', label: 'Alimentação' },
  { value: 'DIRECTIONS_CAR', label: 'Transporte' },
  { value: 'HEALTH_AND_SAFETY', label: 'Saúde' },
  { value: 'SCHOOL', label: 'Educação' },
  { value: 'SAVINGS', label: 'Economia' },
];

export const CATEGORY_ICON_MAP: Record<FinancialCategoryIcon, string> = {
  HOME: 'home',
  WORK: 'work',
  SHOPPING_CART: 'shopping_cart',
  RESTAURANT: 'restaurant',
  DIRECTIONS_CAR: 'directions_car',
  HEALTH_AND_SAFETY: 'health_and_safety',
  SCHOOL: 'school',
  SAVINGS: 'savings',
};

export function materialCategoryIcon(icon: FinancialCategoryIcon | null | undefined) {
  return icon ? CATEGORY_ICON_MAP[icon] : 'category';
}

export function validCategoryColor(color: string | null | undefined) {
  return !!color && /^#[0-9A-Fa-f]{6}$/.test(color);
}
