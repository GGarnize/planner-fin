import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { parse as parseCsv } from 'csv-parse/sync';
import { parseStrict as parseOfxLibrary } from 'ofx-js';

export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 10_000;
export const IMPORT_PARSER_VERSION = 'spec021-v1';
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONEY = /^(0|[1-9]\d{0,16})\.\d{2}$/;

export type NormalizedImportRow = {
  rowNumber: number;
  date: string | null;
  description: string | null;
  type: 'INCOME' | 'EXPENSE' | null;
  amount: string | null;
  externalId: string | null;
  warnings: string[];
  blocked: boolean;
};

export type CsvMapping = {
  version: 1;
  delimiter: ',' | ';' | '\t';
  header: boolean;
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY';
  decimalSeparator: '.' | ',';
  thousandsSeparator: '.' | ',' | null;
  columns: {
    date: number;
    description: number;
    amount?: number;
    debit?: number;
    credit?: number;
    type?: number;
    externalId?: number;
  };
  externalIdReliable?: boolean;
};

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sanitizeFilename(value: string): string {
  const basename = value.replaceAll('\\', '/').split('/').pop() ?? '';
  return (
    Array.from(
      basename
        .normalize('NFKC')
        .replaceAll(/[\s\S]/g, (character) => {
          const code = character.codePointAt(0) ?? 0;
          return code < 32 || code === 127 ? '' : character;
        })
        .trim(),
    )
      .slice(0, 120)
      .join('') || 'arquivo'
  );
}

export function normalizeDescription(value: string): string {
  return value
    .normalize('NFKC')
    .replaceAll(/[\s\S]/g, (character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || code === 127 || character === '<' || character === '>' ? ' ' : character;
    })
    .replace(/[\s\p{Pd}_|]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('und');
}

export function civilDate(value: string): string | null {
  const match = DATE.exec(value);
  if (!match) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value ? value : null;
}

export function canonicalMoney(value: string): string | null {
  if (!MONEY.test(value)) return null;
  try {
    const decimal = new Prisma.Decimal(value);
    if (decimal.lte(0) || decimal.gt('99999999999999999.99')) return null;
    return decimal.toFixed(2);
  } catch {
    return null;
  }
}

export function fingerprints(input: {
  userId: string;
  accountId: string;
  format: 'OFX' | 'CSV';
  externalId?: string | null;
  date: string;
  type: string;
  amount: string;
  description: string;
}) {
  const description = normalizeDescription(input.description);
  const base = [input.accountId, input.type, input.amount, description].join('\u001f');
  return {
    strongKeyHash: input.externalId
      ? sha256(
          `v1\u001f${input.userId}\u001f${input.accountId}\u001f${input.format}\u001f${input.externalId.trim()}`,
        )
      : null,
    exactFingerprint: sha256(`v1\u001f${base}\u001f${input.date}`),
    windowFingerprint: sha256(`v1\u001f${base}`),
  };
}

function description(name: unknown, memo: unknown): string | null {
  const parts = [name, memo].filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  const normalized = normalizeDescription(parts.join(' — '));
  return normalized ? Array.from(normalized).slice(0, 200).join('') : null;
}

function findTransactions(value: unknown, found: Array<Record<string, unknown>>): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key.toUpperCase() === 'STMTTRN') {
      for (const row of Array.isArray(child) ? child : [child])
        if (row && typeof row === 'object') found.push(row as Record<string, unknown>);
    } else if (Array.isArray(child)) child.forEach((item) => findTransactions(item, found));
    else findTransactions(child, found);
  }
}

export function parseOfx(buffer: Buffer): NormalizedImportRow[] {
  const text = decodeUtf8(buffer);
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|<xi:include/i.test(text)) throw new Error('UNSAFE_OFX');
  const nesting = [...text.matchAll(/<([A-Z][A-Z0-9.]*)\b[^>]*>/gi)].length;
  if (nesting > 200_000) throw new Error('OFX_COMPLEXITY_LIMIT');
  const parsed = parseOfxLibrary(text) as unknown;
  const transactions: Array<Record<string, unknown>> = [];
  findTransactions(parsed, transactions);
  if (!transactions.length || transactions.length > IMPORT_MAX_ROWS) throw new Error('ROW_LIMIT');
  return transactions.map((row, index) => {
    const rawAmount = String(row.TRNAMT ?? '');
    const negative = rawAmount.startsWith('-');
    const magnitude = canonicalMoney(rawAmount.replace(/^[+-]/, ''));
    const rawDate = String(row.DTPOSTED ?? '').slice(0, 8);
    const date = /^\d{8}$/.test(rawDate)
      ? civilDate(`${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`)
      : null;
    const type = magnitude ? (negative ? 'EXPENSE' : 'INCOME') : null;
    const label = description(row.NAME, row.MEMO);
    const trnType = typeof row.TRNTYPE === 'string' ? row.TRNTYPE.toUpperCase() : null;
    const conflict =
      !!trnType &&
      ((trnType === 'CREDIT' && type === 'EXPENSE') || (trnType === 'DEBIT' && type === 'INCOME'));
    const warnings = conflict ? ['OFX_TYPE_SIGN_CONFLICT'] : [];
    return {
      rowNumber: index + 1,
      date,
      description: label,
      type,
      amount: magnitude,
      externalId: typeof row.FITID === 'string' ? row.FITID.trim().slice(0, 255) || null : null,
      warnings,
      blocked: !date || !label || !magnitude || conflict,
    };
  });
}

