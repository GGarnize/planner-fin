import type { PublicTransactionTemplate } from '@planner-fin/shared';

export function civilDueDate(year: number, month: number, dueDay: number): string {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const day = Math.min(Math.max(1, dueDay), days[month - 1] ?? 31);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function templateErrorMessage(code?: string): string {
  return (
    {
      TEMPLATE_NAME_CONFLICT: 'Já existe um modelo com este nome.',
      TEMPLATE_NOT_FOUND: 'Este modelo não foi encontrado.',
      TEMPLATE_ARCHIVED: 'Este modelo está arquivado.',
      RELATED_RESOURCE_NOT_FOUND: 'A conta ou categoria informada não foi encontrada.',
      RELATED_RESOURCE_ARCHIVED: 'Escolha uma conta e uma categoria ativas.',
      CATEGORY_TYPE_MISMATCH: 'A categoria deve ter a mesma natureza do modelo.',
      VALIDATION_ERROR: 'Revise os dados informados.',
    }[code ?? ''] ?? 'Não foi possível concluir a operação.'
  );
}

export function templateDefaults(template: PublicTransactionTemplate, year: number, month: number) {
  return {
    type: template.type,
    status: 'PENDING' as const,
    categoryId: template.categoryAvailable ? template.categoryId : '',
    accountId: template.defaultAccountAvailable ? (template.defaultAccountId ?? '') : '',
    description: template.description,
    plannedAmount: template.plannedAmount,
    notes: template.notes ?? '',
    dueDate: template.dueDay ? civilDueDate(year, month, template.dueDay) : '',
    actualAmount: '',
    paidAt: '',
  };
}
