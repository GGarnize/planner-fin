import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  FinancialEntryListQuery,
  FinancialEntrySource,
  PaginatedFinancialEntriesResponse,
  PublicFinancialEntry,
} from '@planner-fin/shared';
import { API_CONFIG } from '../auth/auth.types';
import type { ApiConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { isCivilDate } from '../transactions/dto';
import {
  civilDate,
  civilString,
  entryQueryFingerprint,
  readEntryCursor,
  signEntryCursor,
} from './financial-entries.helpers';

const invalid = (field = 'body') =>
  new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Revise os dados informados.',
    details: [{ field, message: 'Valor inválido.' }],
  });

type Row = {
  source: FinancialEntrySource;
  sourceId: string;
  purchaseId: string | null;
  type: 'INCOME' | 'EXPENSE';
  description: string;
  notes: string | null;
  amount: Prisma.Decimal;
  date: Date;
  categoryId: string;
  accountId: string | null;
  status: 'PENDING' | 'PAID' | null;
  cardId: string | null;
  cardName: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  invoicePaid: boolean;
  recurrenceRuleId: string | null;
  occurrenceDate: Date | null;
  createdAt: Date;
};

/**
 * Feed único da tela de Lançamentos: une FinancialTransaction e CardInstallment
 * (parcela de compra no cartão, na mesma granularidade usada por
 * dashboard/orçamento — ver SPEC-010 §"CardInstallment") numa única lista
 * ordenada e paginada. CardInvoicePayment nunca entra aqui: a despesa já foi
 * reconhecida na parcela, o pagamento da fatura é só baixa de caixa.
 */
