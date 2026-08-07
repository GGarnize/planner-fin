import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type FinancialCategory } from '@prisma/client';
import type { FinancialCategoryType, PublicFinancialCategory } from '@planner-fin/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto';

const notFound = () =>
  new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Categoria não encontrada.' });
const conflict = (archived = false) =>
  new ConflictException({
    code: 'CATEGORY_NAME_CONFLICT',
    message: archived
      ? 'Já existe uma categoria arquivada com esse nome. Reative-a.'
      : 'Já existe uma categoria com esse nome nesta natureza.',
  });
export const normalizeCategoryName = (name: string): string => name.trim().toLowerCase();
export function publicCategory(row: FinancialCategory): PublicFinancialCategory {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    color: row.color,
    icon: row.icon,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}
  async create(userId: string, dto: CreateCategoryDto): Promise<PublicFinancialCategory> {
    await this.ensureUnique(userId, dto.type, normalizeCategoryName(dto.name));
    try {
      return publicCategory(
        await this.prisma.financialCategory.create({
          data: {
            userId,
            name: dto.name,
            normalizedName: normalizeCategoryName(dto.name),
            type: dto.type,
            color: dto.color ?? null,
            icon: dto.icon ?? null,
          },
        }),
      );
    } catch (error) {
      if (this.unique(error)) throw conflict();
      throw error;
    }
  }
  async list(
    userId: string,
    includeArchived: boolean,
    type?: FinancialCategoryType,
  ): Promise<PublicFinancialCategory[]> {
    const rows = await this.prisma.financialCategory.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { archivedAt: null }),
        ...(type ? { type } : {}),
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(publicCategory);
  }
  async get(userId: string, id: string) {
    return publicCategory(await this.find(userId, id));
  }
  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<PublicFinancialCategory> {
    if (!Object.keys(dto).length)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Revise os dados informados.',
        details: [{ field: 'body', message: 'Informe ao menos um campo.' }],
      });
    const row = await this.find(userId, id);
    if (row.archivedAt)
      throw new ConflictException({
        code: 'CATEGORY_ARCHIVED',
        message: 'Reative a categoria antes de editar.',
      });
    if (dto.name !== undefined)
      await this.ensureUnique(userId, row.type, normalizeCategoryName(dto.name), row.id);
    const data: Prisma.FinancialCategoryUpdateInput = {
      ...(dto.name === undefined
        ? {}
        : { name: dto.name, normalizedName: normalizeCategoryName(dto.name) }),
      ...(dto.color === undefined ? {} : { color: dto.color }),
      ...(dto.icon === undefined ? {} : { icon: dto.icon }),
    };
    try {
      return publicCategory(
        await this.prisma.financialCategory.update({ where: { id: row.id }, data }),
      );
    } catch (error) {
      if (this.unique(error)) throw conflict();
      throw error;
    }
  }
  async archive(userId: string, id: string) {
    const row = await this.find(userId, id);
    return row.archivedAt
      ? publicCategory(row)
      : publicCategory(
          await this.prisma.financialCategory.update({
            where: { id: row.id },
            data: { archivedAt: new Date() },
          }),
        );
  }
  async restore(userId: string, id: string) {
    const row = await this.find(userId, id);
    return !row.archivedAt
      ? publicCategory(row)
      : publicCategory(
          await this.prisma.financialCategory.update({
            where: { id: row.id },
            data: { archivedAt: null },
          }),
        );
  }
  private async ensureUnique(
    userId: string,
    type: FinancialCategoryType,
    normalizedName: string,
    exceptId?: string,
  ) {
    const existing = await this.prisma.financialCategory.findFirst({
      where: { userId, type, normalizedName, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (existing) throw conflict(Boolean(existing.archivedAt));
  }
  private unique(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
  private async find(userId: string, id: string): Promise<FinancialCategory> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
      throw notFound();
    const row = await this.prisma.financialCategory.findFirst({ where: { id, userId } });
    if (!row) throw notFound();
    return row;
  }
}
