import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CardPurchaseListQuery,
  PaginatedCardPurchasesResponse,
  PublicCardPurchase,
} from '@planner-fin/shared';
import { API_CONFIG } from '../auth/auth.types';
import type { ApiConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  addMonths,
  civilDate,
  civilString,
  initialCycle,
  invoiceDates,
  normalizeOptional,
  splitInstallments,
} from '../cards/card-finance';
import type { CreateCardPurchaseDto, UpdateCardPurchaseDto } from './dto';
const missing = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Compra não encontrada.' });
const invalid = (field = 'body') =>
  new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Revise os dados informados.',
    details: [{ field, message: 'Valor inválido.' }],
  });
type Tx = Prisma.TransactionClient;
type PurchaseWithInstallments = Prisma.CardPurchaseGetPayload<{
  include: { installments: true };
}>;
@Injectable()
export class CardPurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(API_CONFIG) private readonly _config: ApiConfig,
  ) {}
  async create(userId: string, dto: CreateCardPurchaseDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const { card } = await this.relations(tx, userId, dto.cardId, dto.categoryId);
        const amounts = this.amounts(dto.totalAmount, dto.installmentCount);
        const start = await this.openCycle(
          tx,
          userId,
          card.id,
          initialCycle(dto.purchaseDate, card.closingDay),
          card.closingDay,
          card.dueDay,
        );
        const purchase = await tx.cardPurchase.create({
          data: {
            userId,
            cardId: card.id,
            categoryId: dto.categoryId,
            description: dto.description,
            notes: normalizeOptional(dto.notes),
            purchaseDate: civilDate(dto.purchaseDate),
            totalAmount: new Prisma.Decimal(dto.totalAmount),
            installmentCount: dto.installmentCount,
          },
        });
        for (let i = 0; i < amounts.length; i++) {
          const cycle = addMonths(start, i),
            dates = invoiceDates(cycle, card.closingDay, card.dueDay);
          const invoice = await tx.cardInvoice.upsert({
            where: { cardId_referenceMonth: { cardId: card.id, referenceMonth: cycle } },
            create: {
              userId,
              cardId: card.id,
              referenceMonth: cycle,
              closingDate: civilDate(dates.closingDate),
              dueDate: civilDate(dates.dueDate),
            },
            update: {},
          });
          if (invoice.status !== 'OPEN')
            throw new ConflictException({
              code: 'CONCURRENT_MODIFICATION',
              message: 'A fatura foi fechada durante a compra.',
            });
          await tx.cardInstallment.create({
            data: {
              purchaseId: purchase.id,
              installmentNumber: i + 1,
              installmentCount: amounts.length,
              amount: new Prisma.Decimal(amounts[i]!),
              referenceMonth: cycle,
              invoiceId: invoice.id,
            },
          });
        }
        return this.getTx(tx, userId, purchase.id);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async get(userId: string, id: string) {
    return this.getTx(this.prisma, userId, id);
  }
  async list(userId: string, q: CardPurchaseListQuery): Promise<PaginatedCardPurchasesResponse> {
    const limit = this.limit(q.limit);
    const cursor = q.cursor ? this.cursor(q.cursor) : undefined;
    if (q.dateFrom && q.dateTo && q.dateFrom > q.dateTo) throw invalid('dateFrom');
    const rows = await this.prisma.cardPurchase.findMany({
      where: {
        userId,
        ...(q.cardId ? { cardId: q.cardId } : {}),
        ...(q.categoryId ? { categoryId: q.categoryId } : {}),
        ...(q.dateFrom || q.dateTo
          ? {
              purchaseDate: {
                ...(q.dateFrom ? { gte: civilDate(q.dateFrom) } : {}),
                ...(q.dateTo ? { lte: civilDate(q.dateTo) } : {}),
              },
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                { purchaseDate: { lt: civilDate(cursor.date) } },
                { purchaseDate: civilDate(cursor.date), id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
      orderBy: [{ purchaseDate: 'desc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const data = rows.slice(0, limit);
    const last = data.at(-1);
    return {
      data: data.map(this.public),
      page: {
        limit,
        nextCursor:
          rows.length > limit && last
            ? Buffer.from(
                JSON.stringify({ date: civilString(last.purchaseDate), id: last.id }),
              ).toString('base64url')
            : null,
      },
    };
  }
  async update(userId: string, id: string, dto: UpdateCardPurchaseDto) {
    if (!Object.keys(dto).length) throw invalid();
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.cardPurchase.findFirst({
          where: { id, userId },
          include: { installments: { include: { invoice: true } } },
        });
        if (!row) throw missing();
        if (row.installments.some((x) => x.invoice.status !== 'OPEN'))
          throw new ConflictException({
            code: 'PURCHASE_IN_CLOSED_INVOICE',
            message: 'Compra vinculada a fatura fechada não pode ser editada.',
          });
        const structural = ['cardId', 'totalAmount', 'installmentCount', 'purchaseDate'].some(
          (k) => k in dto,
        );
        const cardId = dto.cardId ?? row.cardId,
          categoryId = dto.categoryId ?? row.categoryId;
        const { card } = await this.relations(
          tx,
          userId,
          cardId,
          categoryId,
          cardId !== row.cardId,
        );
        if (structural) {
          const total = dto.totalAmount ?? row.totalAmount.toFixed(2),
            count = dto.installmentCount ?? row.installmentCount,
            date = dto.purchaseDate ?? civilString(row.purchaseDate),
            amounts = this.amounts(total, count),
            start = await this.openCycle(
              tx,
              userId,
              cardId,
              initialCycle(date, card.closingDay),
              card.closingDay,
              card.dueDay,
            );
          await tx.cardInstallment.deleteMany({ where: { purchaseId: id } });
          for (let i = 0; i < count; i++) {
            const cycle = addMonths(start, i),
              dates = invoiceDates(cycle, card.closingDay, card.dueDay),
              invoice = await tx.cardInvoice.upsert({
                where: { cardId_referenceMonth: { cardId, referenceMonth: cycle } },
                create: {
                  userId,
                  cardId,
                  referenceMonth: cycle,
                  closingDate: civilDate(dates.closingDate),
                  dueDate: civilDate(dates.dueDate),
                },
                update: {},
              });
            if (invoice.status !== 'OPEN')
              throw new ConflictException({
                code: 'CONCURRENT_MODIFICATION',
                message: 'Fatura fechada durante a edição.',
              });
            await tx.cardInstallment.create({
              data: {
                purchaseId: id,
                installmentNumber: i + 1,
                installmentCount: count,
                amount: new Prisma.Decimal(amounts[i]!),
                referenceMonth: cycle,
                invoiceId: invoice.id,
              },
            });
          }
        }
        await tx.cardPurchase.update({
          where: { id },
          data: {
            ...(dto.cardId ? { cardId: dto.cardId } : {}),
            ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.notes !== undefined ? { notes: normalizeOptional(dto.notes) } : {}),
            ...(dto.purchaseDate ? { purchaseDate: civilDate(dto.purchaseDate) } : {}),
            ...(dto.totalAmount ? { totalAmount: new Prisma.Decimal(dto.totalAmount) } : {}),
            ...(dto.installmentCount ? { installmentCount: dto.installmentCount } : {}),
          },
        });
        return this.getTx(tx, userId, id);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  private amounts(total: string, count: number) {
    try {
      if (new Prisma.Decimal(total).lte(0)) throw new Error();
      return splitInstallments(total, count);
    } catch {
      throw invalid('totalAmount');
    }
  }
  private async relations(
    tx: Tx,
    userId: string,
    cardId: string,
    categoryId: string,
    requireActive = true,
  ) {
    const [card, category] = await Promise.all([
      tx.financialCreditCard.findFirst({ where: { id: cardId, userId } }),
      tx.financialCategory.findFirst({ where: { id: categoryId, userId } }),
    ]);
    if (!card || !category) throw missing();
    if ((requireActive && card.archivedAt) || category.archivedAt)
      throw new ConflictException({
        code: 'RELATED_RESOURCE_ARCHIVED',
        message: 'Selecione cartão e categoria ativos.',
      });
    if (category.type !== 'EXPENSE')
      throw new ConflictException({
        code: 'CATEGORY_TYPE_MISMATCH',
        message: 'Selecione uma categoria de despesa.',
      });
    return { card, category };
  }
  private async openCycle(
    tx: Tx,
    userId: string,
    cardId: string,
    cycle: string,
    closingDay: number,
    dueDay: number,
  ) {
    let candidate = cycle;
    for (let i = 0; i < 120; i++) {
      const dates = invoiceDates(candidate, closingDay, dueDay),
        invoice = await tx.cardInvoice.upsert({
          where: { cardId_referenceMonth: { cardId, referenceMonth: candidate } },
          create: {
            userId,
            cardId,
            referenceMonth: candidate,
            closingDate: civilDate(dates.closingDate),
            dueDate: civilDate(dates.dueDate),
          },
          update: {},
        });
      if (invoice.status === 'OPEN') return candidate;
      candidate = addMonths(candidate, 1);
    }
    throw new ConflictException({
      code: 'CONCURRENT_MODIFICATION',
      message: 'Não foi possível localizar ciclo aberto.',
    });
  }
  private async getTx(
    tx: Tx | PrismaService,
    userId: string,
    id: string,
  ): Promise<PublicCardPurchase> {
    const x = await tx.cardPurchase.findFirst({
      where: { id, userId },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });
    if (!x) throw missing();
    return this.public(x);
  }
  private public(x: PurchaseWithInstallments): PublicCardPurchase {
    return {
      id: x.id,
      cardId: x.cardId,
      categoryId: x.categoryId,
      description: x.description,
      notes: x.notes,
      purchaseDate: civilString(x.purchaseDate),
      totalAmount: x.totalAmount.toFixed(2),
      installmentCount: x.installmentCount,
      installments: x.installments.map((i) => ({
        id: i.id,
        installmentNumber: i.installmentNumber,
        installmentCount: i.installmentCount,
        amount: i.amount.toFixed(2),
        referenceMonth: i.referenceMonth,
        invoiceId: i.invoiceId,
        createdAt: i.createdAt.toISOString(),
      })),
      createdAt: x.createdAt.toISOString(),
      updatedAt: x.updatedAt.toISOString(),
    };
  }
  private limit(raw?: string) {
    const n = Number(raw ?? 20);
    if (!/^\d+$/.test(raw ?? '20') || n < 1 || n > 100) throw invalid('limit');
    return n;
  }
  private cursor(raw: string): { date: string; id: string } {
    try {
      const x = JSON.parse(Buffer.from(raw, 'base64url').toString());
      if (typeof x.date !== 'string' || typeof x.id !== 'string') throw 0;
      return x;
    } catch {
      throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Reinicie a paginação.' });
    }
  }
}
