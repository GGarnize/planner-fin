import type { PublicTransactionTemplate } from '@planner-fin/shared';

/**
 * Aceita entrada monetária no formato pt-BR (5000, 5000,50, 5.000,50, R$ 5.000,50)
 * ou já canônico (5000.50), e normaliza para "X.YY". Quando o ponto aparece antes
 * da vírgula, ele é tratado como separador de milhar; quando a vírgula aparece
 * antes do ponto (convenção en-US, ex.: "1,234.50"), a entrada é rejeitada em vez
 * de reinterpretada, para não misturar convenções de forma ambígua.
 */
export function normalizeMoney(
  value: string,
  options: { allowNegative?: boolean; allowZero?: boolean } = {},
): string | null {
  let normalized = value.trim().replace(/^r\$\s*/i, '').trim();
  const hasComma = normalized.includes(','),
    hasDot = normalized.includes('.');
  if (hasComma && hasDot) {
    if (normalized.lastIndexOf('.') < normalized.lastIndexOf(','))
      normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }
  const sign = options.allowNegative ? '-?' : '';
  const pattern = new RegExp(`^(${sign}(?:0|[1-9]\\d{0,16}))(?:\\.(\\d{1,2}))?$`);
  const match = pattern.exec(normalized);
  const isZero = /^-?0(?:\.0{1,2})?$/.test(normalized);
  if (!match || (isZero && !options.allowZero)) return null;
  return `${match[1]}.${(match[2] ?? '').padEnd(2, '0')}`;
}

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

export function filterActiveTemplates(
  templates: PublicTransactionTemplate[],
  search: string,
): PublicTransactionTemplate[] {
  const query = search.trim().toLocaleLowerCase('pt-BR');
  return templates.filter(
    (template) =>
      !template.archivedAt &&
      (!query ||
        `${template.name} ${template.description}`.toLocaleLowerCase('pt-BR').includes(query)),
  );
}
