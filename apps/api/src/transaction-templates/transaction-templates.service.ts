import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type TransactionTemplate } from '@prisma/client';
import type { PublicTransactionTemplate, TransactionTemplateType } from '@planner-fin/shared';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeNotes } from '../transactions/transactions.helpers';
import type { CreateTransactionTemplateDto, UpdateTransactionTemplateDto } from './dto';

type TemplateWithRefs = TransactionTemplate & {
  category: { archivedAt: Date | null };
  defaultAccount: { archivedAt: Date | null } | null;
};
const include = {
  category: { select: { archivedAt: true } },
  defaultAccount: { select: { archivedAt: true } },
} as const;
const notFound = () =>
  new NotFoundException({
    code: 'TEMPLATE_NOT_FOUND',
    message: 'Modelo de lançamento não encontrado.',
  });
const relatedNotFound = () =>
  new NotFoundException({
    code: 'RELATED_RESOURCE_NOT_FOUND',
    message: 'Recurso relacionado não encontrado.',
  });
const normalize = (name: string) => name.trim().toLowerCase();
const conflict = () =>
  new ConflictException({
    code: 'TEMPLATE_NAME_CONFLICT',
    message: 'Já existe um modelo com esse nome.',
  });
function projection(row: TemplateWithRefs): PublicTransactionTemplate {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    categoryId: row.categoryId,
    categoryAvailable: !row.category.archivedAt,
    description: row.description,
    plannedAmount: row.plannedAmount.toFixed(2),
    defaultAccountId: row.defaultAccountId,
    defaultAccountAvailable: Boolean(row.defaultAccount && !row.defaultAccount.archivedAt),
    notes: row.notes,
    dueDay: row.dueDay,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
@Injectable()
export class TransactionTemplatesService {
  constructor(private readonly prisma: PrismaService) {}
  async create(userId: string, dto: CreateTransactionTemplateDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.relations(tx, userId, dto.categoryId, dto.type, dto.defaultAccountId ?? null);
      try {
        return projection(
          await tx.transactionTemplate.create({
            data: {
              userId,
              name: dto.name,
              normalizedName: normalize(dto.name),
              type: dto.type,
              categoryId: dto.categoryId,
              description: dto.description,
              plannedAmount: new Prisma.Decimal(dto.plannedAmount),
              defaultAccountId: dto.defaultAccountId ?? null,
              notes: normalizeNotes(dto.notes),
              dueDay: dto.dueDay ?? null,
            },
            include,
          }),
        );
      } catch (e) {
        if (this.unique(e)) throw conflict();
        throw e;
      }
    });
  }
  async list(userId: string, includeArchived: boolean, type?: TransactionTemplateType, q?: string) {
    const rows = await this.prisma.transactionTemplate.findMany({
      where: {
        userId,
        ...(!includeArchived ? { archivedAt: null } : {}),
        ...(type ? { type } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
      include,
    });
    return rows.map(projection);
  }
  async get(userId: string, id: string) {
    return projection(await this.find(userId, id));
  }
  async update(userId: string, id: string, dto: UpdateTransactionTemplateDto) {
    if (!Object.keys(dto).length)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Informe ao menos um campo.',
      });
    return this.prisma.$transaction(async (tx) => {
      const row = await this.find(userId, id, tx);
      if (row.archivedAt)
        throw new ConflictException({
          code: 'TEMPLATE_ARCHIVED',
          message: 'Restaure o modelo antes de editar.',
        });
      const type = dto.type ?? row.type,
        categoryId = dto.categoryId ?? row.categoryId,
        accountId =
          dto.defaultAccountId === undefined ? row.defaultAccountId : dto.defaultAccountId;
      await this.relations(tx, userId, categoryId, type, accountId);
      const desired = {
        name: dto.name ?? row.name,
        normalizedName: normalize(dto.name ?? row.name),
        type,
        categoryId,
        description: dto.description ?? row.description,
        plannedAmount:
          dto.plannedAmount === undefined
            ? row.plannedAmount
            : new Prisma.Decimal(dto.plannedAmount),
        defaultAccountId: accountId,
        notes: dto.notes === undefined ? row.notes : normalizeNotes(dto.notes),
        dueDay: dto.dueDay === undefined ? row.dueDay : dto.dueDay,
      };
      if (
        row.name === desired.name &&
        row.normalizedName === desired.normalizedName &&
        row.type === desired.type &&
        row.categoryId === desired.categoryId &&
        row.description === desired.description &&
        row.plannedAmount.equals(desired.plannedAmount) &&
        row.defaultAccountId === desired.defaultAccountId &&
        row.notes === desired.notes &&
        row.dueDay === desired.dueDay
      )
        return projection(row);
      try {
        return projection(
          await tx.transactionTemplate.update({ where: { id: row.id }, data: desired, include }),
        );
      } catch (e) {
        if (this.unique(e)) throw conflict();
        throw e;
      }
    });
  }
  async archive(userId: string, id: string) {
    const row = await this.find(userId, id);
    return row.archivedAt
      ? projection(row)
      : projection(
          await this.prisma.transactionTemplate.update({
            where: { id: row.id },
            data: { archivedAt: new Date() },
            include,
          }),
        );
  }
  async restore(userId: string, id: string) {
    const row = await this.find(userId, id);
    return !row.archivedAt
      ? projection(row)
      : projection(
          await this.prisma.transactionTemplate.update({
            where: { id: row.id },
            data: { archivedAt: null },
            include,
          }),
        );
  }
  private async relations(
    tx: Prisma.TransactionClient,
    userId: string,
    categoryId: string,
    type: TransactionTemplateType,
    accountId: string | null,
  ) {
    const [category, account] = await Promise.all([
      tx.financialCategory.findFirst({ where: { id: categoryId, userId } }),
      accountId ? tx.financialAccount.findFirst({ where: { id: accountId, userId } }) : null,
    ]);
    if (!category || (accountId && !account)) throw relatedNotFound();
    if (category.archivedAt || account?.archivedAt)
      throw new ConflictException({
        code: 'RELATED_RESOURCE_ARCHIVED',
        message: 'Selecione referências ativas.',
      });
    if (category.type !== type)
      throw new ConflictException({
        code: 'CATEGORY_TYPE_MISMATCH',
        message: 'A categoria não corresponde à natureza do modelo.',
      });
  }
  private async find(
    userId: string,
    id: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<TemplateWithRefs> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
      throw notFound();
    const row = await tx.transactionTemplate.findFirst({ where: { id, userId }, include });
    if (!row) throw notFound();
    return row;
  }
  private unique(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
      return false;
    const target = error.meta?.target;
    return (
      target === 'TransactionTemplate_userId_normalizedName_key' ||
      (Array.isArray(target) &&
        target.includes('userId') &&
        target.includes('normalizedName') &&
        target.length === 2)
    );
  }
}