@Injectable()
export class FinancialEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  async list(
    userId: string,
    query: FinancialEntryListQuery,
  ): Promise<PaginatedFinancialEntriesResponse> {
    this.intervals(query);
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    if (!/^\d+$/.test(query.limit ?? '20') || limit < 1 || limit > 100) throw invalid('limit');
    const fingerprint = entryQueryFingerprint(query, limit);
    const cursor = query.cursor
      ? readEntryCursor(query.cursor, this.config.jwtSecret, fingerprint)
      : undefined;

    // CardInstallment não tem conta, status pago/pendente ou data de pagamento
    // próprios — quando esses filtros são usados, a semântica correta é
    // "nenhuma parcela de cartão pode casar", não inventar um valor falso.
    const cardEnabled =
      !query.accountId &&
      !query.status &&
      !query.paidAtFrom &&
      !query.paidAtTo &&
      query.type !== 'INCOME';

    const and = (parts: Prisma.Sql[]) => (parts.length ? Prisma.join(parts, ' ') : Prisma.empty);

    const txFilters: Prisma.Sql[] = [];
    if (query.accountId) txFilters.push(Prisma.sql`AND ft."accountId" = ${query.accountId}::uuid`);
    if (query.categoryId)
      txFilters.push(Prisma.sql`AND ft."categoryId" = ${query.categoryId}::uuid`);
    if (query.type)
      txFilters.push(Prisma.sql`AND ft."type" = ${query.type}::"FinancialTransactionType"`);
    if (query.status)
      txFilters.push(Prisma.sql`AND ft."status" = ${query.status}::"FinancialTransactionStatus"`);
    if (query.dueDateFrom)
      txFilters.push(Prisma.sql`AND ft."dueDate" >= ${civilDate(query.dueDateFrom)}`);
    if (query.dueDateTo)
      txFilters.push(Prisma.sql`AND ft."dueDate" <= ${civilDate(query.dueDateTo)}`);
    if (query.paidAtFrom)
      txFilters.push(Prisma.sql`AND ft."paidAt" >= ${civilDate(query.paidAtFrom)}`);
    if (query.paidAtTo) txFilters.push(Prisma.sql`AND ft."paidAt" <= ${civilDate(query.paidAtTo)}`);

    const cardFilters: Prisma.Sql[] = [];
    if (query.categoryId)
      cardFilters.push(Prisma.sql`AND cp."categoryId" = ${query.categoryId}::uuid`);
    if (query.dueDateFrom)
      cardFilters.push(Prisma.sql`AND inv."dueDate" >= ${civilDate(query.dueDateFrom)}`);
    if (query.dueDateTo)
      cardFilters.push(Prisma.sql`AND inv."dueDate" <= ${civilDate(query.dueDateTo)}`);

    const cardBlock = cardEnabled
      ? Prisma.sql`
        UNION ALL
        SELECT
          'CARD_INSTALLMENT'::text AS "source",
          ci."id" AS "sourceId",
          cp."id" AS "purchaseId",
          'EXPENSE'::"FinancialTransactionType" AS "type",
          cp."description" AS "description",
          cp."notes" AS "notes",
          ci."amount" AS "amount",
          inv."dueDate" AS "date",
          cp."categoryId" AS "categoryId",
          NULL::uuid AS "accountId",
          NULL::"FinancialTransactionStatus" AS "status",
          cp."cardId" AS "cardId",
          card."name" AS "cardName",
          ci."installmentNumber" AS "installmentNumber",
          ci."installmentCount" AS "installmentCount",
          (inv."status" = 'PAID') AS "invoicePaid",
          NULL::uuid AS "recurrenceRuleId",
          NULL::date AS "occurrenceDate",
          ci."createdAt" AS "createdAt"
        FROM "CardInstallment" ci
        JOIN "CardPurchase" cp ON cp."id" = ci."purchaseId"
        JOIN "CardInvoice" inv ON inv."id" = ci."invoiceId"
        JOIN "FinancialCreditCard" card ON card."id" = cp."cardId"
        WHERE cp."userId" = ${userId}::uuid
        ${and(cardFilters)}
      `
      : Prisma.empty;

    const cursorFilter = cursor
      ? Prisma.sql`
        WHERE (
          "date" < ${civilDate(cursor.date)}
          OR ("date" = ${civilDate(cursor.date)} AND "createdAt" < ${new Date(cursor.createdAt)})
          OR (
            "date" = ${civilDate(cursor.date)} AND "createdAt" = ${new Date(cursor.createdAt)}
            AND "source" > ${cursor.source}
          )
          OR (
            "date" = ${civilDate(cursor.date)} AND "createdAt" = ${new Date(cursor.createdAt)}
            AND "source" = ${cursor.source} AND "sourceId" > ${cursor.id}::uuid
          )
        )
      `
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT * FROM (
        SELECT
          'TRANSACTION'::text AS "source",
          ft."id" AS "sourceId",
          NULL::uuid AS "purchaseId",
          ft."type" AS "type",
          ft."description" AS "description",
          ft."notes" AS "notes",
          (CASE WHEN ft."status" = 'PAID' THEN ft."actualAmount" ELSE ft."plannedAmount" END)
            AS "amount",
          ft."dueDate" AS "date",
          ft."categoryId" AS "categoryId",
          ft."accountId" AS "accountId",
          ft."status" AS "status",
          NULL::uuid AS "cardId",
          NULL::text AS "cardName",
          NULL::int AS "installmentNumber",
          NULL::int AS "installmentCount",
          false AS "invoicePaid",
          ft."recurrenceRuleId" AS "recurrenceRuleId",
          ft."occurrenceDate" AS "occurrenceDate",
          ft."createdAt" AS "createdAt"
        FROM "FinancialTransaction" ft
        WHERE ft."userId" = ${userId}::uuid AND ft."deletedAt" IS NULL
        ${and(txFilters)}
        ${cardBlock}
      ) AS combined
      ${cursorFilter}
      ORDER BY "date" DESC, "createdAt" DESC, "source" ASC, "sourceId" ASC
      LIMIT ${limit + 1}
    `;

    const more = rows.length > limit;
    const dataRows = rows.slice(0, limit);
    const today = civilString(new Date());
    const last = dataRows.at(-1);
    return {
      data: dataRows.map((row) => this.public(row, today)),
      page: {
        limit,
        nextCursor:
          more && last
            ? signEntryCursor(
                {
                  date: civilString(last.date),
                  createdAt: last.createdAt.toISOString(),
                  source: last.source,
                  id: last.sourceId,
                  fingerprint,
                },
                this.config.jwtSecret,
              )
            : null,
      },
    };
  }

  private public(row: Row, today: string): PublicFinancialEntry {
    const date = civilString(row.date);
    return {
      id: `${row.source}:${row.sourceId}`,
      source: row.source,
      sourceId: row.sourceId,
      type: row.type,
      description: row.description,
      notes: row.notes,
      date,
      amount: row.amount.toFixed(2),
      categoryId: row.categoryId,
      status: row.status,
      accountId: row.accountId,
      cardId: row.cardId,
      cardName: row.cardName,
      purchaseId: row.purchaseId,
      installmentNumber: row.installmentNumber,
      installmentCount: row.installmentCount,
      overdue:
        row.source === 'TRANSACTION'
          ? row.status === 'PENDING' && date < today
          : !row.invoicePaid && date < today,
      isRecurringOccurrence: Boolean(row.recurrenceRuleId && row.occurrenceDate),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private intervals(q: FinancialEntryListQuery) {
    for (const key of ['dueDateFrom', 'dueDateTo', 'paidAtFrom', 'paidAtTo'] as const)
      if (q[key] && !isCivilDate(q[key])) throw invalid(key);
    if (q.dueDateFrom && q.dueDateTo && q.dueDateFrom > q.dueDateTo) throw invalid('dueDateFrom');
    if (q.paidAtFrom && q.paidAtTo && q.paidAtFrom > q.paidAtTo) throw invalid('paidAtFrom');
  }
}
