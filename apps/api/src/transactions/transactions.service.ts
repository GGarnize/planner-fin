import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type FinancialTransaction } from '@prisma/client';
import type {
  PaginatedFinancialTransactionsResponse,
  PublicFinancialTransaction,
  TransactionListQuery,
} from '@planner-fin/shared';
import { API_CONFIG } from '../auth/auth.types';
import type { ApiConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  isCivilDate,
  type CreateTransactionDto,
  type PayTransactionDto,
  type UpdateTransactionDto,
} from './dto';
import {
  civilDate,
  civilString,
  normalizeNotes,
  publicTransaction,
  queryFingerprint,
  readCursor,
  signCursor,
} from './transactions.helpers';
const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Lançamento não encontrado.' });
const invalid = (field = 'body') =>
  new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Revise os dados informados.',
    details: [{ field, message: 'Revise o valor informado.' }],
  });
@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}
  async create(userId: string, dto: CreateTransactionDto): Promise<PublicFinancialTransaction> {
    this.coherent(dto.status, dto.actualAmount, dto.paidAt);
    const row = await this.prisma.$transaction(async (tx) => {
      await this.relations(tx, userId, dto.accountId, dto.categoryId, dto.type);
      return tx.financialTransaction.create({
        data: {
          userId,
          accountId: dto.accountId,
          categoryId: dto.categoryId,
          type: dto.type,
          status: dto.status,
          description: dto.description,
          notes: normalizeNotes(dto.notes),
          plannedAmount: new Prisma.Decimal(dto.plannedAmount),
          actualAmount: dto.status === 'PAID' ? new Prisma.Decimal(dto.actualAmount!) : null,
          dueDate: civilDate(dto.dueDate),
          paidAt: dto.status === 'PAID' ? civilDate(dto.paidAt!) : null,
        },
      });
    });
    return publicTransaction(row);
  }
  async get(userId: string, id: string) {
    return publicTransaction(await this.find(userId, id));
  }
  async list(
    userId: string,
    query: TransactionListQuery,
  ): Promise<PaginatedFinancialTransactionsResponse> {
    this.intervals(query);
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    if (!/^\d+$/.test(query.limit ?? '20') || limit < 1 || limit > 100) throw invalid('limit');
    const fingerprint = queryFingerprint(query, limit);
    const cursor = query.cursor
      ? readCursor(query.cursor, this.config.jwtSecret, fingerprint)
      : undefined;
    const dateRange = (from?: string, to?: string) =>
      from || to
        ? { ...(from ? { gte: civilDate(from) } : {}), ...(to ? { lte: civilDate(to) } : {}) }
        : undefined;
    const where: Prisma.FinancialTransactionWhereInput = {
      userId,
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(dateRange(query.dueDateFrom, query.dueDateTo)
        ? { dueDate: dateRange(query.dueDateFrom, query.dueDateTo) }
        : {}),
      ...(dateRange(query.paidAtFrom, query.paidAtTo)
        ? { paidAt: dateRange(query.paidAtFrom, query.paidAtTo) }
        : {}),
      ...(cursor
        ? {
            AND: [
              {
                OR: [
                  { dueDate: { lt: civilDate(cursor.dueDate) } },
                  {
                    dueDate: civilDate(cursor.dueDate),
                    createdAt: { lt: new Date(cursor.createdAt) },
                  },
                  {
                    dueDate: civilDate(cursor.dueDate),
                    createdAt: new Date(cursor.createdAt),
                    id: { gt: cursor.id },
                  },
                ],
              },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.financialTransaction.findMany({
      where,
      orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const more = rows.length > limit;
    const dataRows = rows.slice(0, limit);
    const last = dataRows.at(-1);
    return {
      data: dataRows.map((row) => publicTransaction(row)),
      page: {
        limit,
        nextCursor:
          more && last
            ? signCursor(
                {
                  dueDate: civilString(last.dueDate),
                  createdAt: last.createdAt.toISOString(),
                  id: last.id,
                  fingerprint,
                },
                this.config.jwtSecret,
              )
            : null,
      },
    };
  }
  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    if (!Object.keys(dto).length) throw invalid();
    return this.prisma.$transaction(async (tx) => {
      const row = await this.find(userId, id, tx);
      const financial = ['plannedAmount', 'dueDate', 'accountId', 'categoryId', 'type'].some(
        (key) => key in dto,
      );
      if (row.status === 'PAID' && financial)
        throw new ConflictException({
          code: 'PAID_TRANSACTION_REQUIRES_REOPEN',
          message: 'Reabra o lançamento antes de alterar dados financeiros.',
        });
      const accountId = dto.accountId ?? row.accountId,
        categoryId = dto.categoryId ?? row.categoryId,
        type = dto.type ?? row.type;
      if (financial) await this.relations(tx, userId, accountId, categoryId, type);
      const data: Prisma.FinancialTransactionUpdateInput = {
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.notes !== undefined ? { notes: normalizeNotes(dto.notes) } : {}),
        ...(dto.plannedAmount !== undefined
          ? { plannedAmount: new Prisma.Decimal(dto.plannedAmount) }
          : {}),
        ...(dto.dueDate !== undefined ? { dueDate: civilDate(dto.dueDate) } : {}),
        ...(dto.accountId !== undefined ? { account: { connect: { id: dto.accountId } } } : {}),
        ...(dto.categoryId !== undefined ? { category: { connect: { id: dto.categoryId } } } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
      };
      if (this.same(row, data, dto)) return publicTransaction(row);
      return publicTransaction(
        await tx.financialTransaction.update({ where: { id: row.id }, data }),
      );
    });
  }
  async pay(userId: string, id: string, dto: PayTransactionDto) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.find(userId, id, tx);
        const actualAmount = new Prisma.Decimal(dto.actualAmount);
        const paidAt = civilDate(dto.paidAt);
        const changed = await tx.financialTransaction.updateMany({
          where: { id, userId, status: 'PENDING' },
          data: { status: 'PAID', actualAmount, paidAt },
        });
        const row = await this.find(userId, id, tx);
        if (changed.count) return publicTransaction(row);
        if (row.actualAmount?.equals(actualAmount) && civilString(row.paidAt!) === dto.paidAt)
          return publicTransaction(row);
        throw new ConflictException({
          code: 'TRANSACTION_ALREADY_PAID',
          message: 'O lançamento já foi pago com outros dados.',
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async reopen(userId: string, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.find(userId, id, tx);
        await tx.financialTransaction.updateMany({
          where: { id, userId, status: 'PAID' },
          data: { status: 'PENDING', actualAmount: null, paidAt: null },
        });
        return publicTransaction(await this.find(userId, id, tx));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  private coherent(status: string, amount?: string | null, paidAt?: string | null) {
    if (
      (status === 'PENDING' && (amount != null || paidAt != null)) ||
      (status === 'PAID' && (amount == null || paidAt == null))
    )
      throw invalid('status');
  }
  private intervals(q: TransactionListQuery) {
    for (const key of ['dueDateFrom', 'dueDateTo', 'paidAtFrom', 'paidAtTo'] as const)
      if (q[key] && !isCivilDate(q[key])) throw invalid(key);
    if (q.dueDateFrom && q.dueDateTo && q.dueDateFrom > q.dueDateTo) throw invalid('dueDateFrom');
    if (q.paidAtFrom && q.paidAtTo && q.paidAtFrom > q.paidAtTo) throw invalid('paidAtFrom');
  }
  private async relations(
    tx: Prisma.TransactionClient,
    userId: string,
    accountId: string,
    categoryId: string,
    type: 'INCOME' | 'EXPENSE',
  ) {
    const [account, category] = await Promise.all([
      tx.financialAccount.findFirst({ where: { id: accountId, userId } }),
      tx.financialCategory.findFirst({ where: { id: categoryId, userId } }),
    ]);
    if (!account || !category) throw notFound();
    if (account.archivedAt || category.archivedAt)
      throw new ConflictException({
        code: 'RELATED_RESOURCE_ARCHIVED',
        message: 'Selecione uma conta e categoria ativas.',
      });
    if (category.type !== type)
      throw new ConflictException({
        code: 'CATEGORY_TYPE_MISMATCH',
        message: 'A categoria não corresponde à natureza do lançamento.',
      });
  }
  private async find(
    userId: string,
    id: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<FinancialTransaction> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
      throw notFound();
    const row = await tx.financialTransaction.findFirst({ where: { id, userId } });
    if (!row) throw notFound();
    return row;
  }
  private same(row: FinancialTransaction, _data: unknown, dto: UpdateTransactionDto) {
    return Object.entries(dto).every(([key, value]) =>
      key === 'notes'
        ? row.notes === normalizeNotes(value as string | null)
        : key === 'plannedAmount'
          ? row.plannedAmount.equals(value as string)
          : key === 'dueDate'
            ? civilString(row.dueDate) === value
            : String(row[key as keyof FinancialTransaction] ?? '') === String(value ?? ''),
    );
  }
}
