import type {
  NotificationParseInput,
  NotificationParseResult,
  NotificationParser,
} from './notification-parser.interface';

const AMOUNT_PATTERN = /R\$\s?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/;

const INCOME_TERMS = [
  'recebeu',
  'recebimento',
  'pix recebido',
  'deposito recebido',
  'creditado',
  'estorno recebido',
  'transferencia recebida',
  'ted recebida',
  'doc recebido',
];

const EXPENSE_TERMS = [
  'compra aprovada',
  'compra realizada',
  'compra no valor',
  'compra de',
  'pagamento realizado',
  'pagamento efetuado',
  'pagamento aprovado',
  'fatura',
  'debito',
  'cobranca',
  'tarifa',
];

const MARKETING_TERMS = [
  'oferta',
  'promocao',
  'cashback disponivel',
  'confira',
  'baixe',
  'instale',
  'campanha',
  'aproveite',
  'desconto especial',
  'parabens',
  'novidade',
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function combineText(input: NotificationParseInput): string {
  return [input.title, input.text, input.subText, input.bigText].filter(Boolean).join(' \n ');
}

function normalizeAmount(raw: string): string {
  return raw.replace(/\./g, '').replace(',', '.');
}

function matchedTerms(normalized: string, terms: string[]): string[] {
  return terms.filter((term) => normalized.includes(term));
}

function describe(input: NotificationParseInput): string | undefined {
  const source = input.title?.trim() || input.text?.trim() || input.subText?.trim() || undefined;
  return source ? source.slice(0, 300) : undefined;
}

/** Fallback parser for any package without a dedicated implementation. V1 covers no specific bank. */
export class GenericNotificationParser implements NotificationParser {
  readonly packageName = null;
  readonly version = 1;

  parse(input: NotificationParseInput): NotificationParseResult {
    const combined = combineText(input);
    const normalized = normalize(combined);
    const amountMatch = combined.match(AMOUNT_PATTERN);

    if (!amountMatch) {
      const marketing = matchedTerms(normalized, MARKETING_TERMS);
      if (marketing.length)
        return {
          status: 'NON_FINANCIAL',
          reasons: ['sem_valor_monetario', ...marketing.map((term) => `termo_marketing:${term}`)],
        };
      return { status: 'UNCLASSIFIED', reasons: ['sem_valor_monetario'] };
    }

    const parsedAmount = normalizeAmount(amountMatch[1]);
    const incomeTerms = matchedTerms(normalized, INCOME_TERMS);
    const expenseTerms = matchedTerms(normalized, EXPENSE_TERMS);
    const reasons = ['valor_detectado'];

    if (incomeTerms.length && !expenseTerms.length)
      return {
        status: 'FINANCIAL_CANDIDATE',
        parsedType: 'INCOME',
        parsedAmount,
        parsedDescription: describe(input),
        reasons: [...reasons, ...incomeTerms.map((term) => `termo_entrada:${term}`)],
      };

    if (expenseTerms.length && !incomeTerms.length)
      return {
        status: 'FINANCIAL_CANDIDATE',
        parsedType: 'EXPENSE',
        parsedAmount,
        parsedDescription: describe(input),
        reasons: [...reasons, ...expenseTerms.map((term) => `termo_saida:${term}`)],
      };

    return {
      status: 'AMBIGUOUS',
      parsedAmount,
      parsedDescription: describe(input),
      reasons: incomeTerms.length && expenseTerms.length
        ? [...reasons, 'termos_conflitantes', ...incomeTerms.map((t) => `termo_entrada:${t}`), ...expenseTerms.map((t) => `termo_saida:${t}`)]
        : [...reasons, 'sem_termo_direcional'],
    };
  }
}
