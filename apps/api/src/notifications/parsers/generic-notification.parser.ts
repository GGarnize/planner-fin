import type {
  NotificationParseInput,
  NotificationParseResult,
  NotificationParser,
} from './notification-parser.interface';

/** 1-3 digits + thousands groups + comma-decimals | dotted thousands | comma/dot decimals | plain integer. */
const NUMBER_TOKEN =
  '(?:\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d{1,3}(?:\\.\\d{3})+|\\d+(?:[.,]\\d{2})|\\d+)';

/** Amount extraction is context-gated: a bare number (e.g. a card's last 4 digits) is never money. */
const AMOUNT_PATTERNS = [
  new RegExp(`R\\$\\s*(${NUMBER_TOKEN})`, 'i'),
  new RegExp(`valor\\s*(?:de)?\\s*:?\\s*(${NUMBER_TOKEN})`, 'i'),
  new RegExp(`compra\\s+(?:aprovada\\s+|realizada\\s+)?de\\s+(${NUMBER_TOKEN})`, 'i'),
];

const CARD_LAST4_PATTERN =
  /cart[aã]o\s+(?:terminado|finalizado)\s+em\s+(\d{4})|cart[aã]o\s+final\s+(\d{4})|(?:••••|\*{4})\s*(\d{4})/i;

const INCOME_TERMS = [
  'recebeu',
  'recebimento',
  'pix recebido',
  'deposito recebido',
  'creditado',
  'credito recebido',
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
  'compra',
  'pagamento realizado',
  'pagamento efetuado',
  'pagamento aprovado',
  'pagamento',
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
  const trimmed = raw.trim();
  if (trimmed.includes(',')) return Number(trimmed.replace(/\./g, '').replace(',', '.')).toFixed(2);
  if (/^\d+\.\d{2}$/.test(trimmed)) return Number(trimmed).toFixed(2);
  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) return `${trimmed.replace(/\./g, '')}.00`;
  return Number(trimmed).toFixed(2);
}

function extractAmount(combined: string): string | undefined {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = combined.match(pattern);
    if (match) return normalizeAmount(match[1]!);
  }
  return undefined;
}

function extractCardLast4(combined: string): string | undefined {
  const match = combined.match(CARD_LAST4_PATTERN);
  return match ? match[1] ?? match[2] ?? match[3] : undefined;
}

function matchedTerms(normalized: string, terms: string[]): string[] {
  return terms.filter((term) => normalized.includes(term));
}

function describe(input: NotificationParseInput): string | undefined {
  const source = input.title?.trim() || input.text?.trim() || input.subText?.trim() || undefined;
  return source ? source.slice(0, 300) : undefined;
}

/** Fallback parser for any package without a dedicated implementation. V2 widens amount/card-last4 context extraction. */
export class GenericNotificationParser implements NotificationParser {
  readonly packageName = null;
  readonly version = 2;

  parse(input: NotificationParseInput): NotificationParseResult {
    const combined = combineText(input);
    const normalized = normalize(combined);
    const parsedAmount = extractAmount(combined);

    if (!parsedAmount) {
      const marketing = matchedTerms(normalized, MARKETING_TERMS);
      if (marketing.length)
        return {
          status: 'NON_FINANCIAL',
          reasons: ['sem_valor_monetario', ...marketing.map((term) => `termo_marketing:${term}`)],
        };
      return { status: 'UNCLASSIFIED', reasons: ['sem_valor_monetario'] };
    }

    const parsedCardLast4 = extractCardLast4(combined);
    const cardFields = parsedCardLast4 ? { parsedCardLast4 } : {};
    const cardReasons = parsedCardLast4 ? [`cartao_detectado:${parsedCardLast4}`] : [];
    const incomeTerms = matchedTerms(normalized, INCOME_TERMS);
    const expenseTerms = matchedTerms(normalized, EXPENSE_TERMS);
    const reasons = ['valor_detectado'];

    if (incomeTerms.length && !expenseTerms.length)
      return {
        status: 'FINANCIAL_CANDIDATE',
        parsedType: 'INCOME',
        parsedAmount,
        parsedDescription: describe(input),
        ...cardFields,
        reasons: [...reasons, ...incomeTerms.map((term) => `termo_entrada:${term}`), ...cardReasons],
      };

    if (expenseTerms.length && !incomeTerms.length)
      return {
        status: 'FINANCIAL_CANDIDATE',
        parsedType: 'EXPENSE',
        parsedAmount,
        parsedDescription: describe(input),
        ...cardFields,
        reasons: [...reasons, ...expenseTerms.map((term) => `termo_saida:${term}`), ...cardReasons],
      };

    return {
      status: 'AMBIGUOUS',
      parsedAmount,
      parsedDescription: describe(input),
      ...cardFields,
      reasons:
        incomeTerms.length && expenseTerms.length
          ? [
              ...reasons,
              'termos_conflitantes',
              ...incomeTerms.map((t) => `termo_entrada:${t}`),
              ...expenseTerms.map((t) => `termo_saida:${t}`),
              ...cardReasons,
            ]
          : [...reasons, 'sem_termo_direcional', ...cardReasons],
    };
  }
}