export function parseCsvCells(buffer: Buffer, delimiter: CsvMapping['delimiter']): string[][] {
  const text = decodeUtf8(buffer).replace(/^\uFEFF/, '');
  const records = parseCsv(text, {
    delimiter,
    bom: true,
    relax_column_count: false,
    max_record_size: 8 * 1024,
    skip_empty_lines: true,
  }) as string[][];
  if (!records.length || records.length > IMPORT_MAX_ROWS + 1) throw new Error('ROW_LIMIT');
  return records.map((record) => record.map((cell) => String(cell)));
}

function mappedDate(value: string, format: CsvMapping['dateFormat']): string | null {
  if (format === 'YYYY-MM-DD') return civilDate(value.trim());
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? civilDate(`${match[3]}-${match[2]}-${match[1]}`) : null;
}

function mappedAmount(
  value: string,
  mapping: CsvMapping,
): { amount: string | null; negative: boolean } {
  const raw = value.trim();
  if (!raw || /[eE]|NaN|Infinity/i.test(raw)) return { amount: null, negative: false };
  const negative = raw.startsWith('-');
  let unsigned = raw.replace(/^[+-]/, '');
  if (mapping.thousandsSeparator) {
    if (mapping.thousandsSeparator === mapping.decimalSeparator) return { amount: null, negative };
    const groups = unsigned.split(mapping.decimalSeparator)[0].split(mapping.thousandsSeparator);
    if (
      groups.length > 1 &&
      (groups[0].length < 1 || groups[0].length > 3 || groups.slice(1).some((g) => g.length !== 3))
    )
      return { amount: null, negative };
    unsigned = unsigned.replaceAll(mapping.thousandsSeparator, '');
  }
  if (mapping.decimalSeparator === ',') unsigned = unsigned.replace(',', '.');
  return { amount: canonicalMoney(unsigned.includes('.') ? unsigned : `${unsigned}.00`), negative };
}

export function validateMapping(mapping: CsvMapping): void {
  const c = mapping.columns;
  const valueMode = c.amount !== undefined;
  if (
    mapping.version !== 1 ||
    mapping.thousandsSeparator === mapping.decimalSeparator ||
    valueMode === (c.debit !== undefined || c.credit !== undefined) ||
    (!valueMode && (c.debit === undefined || c.credit === undefined))
  )
    throw new Error('INVALID_CSV_MAPPING');
  const indexes = Object.values(c).filter((v): v is number => typeof v === 'number');
  if (
    indexes.some((v) => !Number.isInteger(v) || v < 0) ||
    new Set(indexes).size !== indexes.length
  )
    throw new Error('INVALID_CSV_MAPPING');
}

export function mapCsv(cells: string[][], mapping: CsvMapping): NormalizedImportRow[] {
  validateMapping(mapping);
  const rows = mapping.header ? cells.slice(1) : cells;
  if (!rows.length || rows.length > IMPORT_MAX_ROWS) throw new Error('ROW_LIMIT');
  return rows.map((row, index) => {
    const c = mapping.columns;
    const date = mappedDate(row[c.date] ?? '', mapping.dateFormat);
    const label = normalizeDescription(row[c.description] ?? '');
    let parsed: { amount: string | null; negative: boolean };
    let type: 'INCOME' | 'EXPENSE' | null = null;
    if (c.amount !== undefined) {
      parsed = mappedAmount(row[c.amount] ?? '', mapping);
      type = parsed.amount ? (parsed.negative ? 'EXPENSE' : 'INCOME') : null;
    } else {
      const debit = mappedAmount(row[c.debit!] ?? '', mapping);
      const credit = mappedAmount(row[c.credit!] ?? '', mapping);
      const exactlyOne = Boolean(debit.amount) !== Boolean(credit.amount);
      parsed = exactlyOne ? (debit.amount ? debit : credit) : { amount: null, negative: false };
      type = exactlyOne ? (debit.amount ? 'EXPENSE' : 'INCOME') : null;
    }
    if (c.type !== undefined) {
      const explicit = (row[c.type] ?? '').trim().toUpperCase();
      if (explicit === 'INCOME' || explicit === 'EXPENSE') type = explicit;
      else type = null;
    }
    const description = label ? Array.from(label).slice(0, 200).join('') : null;
    return {
      rowNumber: index + 1,
      date,
      description,
      type,
      amount: parsed.amount,
      externalId:
        c.externalId === undefined ? null : (row[c.externalId] ?? '').trim().slice(0, 255) || null,
      warnings: [],
      blocked: !date || !description || !type || !parsed.amount,
    };
  });
}

function decodeUtf8(buffer: Buffer): string {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  if (text.includes('\u0000')) throw new Error('INVALID_ENCODING');
  return text;
}
