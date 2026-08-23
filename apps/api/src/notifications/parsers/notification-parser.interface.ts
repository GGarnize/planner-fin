export interface NotificationParseInput {
  packageName: string;
  title?: string | null;
  text?: string | null;
  subText?: string | null;
  bigText?: string | null;
}

export type NotificationParseStatus =
  | 'UNCLASSIFIED'
  | 'FINANCIAL_CANDIDATE'
  | 'NON_FINANCIAL'
  | 'AMBIGUOUS';

export interface NotificationParseResult {
  status: NotificationParseStatus;
  parsedType?: 'INCOME' | 'EXPENSE';
  parsedAmount?: string;
  parsedDescription?: string;
  parsedCardLast4?: string;
  reasons: string[];
}

/** Deterministic, versioned, explainable — no ML/LLM. Never creates finances by itself. */
export interface NotificationParser {
  /** null selects this parser as the fallback for any package without a dedicated implementation. */
  readonly packageName: string | null;
  readonly version: number;
  parse(input: NotificationParseInput): NotificationParseResult;
}
