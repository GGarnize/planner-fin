import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
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
import { createCardCursor, paginationFingerprint, readCardCursor } from '../cards/card-pagination';
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
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}
  async get(userId: string, id: string) {
    return this.getTx(this.prisma, userId, id);
  }
  async list(userId: string, q: CardInvoiceListQuery): Promise<PaginatedCardInvoicesResponse> {
    this.validateQuery(q);
    const limit = this.limit(q.limit),
      fingerprint = paginationFingerprint(q, limit),
      cursor = q.cursor ? readCardCursor(q.cursor, this.config.jwtSecret, fingerprint) : undefined;
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
                { referenceMonth: { lt: cursor.key } },
                { referenceMonth: cursor.key, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include,
      orderBy: [{ referenceMonth: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const data = rows.slice(0, limit),
      last = data.at(-1);
    return {
      items: data.map((x) => this.public(x)),
      nextCursor:
        rows.length > limit && last
          ? createCardCursor(
              { key: last.referenceMonth, id: last.id, fingerprint },
              this.config.jwtSecret,
            )
          : null,
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
          throw new UnprocessableEntityException({
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
  private validateQuery(q: CardInvoiceListQuery) {
    const allowed = ['cardId', 'status', 'cycleFrom', 'cycleTo', 'limit', 'cursor'];
    if (Object.keys(q).some((key) => !allowed.includes(key))) throw this.invalid('query');
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const month = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (q.cardId && !uuid.test(q.cardId)) throw this.invalid('cardId');
    if (q.status && !['OPEN', 'CLOSED', 'PAID'].includes(q.status)) throw this.invalid('status');
    if (q.cycleFrom && !month.test(q.cycleFrom)) throw this.invalid('cycleFrom');
    if (q.cycleTo && !month.test(q.cycleTo)) throw this.invalid('cycleTo');
  }
}
