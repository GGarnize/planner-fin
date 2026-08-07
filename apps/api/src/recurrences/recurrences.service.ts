import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type RecurrenceRule } from '@prisma/client';
import type {
  GenerateRecurrenceResponse,
  PublicRecurrence,
  RecurrenceListQuery,
} from '@planner-fin/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  civil,
  civilText,
  cursorFor,
  nextAfter,
  todayCivil,
  type Calendar,
} from './calendar';
import type { CreateRecurrenceDto, UpdateRecurrenceDto } from './dto';
const missing = () =>
  new NotFoundException({ code: 'RECURRENCE_NOT_FOUND', message: 'Recorrência não encontrada.' });
const invalid = (field = 'body') =>
  new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Revise os dados informados.',
    details: [{ field, message: 'Revise o valor informado.' }],
  });
const archived = () =>
  new ConflictException({ code: 'RECURRENCE_ARCHIVED', message: 'A recorrência está arquivada.' });
type Tx = Prisma.TransactionClient;
const normalizeNotes = (value?: string | null) => value?.trim() || null;
@Injectable()
export class RecurrencesService {
  constructor(private readonly prisma: PrismaService) {}
  private public(row: RecurrenceRule): PublicRecurrence {
    const base = {
      id: row.id,
      kind: row.kind,
      status: row.status,
      frequency: row.frequency,
      startDate: civilText(row.startDate),
      endDate: row.endDate ? civilText(row.endDate) : null,
      plannedAmount: row.plannedAmount.toFixed(2),
      description: row.description,
      notes: row.notes,
      nextOccurrenceDate: row.nextOccurrenceDate ? civilText(row.nextOccurrenceDate) : null,
      attentionStatus: row.attentionStatus,
      blockedReason: row.blockedReason,
      blockedResourceType: row.blockedResourceType,
      blockedResourceId: row.blockedResourceId,
      blockedAt: row.blockedAt?.toISOString() ?? null,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
    const calendar =
      row.frequency === 'WEEKLY'
        ? { dayOfWeek: row.dayOfWeek! }
        : row.frequency === 'MONTHLY'
          ? { dayOfMonth: row.dayOfMonth! }
          : { dayOfMonth: row.dayOfMonth!, monthOfYear: row.monthOfYear! };
    const template =
      row.kind === 'TRANSACTION'
        ? {
            transactionType: row.transactionType!,
            accountId: row.accountId!,
            categoryId: row.categoryId!,
          }
        : {
            sourceAccountId: row.sourceAccountId!,
            destinationAccountId: row.destinationAccountId!,
          };
    return { ...base, ...calendar, ...template } as PublicRecurrence;
  }
  private calendar(row: {
    frequency: string;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    monthOfYear?: number | null;
  }): Calendar {
    return row as Calendar;
  }
  private validateShape(data: CreateRecurrenceDto): void {
    if (data.endDate && data.endDate < data.startDate) throw invalid('endDate');
    const keys = (['dayOfWeek', 'dayOfMonth', 'monthOfYear'] as const).filter(
      (k) => data[k] !== undefined,
    );
    const expected =
      data.frequency === 'WEEKLY'
        ? ['dayOfWeek']
        : data.frequency === 'MONTHLY'
          ? ['dayOfMonth']
          : ['dayOfMonth', 'monthOfYear'];
    if (keys.sort().join() !== expected.sort().join()) throw invalid('frequency');
    if (data.frequency === 'YEARLY') {
      const d = data.dayOfMonth!,
        m = data.monthOfYear!;
      if (d > new Date(Date.UTC(2024, m, 0)).getUTCDate()) throw invalid('dayOfMonth');
    }
    const transactionFields = ['transactionType', 'accountId', 'categoryId'] as const;
    const transferFields = ['sourceAccountId', 'destinationAccountId'] as const;
    if (
      data.kind === 'TRANSACTION' &&
      (transactionFields.some((k) => !data[k]) || transferFields.some((k) => data[k] !== undefined))
    )
      throw invalid('kind');
    if (
      data.kind === 'TRANSFER' &&
      (transferFields.some((k) => !data[k]) || transactionFields.some((k) => data[k] !== undefined))
    )
      throw invalid('kind');
    if (data.kind === 'TRANSFER' && data.sourceAccountId === data.destinationAccountId)
      throw invalid('destinationAccountId');
  }
  private async references(tx: Tx, userId: string, data: CreateRecurrenceDto): Promise<void> {
    if (data.kind === 'TRANSACTION') {
      const [account, category] = await Promise.all([
        tx.financialAccount.findFirst({ where: { id: data.accountId, userId } }),
        tx.financialCategory.findFirst({ where: { id: data.categoryId, userId } }),
      ]);
      if (!account || !category)
        throw new NotFoundException({
          code: 'RELATED_RESOURCE_NOT_FOUND',
          message: 'Recurso relacionado não encontrado.',
        });
      if (account.archivedAt || category.archivedAt)
        throw new ConflictException({
          code: 'RELATED_RESOURCE_ARCHIVED',
          message: 'Selecione recursos ativos.',
        });
      if (category.type !== data.transactionType)
        throw new ConflictException({
          code: 'CATEGORY_TYPE_MISMATCH',
          message: 'A categoria não corresponde ao tipo.',
        });
    } else {
      const accounts = await tx.financialAccount.findMany({
        where: { id: { in: [data.sourceAccountId!, data.destinationAccountId!] }, userId },
        orderBy: { id: 'asc' },
      });
      if (accounts.length !== 2)
        throw new NotFoundException({
          code: 'RELATED_RESOURCE_NOT_FOUND',
          message: 'Recurso relacionado não encontrado.',
        });
      if (accounts.some((a) => a.archivedAt))
        throw new ConflictException({
          code: 'RELATED_RESOURCE_ARCHIVED',
          message: 'Selecione recursos ativos.',
        });
    }
  }
  private createData(
    userId: string,
    d: CreateRecurrenceDto,
    next: string | null,
  ): Prisma.RecurrenceRuleUncheckedCreateInput {
    return {
      userId,
      kind: d.kind,
      frequency: d.frequency,
      startDate: civil(d.startDate),
      endDate: d.endDate ? civil(d.endDate) : null,
      dayOfWeek: d.frequency === 'WEEKLY' ? d.dayOfWeek : null,
      dayOfMonth: d.frequency === 'WEEKLY' ? null : d.dayOfMonth,
      monthOfYear: d.frequency === 'YEARLY' ? d.monthOfYear : null,
      transactionType: d.kind === 'TRANSACTION' ? d.transactionType : null,
      accountId: d.kind === 'TRANSACTION' ? d.accountId : null,
      categoryId: d.kind === 'TRANSACTION' ? d.categoryId : null,
      sourceAccountId: d.kind === 'TRANSFER' ? d.sourceAccountId : null,
      destinationAccountId: d.kind === 'TRANSFER' ? d.destinationAccountId : null,
      plannedAmount: new Prisma.Decimal(d.plannedAmount),
      description: d.description,
      notes: normalizeNotes(d.notes),
      nextOccurrenceDate: next ? civil(next) : null,
    };
  }
  async create(userId: string, dto: CreateRecurrenceDto): Promise<PublicRecurrence> {
    this.validateShape(dto);
    const today = todayCivil();
    return this.prisma.$transaction(async (tx) => {
      await this.references(tx, userId, dto);
      const next = cursorFor(
        { ...this.calendar(dto), startDate: dto.startDate, endDate: dto.endDate },
        today,
      );
      return this.public(
        await tx.recurrenceRule.create({ data: this.createData(userId, dto, next) }),
      );
    });
  }
  async list(userId: string, q: RecurrenceListQuery): Promise<PublicRecurrence[]> {
    const rows = await this.prisma.recurrenceRule.findMany({
      where: {
        userId,
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.frequency ? { frequency: q.frequency } : {}),
        ...(q.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: [
        { archivedAt: 'asc' },
        { nextOccurrenceDate: 'asc' },
        { createdAt: 'desc' },
        { id: 'asc' },
      ],
    });
    return rows.map((r) => this.public(r));
  }
  async get(userId: string, id: string) {
    return this.public(await this.find(this.prisma, userId, id));
  }
  private async find(tx: Tx | PrismaService, userId: string, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw missing();
    const row = await tx.recurrenceRule.findFirst({ where: { id, userId } });
    if (!row) throw missing();
    return row;
  }
  private async lock(tx: Tx, userId: string, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "RecurrenceRule" WHERE "id"=${id}::uuid AND "userId"=${userId}::uuid FOR UPDATE`;
    return this.find(tx, userId, id);
  }
  private complete(row: RecurrenceRule, dto: UpdateRecurrenceDto): CreateRecurrenceDto {
    return {
      kind: row.kind,
      frequency: dto.frequency ?? row.frequency,
      startDate: dto.startDate ?? civilText(row.startDate),
      endDate:
        dto.endDate === undefined ? (row.endDate ? civilText(row.endDate) : null) : dto.endDate,
      dayOfWeek: dto.dayOfWeek ?? row.dayOfWeek ?? undefined,
      dayOfMonth: dto.dayOfMonth ?? row.dayOfMonth ?? undefined,
      monthOfYear: dto.monthOfYear ?? row.monthOfYear ?? undefined,
      transactionType: dto.transactionType ?? row.transactionType ?? undefined,
      accountId: dto.accountId ?? row.accountId ?? undefined,
      categoryId: dto.categoryId ?? row.categoryId ?? undefined,
      sourceAccountId: dto.sourceAccountId ?? row.sourceAccountId ?? undefined,
      destinationAccountId: dto.destinationAccountId ?? row.destinationAccountId ?? undefined,
      plannedAmount: dto.plannedAmount ?? row.plannedAmount.toFixed(2),
      description: dto.description ?? row.description,
      notes: dto.notes === undefined ? row.notes : dto.notes,
    };
  }
  async update(userId: string, id: string, dto: UpdateRecurrenceDto) {
    if (!Object.keys(dto).length) throw invalid();
    return this.prisma.$transaction(async (tx) => {
      const row = await this.lock(tx, userId, id);
      if (row.archivedAt) throw archived();
      const data = this.complete(row, dto);
      if (dto.frequency) {
        if (dto.frequency === 'WEEKLY') {
          data.dayOfMonth = undefined;
          data.monthOfYear = undefined;
        } else {
          data.dayOfWeek = undefined;
          if (dto.frequency === 'MONTHLY') data.monthOfYear = undefined;
        }
      }
      this.validateShape(data);
      await this.references(tx, userId, data);
      const latest = await this.latest(tx, row);
      const next = cursorFor(
        { ...this.calendar(data), startDate: data.startDate, endDate: data.endDate },
        todayCivil(),
        latest,
      );
      const canonical = this.createData(userId, data, next);
      const changed = Object.entries(dto).some(
        ([k, v]) =>
          String((row as unknown as Record<string, unknown>)[k] ?? '') !== String(v ?? ''),
      );
      if (!changed && row.attentionStatus === 'READY') return this.public(row);
      return this.public(
        await tx.recurrenceRule.update({
          where: { id },
          data: {
            ...canonical,
            userId: undefined,
            kind: undefined,
            attentionStatus: 'READY',
            blockedReason: null,
            blockedResourceType: null,
            blockedResourceId: null,
            blockedAt: null,
          },
        }),
      );
    });
  }
  private async latest(tx: Tx, row: RecurrenceRule) {
    const record =
      row.kind === 'TRANSACTION'
        ? await tx.financialTransaction.findFirst({
            where: { recurrenceRuleId: row.id },
            orderBy: { occurrenceDate: 'desc' },
          })
        : await tx.financialTransfer.findFirst({
            where: { recurrenceRuleId: row.id },
            orderBy: { occurrenceDate: 'desc' },
          });
    return record?.occurrenceDate ? civilText(record.occurrenceDate) : null;
  }
  async pause(userId: string, id: string) {
    return this.transition(userId, id, 'pause');
  }
  async resume(userId: string, id: string) {
    return this.transition(userId, id, 'resume');
  }
  async archive(userId: string, id: string) {
    return this.transition(userId, id, 'archive');
  }
  private async transition(userId: string, id: string, action: 'pause' | 'resume' | 'archive') {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.lock(tx, userId, id);
      if (action === 'archive') {
        if (row.archivedAt) return this.public(row);
        return this.public(
          await tx.recurrenceRule.update({ where: { id }, data: { archivedAt: new Date() } }),
        );
      }
      if (row.archivedAt) throw archived();
      if (action === 'pause') {
        if (row.status === 'PAUSED') return this.public(row);
        return this.public(
          await tx.recurrenceRule.update({ where: { id }, data: { status: 'PAUSED' } }),
        );
      }
      if (row.attentionStatus === 'BLOCKED')
        throw new ConflictException({
          code: 'RECURRENCE_BLOCKED',
          message: 'Corrija o recurso arquivado antes de retomar.',
        });
      const latest = await this.latest(tx, row),
        next = cursorFor(
          {
            ...this.calendar(row),
            startDate: civilText(row.startDate),
            endDate: row.endDate ? civilText(row.endDate) : null,
          },
          todayCivil(),
          latest,
        );
      if (row.status === 'ACTIVE' && civilText(row.nextOccurrenceDate!) === next)
        return this.public(row);
      return this.public(
        await tx.recurrenceRule.update({
          where: { id },
          data: { status: 'ACTIVE', nextOccurrenceDate: next ? civil(next) : null },
        }),
      );
    });
  }
  async generate(userId: string, id: string): Promise<GenerateRecurrenceResponse> {
    const today = todayCivil(),
      through = addDays(today, 60);
    return this.prisma.$transaction(
      async (tx) => {
        let row = await this.lock(tx, userId, id);
        if (row.archivedAt || row.status === 'PAUSED')
          return {
            generatedCount: 0,
            throughDate: through,
            nextOccurrenceDate: row.nextOccurrenceDate ? civilText(row.nextOccurrenceDate) : null,
          };
        if (row.attentionStatus === 'BLOCKED')
          throw new ConflictException({
            code: 'RECURRENCE_BLOCKED',
            message: 'A recorrência está bloqueada.',
          });
        const data = this.complete(row, {});
        try {
          await this.references(tx, userId, data);
        } catch (error) {
          if (error instanceof ConflictException) {
            const resource =
              row.kind === 'TRANSACTION'
                ? (await tx.financialAccount.findUnique({ where: { id: row.accountId! } }))
                    ?.archivedAt
                  ? { type: 'ACCOUNT' as const, id: row.accountId! }
                  : { type: 'CATEGORY' as const, id: row.categoryId! }
                : { type: 'ACCOUNT' as const, id: row.sourceAccountId! };
            await tx.recurrenceRule.update({
              where: { id },
              data: {
                attentionStatus: 'BLOCKED',
                blockedReason: 'RELATED_RESOURCE_ARCHIVED',
                blockedResourceType: resource.type,
                blockedResourceId: resource.id,
                blockedAt: new Date(),
              },
            });
            return {
              generatedCount: 0,
              throughDate: through,
              nextOccurrenceDate: row.nextOccurrenceDate ? civilText(row.nextOccurrenceDate) : null,
            };
          }
          throw error;
        }
        let count = 0,
          next = row.nextOccurrenceDate ? civilText(row.nextOccurrenceDate) : null;
        while (next && next <= through && (!row.endDate || next <= civilText(row.endDate))) {
          const date = civil(next);
          if (row.kind === 'TRANSACTION')
            await tx.financialTransaction.upsert({
              where: {
                recurrenceRuleId_occurrenceDate: { recurrenceRuleId: id, occurrenceDate: date },
              },
              update: {},
              create: {
                userId,
                accountId: row.accountId!,
                categoryId: row.categoryId!,
                type: row.transactionType!,
                status: 'PENDING',
                description: row.description,
                notes: row.notes,
                plannedAmount: row.plannedAmount,
                actualAmount: null,
                dueDate: date,
                paidAt: null,
                recurrenceRuleId: id,
                occurrenceDate: date,
              },
            });
          else
            await tx.financialTransfer.upsert({
              where: {
                recurrenceRuleId_occurrenceDate: { recurrenceRuleId: id, occurrenceDate: date },
              },
              update: {},
              create: {
                userId,
                sourceAccountId: row.sourceAccountId!,
                destinationAccountId: row.destinationAccountId!,
                status: 'PENDING',
                description: row.description,
                notes: row.notes,
                plannedAmount: row.plannedAmount,
                actualAmount: null,
                dueDate: date,
                completedAt: null,
                recurrenceRuleId: id,
                occurrenceDate: date,
              },
            });
          count++;
          next = nextAfter(this.calendar(row), next);
          if (row.endDate && next > civilText(row.endDate)) next = null;
        }
        row = await tx.recurrenceRule.update({
          where: { id },
          data: { nextOccurrenceDate: next ? civil(next) : null },
        });
        return {
          generatedCount: count,
          throughDate: through,
          nextOccurrenceDate: row.nextOccurrenceDate ? civilText(row.nextOccurrenceDate) : null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
