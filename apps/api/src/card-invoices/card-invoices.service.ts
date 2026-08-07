import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CardInvoiceListQuery,
  PaginatedCardInvoicesResponse,
  PublicCardInvoice,
} from '@planner-fin/shared';
import { API_CONFIG } from '../auth/auth.types';
import type { ApiConfig } from '../config/env';
import { civilDate, civilString } from '../cards/card-finance';
import { PrismaService } from '../prisma/prisma.service';
import type { PayCardInvoiceDto } from './dto';
const missing = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Fatura não encontrada.' });
type Tx = Prisma.TransactionClient;
type InvoiceWithDetails = Prisma.CardInvoiceGetPayload<{ include: typeof include }>;
const include = {
  installments: {
    include: { purchase: { select: { description: true } } },
    orderBy: { installmentNumber: 'asc' },
  },
  payment: true,
} as const;
@Injectable()
export class CardInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(API_CONFIG) private readonly _config: ApiConfig,
  ) {}
  async get(userId: string, id: string) {
    return this.getTx(this.prisma, userId, id);
  }
  async list(userId: string, q: CardInvoiceListQuery): Promise<PaginatedCardInvoicesResponse> {
    const limit = this.limit(q.limit),
      cursor = q.cursor ? this.cursor(q.cursor) : undefined;
    if (q.cycleFrom && q.cycleTo && q.cycleFrom > q.cycleTo) throw this.invalid('cycleFrom');
    const rows = await this.prisma.cardInvoice.findMany({
      where: {
        userId,
        ...(q.cardId ? { cardId: q.cardId } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.cycleFrom || q.cycleTo
          ? {
              referenceMonth: {
                ...(q.cycleFrom ? { gte: q.cycleFrom } : {}),
                ...(q.cycleTo ? { lte: q.cycleTo } : {}),
              },
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                { referenceMonth: { lt: cursor.month } },
                { referenceMonth: cursor.month, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      include,
      orderBy: [{ referenceMonth: 'desc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const data = rows.slice(0, limit),
      last = data.at(-1);
    return {
      data: data.map((x) => this.public(x)),
      page: {
        limit,
        nextCursor:
          rows.length > limit && last
            ? Buffer.from(JSON.stringify({ month: last.referenceMonth, id: last.id })).toString(
                'base64url',
              )
            : null,
      },
    };
  }
  async close(userId: string, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.find(tx, userId, id);
        await tx.cardInvoice.updateMany({
          where: { id, userId, status: 'OPEN' },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
        return this.getTx(tx, userId, id);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async pay(userId: string, id: string, dto: PayCardInvoiceDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const row = await this.find(tx, userId, id);
        const existing = await tx.cardInvoicePayment.findUnique({ where: { invoiceId: id } });
        if (existing) {
          if (
            existing.accountId === dto.accountId &&
            civilString(existing.paymentDate) === dto.paymentDate
          )
            return this.getTx(tx, userId, id);
          throw new ConflictException({
            code: 'INVOICE_ALREADY_PAID',
            message: 'A fatura já foi paga com outros dados.',
          });
        }
        if (row.status !== 'CLOSED')
          throw new ConflictException({
            code: 'INVOICE_NOT_CLOSED',
            message: 'Somente fatura fechada pode ser paga.',
          });
        const account = await tx.financialAccount.findFirst({
          where: { id: dto.accountId, userId },
        });
        if (!account) throw missing();
        if (account.archivedAt)
          throw new ConflictException({
            code: 'RELATED_RESOURCE_ARCHIVED',
            message: 'Selecione uma conta ativa.',
          });
        const total = (
          await tx.cardInstallment.aggregate({ where: { invoiceId: id }, _sum: { amount: true } })
        )._sum.amount;
        if (!total || total.lte(0))
          throw new ConflictException({
            code: 'EMPTY_INVOICE',
            message: 'Fatura sem valor devido.',
          });
        const changed = await tx.cardInvoice.updateMany({
          where: { id, userId, status: 'CLOSED' },
          data: { status: 'PAID', paidAt: new Date() },
        });
        if (changed.count !== 1)
          throw new ConflictException({
            code: 'CONCURRENT_MODIFICATION',
            message: 'Fatura alterada concorrentemente.',
          });
        await tx.cardInvoicePayment.create({
          data: {
            userId,
            invoiceId: id,
            accountId: dto.accountId,
            amount: total,
            paymentDate: civilDate(dto.paymentDate),
          },
        });
        return this.getTx(tx, userId, id);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  private async find(tx: Tx, userId: string, id: string) {
    const x = await tx.cardInvoice.findFirst({ where: { id, userId } });
    if (!x) throw missing();
    return x;
  }
  private async getTx(tx: Tx | PrismaService, userId: string, id: string) {
    const x = await tx.cardInvoice.findFirst({ where: { id, userId }, include });
    if (!x) throw missing();
    return this.public(x);
  }
  private public(x: InvoiceWithDetails): PublicCardInvoice {
    const total = x.installments.reduce(
      (sum, installment) => sum.plus(installment.amount),
      new Prisma.Decimal(0),
    );
    const installments = x.installments.map((i) => ({
      id: i.id,
      installmentNumber: i.installmentNumber,
      installmentCount: i.installmentCount,
      amount: i.amount.toFixed(2),
      referenceMonth: i.referenceMonth,
      invoiceId: i.invoiceId,
      createdAt: i.createdAt.toISOString(),
      purchaseDescription: i.purchase.description,
    }));
    return {
      id: x.id,
      cardId: x.cardId,
      referenceMonth: x.referenceMonth,
      closingDate: civilString(x.closingDate),
      dueDate: civilString(x.dueDate),
      status: x.status,
      closedAt: x.closedAt?.toISOString() ?? null,
      paidAt: x.paidAt?.toISOString() ?? null,
      total: total.toFixed(2),
      installments,
      payment: x.payment
        ? {
            id: x.payment.id,
            invoiceId: x.payment.invoiceId,
            accountId: x.payment.accountId,
            amount: x.payment.amount.toFixed(2),
            paymentDate: civilString(x.payment.paymentDate),
            createdAt: x.payment.createdAt.toISOString(),
          }
        : null,
      createdAt: x.createdAt.toISOString(),
      updatedAt: x.updatedAt.toISOString(),
    };
  }
  private limit(raw?: string) {
    const n = Number(raw ?? 20);
    if (!/^\d+$/.test(raw ?? '20') || n < 1 || n > 100) throw this.invalid('limit');
    return n;
  }
  private invalid(field: string) {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Revise os filtros.',
      details: [{ field, message: 'Valor inválido.' }],
    });
  }
  private cursor(raw: string): { month: string; id: string } {
    try {
      const x = JSON.parse(Buffer.from(raw, 'base64url').toString());
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(x.month) || typeof x.id !== 'string') throw 0;
      return x;
    } catch {
      throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Reinicie a paginação.' });
    }
  }
}
