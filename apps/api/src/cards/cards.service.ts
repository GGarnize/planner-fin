import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type FinancialCreditCard } from '@prisma/client';
import type { PublicFinancialCreditCard } from '@planner-fin/shared';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeOptional } from './card-finance';
import type { CreateCardDto, UpdateCardDto } from './dto';
const missing = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Cartão não encontrado.' });
export const publicCard = (x: FinancialCreditCard): PublicFinancialCreditCard => ({
  id: x.id,
  name: x.name,
  issuer: x.issuer,
  last4: x.last4,
  creditLimit: x.creditLimit?.toFixed(2) ?? null,
  closingDay: x.closingDay,
  dueDay: x.dueDay,
  archivedAt: x.archivedAt?.toISOString() ?? null,
  createdAt: x.createdAt.toISOString(),
  updatedAt: x.updatedAt.toISOString(),
});
@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(userId: string, dto: CreateCardDto) {
    return publicCard(
      await this.prisma.financialCreditCard.create({
        data: {
          ...dto,
          userId,
          issuer: normalizeOptional(dto.issuer),
          last4: dto.last4 || null,
          creditLimit: dto.creditLimit ? new Prisma.Decimal(dto.creditLimit) : null,
        },
      }),
    );
  }
  async list(userId: string, includeArchived: boolean) {
    return {
      items: (
        await this.prisma.financialCreditCard.findMany({
          where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        })
      ).map(publicCard),
    };
  }
  async get(userId: string, id: string) {
    return publicCard(await this.find(userId, id));
  }
  async update(userId: string, id: string, dto: UpdateCardDto) {
    if (!Object.keys(dto).length)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Informe ao menos um campo.',
      });
    const card = await this.find(userId, id);
    const data: Prisma.FinancialCreditCardUpdateInput = {
      ...dto,
      issuer: dto.issuer === undefined ? undefined : normalizeOptional(dto.issuer),
      last4: dto.last4 === undefined ? undefined : dto.last4 || null,
      creditLimit:
        dto.creditLimit === undefined
          ? undefined
          : dto.creditLimit
            ? new Prisma.Decimal(dto.creditLimit)
            : null,
    };
    return publicCard(
      await this.prisma.financialCreditCard.update({ where: { id: card.id }, data }),
    );
  }
  async archive(userId: string, id: string) {
    const x = await this.find(userId, id);
    return x.archivedAt
      ? publicCard(x)
      : publicCard(
          await this.prisma.financialCreditCard.update({
            where: { id: x.id },
            data: { archivedAt: new Date() },
          }),
        );
  }
  async restore(userId: string, id: string) {
    const x = await this.find(userId, id);
    return !x.archivedAt
      ? publicCard(x)
      : publicCard(
          await this.prisma.financialCreditCard.update({
            where: { id: x.id },
            data: { archivedAt: null },
          }),
        );
  }
  private async find(userId: string, id: string) {
    const x = await this.prisma.financialCreditCard.findFirst({ where: { id, userId } });
    if (!x) throw missing();
    return x;
  }
}
