import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type FinancialTransfer } from '@prisma/client';
import type {
  PaginatedFinancialTransfersResponse,
  PublicFinancialTransfer,
  TransferListQuery,
} from '@planner-fin/shared';
import { API_CONFIG } from '../auth/auth.types';
import type { ApiConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  isCivilDate,
  type CreateTransferDto,
  type CompleteTransferDto,
  type UpdateTransferDto,
} from './dto';
import {
  civilDate,
  civilString,
  normalizeNotes,
  publicTransfer,
  queryFingerprint,
  readCursor,
  signCursor,
} from './transfers.helpers';
const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Transferência não encontrada.' });
const invalid = (field = 'body') =>
  new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Revise os dados informados.',
    details: [{ field, message: 'Revise o valor informado.' }],
  });
@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}
  async create(userId: string, dto: CreateTransferDto): Promise<PublicFinancialTransfer> {
    this.coherent(dto.status, dto.actualAmount, dto.completedAt);
    const row = await this.prisma.$transaction(
      async (tx) => {
        await this.relations(tx, userId, dto.sourceAccountId, dto.destinationAccountId);
        return tx.financialTransfer.create({
          data: {
            userId,
            sourceAccountId: dto.sourceAccountId,
            destinationAccountId: dto.destinationAccountId,
            status: dto.status,
            description: dto.description,
            notes: normalizeNotes(dto.notes),
            plannedAmount: new Prisma.Decimal(dto.plannedAmount),
            actualAmount: dto.status === 'COMPLETED' ? new Prisma.Decimal(dto.actualAmount!) : null,
            dueDate: civilDate(dto.dueDate),
            completedAt: dto.status === 'COMPLETED' ? civilDate(dto.completedAt!) : null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return publicTransfer(row);
  }
  async get(userId: string, id: string) {
    return publicTransfer(await this.find(userId, id));
  }
  async list(
    userId: string,
    query: TransferListQuery,
  ): Promise<PaginatedFinancialTransfersResponse> {
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
    const where: Prisma.FinancialTransferWhereInput = {
      userId,
      ...(query.sourceAccountId ? { sourceAccountId: query.sourceAccountId } : {}),
      ...(query.destinationAccountId ? { destinationAccountId: query.destinationAccountId } : {}),
      ...(query.accountId
        ? { OR: [{ sourceAccountId: query.accountId }, { destinationAccountId: query.accountId }] }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(dateRange(query.dueDateFrom, query.dueDateTo)
        ? { dueDate: dateRange(query.dueDateFrom, query.dueDateTo) }
        : {}),
      ...(dateRange(query.completedAtFrom, query.completedAtTo)
        ? { completedAt: dateRange(query.completedAtFrom, query.completedAtTo) }
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
    const rows = await this.prisma.financialTransfer.findMany({
      where,
      orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const more = rows.length > limit;
    const dataRows = rows.slice(0, limit);
    const last = dataRows.at(-1);
    return {
      data: dataRows.map((row) => publicTransfer(row)),
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
  async update(userId: string, id: string, dto: UpdateTransferDto) {
    if (!Object.keys(dto).length) throw invalid();
    return this.prisma.$transaction(
      async (tx) => {
        const row = await this.find(userId, id, tx);
        const financial = [
          'plannedAmount',
          'dueDate',
          'sourceAccountId',
          'destinationAccountId',
        ].some((key) => key in dto);
        if (row.status === 'COMPLETED' && financial)
          throw new ConflictException({
            code: 'COMPLETED_TRANSFER_REQUIRES_REOPEN',
            message: 'Reabra a transferência antes de alterar dados financeiros.',
          });
        const sourceAccountId = dto.sourceAccountId ?? row.sourceAccountId,
          destinationAccountId = dto.destinationAccountId ?? row.destinationAccountId;
        if (financial) await this.relations(tx, userId, sourceAccountId, destinationAccountId);
        const data: Prisma.FinancialTransferUpdateManyMutationInput = {
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.notes !== undefined ? { notes: normalizeNotes(dto.notes) } : {}),
          ...(dto.plannedAmount !== undefined
            ? { plannedAmount: new Prisma.Decimal(dto.plannedAmount) }
            : {}),
          ...(dto.dueDate !== undefined ? { dueDate: civilDate(dto.dueDate) } : {}),
          ...(dto.sourceAccountId !== undefined ? { sourceAccountId: dto.sourceAccountId } : {}),
          ...(dto.destinationAccountId !== undefined
            ? { destinationAccountId: dto.destinationAccountId }
            : {}),
        };
        if (this.same(row, data, dto)) return publicTransfer(row);
        const changed = await tx.financialTransfer.updateMany({
          where: { id: row.id, userId, status: row.status, updatedAt: row.updatedAt },
          data,
        });
        if (!changed.count)
          throw new ConflictException({
            code: 'CONCURRENT_MODIFICATION',
            message: 'A transferência foi alterada. Recarregue e tente novamente.',
          });
        return publicTransfer(await this.find(userId, id, tx));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async complete(userId: string, id: string, dto: CompleteTransferDto) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.find(userId, id, tx);
        const actualAmount = new Prisma.Decimal(dto.actualAmount);
        const completedAt = civilDate(dto.completedAt);
        const changed = await tx.financialTransfer.updateMany({
          where: { id, userId, status: 'PENDING' },
          data: { status: 'COMPLETED', actualAmount, completedAt },
        });
        const row = await this.find(userId, id, tx);
        if (changed.count) return publicTransfer(row);
        if (
          row.actualAmount?.equals(actualAmount) &&
          civilString(row.completedAt!) === dto.completedAt
        )
          return publicTransfer(row);
        throw new ConflictException({
          code: 'TRANSFER_ALREADY_COMPLETED',
          message: 'A transferência já foi concluída com outros dados.',
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async reopen(userId: string, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.find(userId, id, tx);
        await tx.financialTransfer.updateMany({
          where: { id, userId, status: 'COMPLETED' },
          data: { status: 'PENDING', actualAmount: null, completedAt: null },
        });
        return publicTransfer(await this.find(userId, id, tx));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  private coherent(status: string, amount?: string | null, completedAt?: string | null) {
    if (
      (status === 'PENDING' && (amount != null || completedAt != null)) ||
      (status === 'COMPLETED' && (amount == null || completedAt == null))
    )
      throw invalid('status');
  }
  private intervals(q: TransferListQuery) {
    for (const key of ['dueDateFrom', 'dueDateTo', 'completedAtFrom', 'completedAtTo'] as const)
      if (q[key] && !isCivilDate(q[key])) throw invalid(key);
    if (q.dueDateFrom && q.dueDateTo && q.dueDateFrom > q.dueDateTo) throw invalid('dueDateFrom');
    if (q.completedAtFrom && q.completedAtTo && q.completedAtFrom > q.completedAtTo)
      throw invalid('completedAtFrom');
  }
  private async relations(
    tx: Prisma.TransactionClient,
    userId: string,
    sourceAccountId: string,
    destinationAccountId: string,
  ) {
    if (sourceAccountId === destinationAccountId) throw invalid('destinationAccountId');
    const [source, destination] = await Promise.all([
      tx.financialAccount.findFirst({ where: { id: sourceAccountId, userId } }),
      tx.financialAccount.findFirst({ where: { id: destinationAccountId, userId } }),
    ]);
    if (!source || !destination) throw notFound();
    if (source.archivedAt || destination.archivedAt)
      throw new ConflictException({
        code: 'RELATED_ACCOUNT_ARCHIVED',
        message: 'Selecione contas ativas.',
      });
  }
  private async find(
    userId: string,
    id: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<FinancialTransfer> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
      throw notFound();
    const row = await tx.financialTransfer.findFirst({ where: { id, userId } });
    if (!row) throw notFound();
    return row;
  }
  private same(row: FinancialTransfer, _data: unknown, dto: UpdateTransferDto) {
    return Object.entries(dto).every(([key, value]) =>
      key === 'notes'
        ? row.notes === normalizeNotes(value as string | null)
        : key === 'plannedAmount'
          ? row.plannedAmount.equals(value as string)
          : key === 'dueDate'
            ? civilString(row.dueDate) === value
            : String(row[key as keyof FinancialTransfer] ?? '') === String(value ?? ''),
    );
  }
}
