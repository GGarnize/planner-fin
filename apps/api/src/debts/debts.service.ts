import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FinancialDebtDetail, PublicFinancialDebt } from '@planner-fin/shared';
import type { ApiConfig } from '../config/env';
import { API_CONFIG } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDebtDto, PayDebtInstallmentDto, UpdateDebtDto } from './dto';
import {
  civilDate,
  civilString,
  invalidUuid,
  installmentTotal,
  projections,
  publicInstallment,
  requireCivil,
  validateAggregate,
} from './debt-finance';
import { fingerprint, readDebtCursor, signDebtCursor } from './debt-pagination';
const missing = () =>
  new NotFoundException({ code: 'DEBT_NOT_FOUND', message: 'Dívida não encontrada.' });
const incompatible = (message: string) =>
  new UnprocessableEntityException({ code: 'DEBT_INCOMPATIBLE', message });
@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}
  private today() {
    return new Date().toISOString().slice(0, 10);
  }
  private async account(tx: Prisma.TransactionClient, userId: string, id: string) {
    const own = await tx.financialAccount.findFirst({ where: { id, userId } });
    if (!own)
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Conta não encontrada.' });
    if (own.archivedAt) throw incompatible('A conta informada está arquivada.');
    return own;
  }
  private data(dto: CreateDebtDto, userId: string) {
    return {
      userId,
      type: dto.type,
      creditorName: dto.creditorName,
      description: dto.description || null,
      notes: dto.notes || null,
      originalPrincipal: new Prisma.Decimal(dto.originalPrincipal),
      startDate: civilDate(dto.startDate),
      installmentCount: dto.installmentCount,
    };
  }
  async create(userId: string, dto: CreateDebtDto) {
    validateAggregate(dto);
    requireCivil(dto.startDate, 'Data inicial');
    if (dto.funding) requireCivil(dto.funding.fundingDate, 'Data do funding');
    return this.prisma.$transaction(
      async (tx) => {
        if (dto.funding) await this.account(tx, userId, dto.funding.accountId);
        const debt = await tx.financialDebt.create({
          data: {
            ...this.data(dto, userId),
            installments: {
              create: dto.installments.map((x) => ({
                installmentNumber: x.installmentNumber,
                dueDate: civilDate(x.dueDate),
                principalAmount: new Prisma.Decimal(x.principalAmount),
                interestAmount: new Prisma.Decimal(x.interestAmount),
                feeAmount: new Prisma.Decimal(x.feeAmount),
              })),
            },
            ...(dto.funding
              ? {
                  funding: {
                    create: {
                      userId,
                      accountId: dto.funding.accountId,
                      amount: new Prisma.Decimal(dto.funding.amount),
                      fundingDate: civilDate(dto.funding.fundingDate),
                    },
                  },
                }
              : {}),
          },
          include: { funding: true, installments: true, payments: true },
        });
        return this.detail(debt);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async list(userId: string, q: Record<string, string>) {
    const limit = q.limit ? Number(q.limit) : 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Limite inválido.' });
    const fp = fingerprint(q, limit),
      cursor = q.cursor ? readDebtCursor(q.cursor, this.config.jwtSecret, fp) : null,
      today = this.today();
    const archived = q.archived ?? 'false';
    const due = q.due ?? 'all';
    const where: Prisma.FinancialDebtWhereInput = {
      userId,
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.type ? { type: q.type as never } : {}),
      ...(archived === 'false'
        ? { archivedAt: null }
        : archived === 'true'
          ? { archivedAt: { not: null } }
          : {}),
      ...(due === 'overdue'
        ? { installments: { some: { status: 'PENDING', dueDate: { lt: civilDate(today) } } } }
        : due === 'upcoming'
          ? {
              AND: [
                { installments: { some: { status: 'PENDING' } } },
                {
                  installments: { none: { status: 'PENDING', dueDate: { lt: civilDate(today) } } },
                },
              ],
            }
          : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.financialDebt.findMany({
      where,
      include: { installments: true, payments: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const more = rows.length > limit,
      items = rows.slice(0, limit).map((x) => this.summary(x));
    const last = rows[Math.min(rows.length, limit) - 1];
    return {
      items,
      nextCursor:
        more && last
          ? signDebtCursor(
              { createdAt: last.createdAt.toISOString(), id: last.id, fingerprint: fp },
              this.config.jwtSecret,
            )
          : null,
    };
  }
  async get(userId: string, id: string) {
    if (invalidUuid(id))
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Identificador inválido.',
      });
    const row = await this.prisma.financialDebt.findFirst({
      where: { id, userId },
      include: {
        funding: true,
        installments: { orderBy: { installmentNumber: 'asc' } },
        payments: { orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }] },
      },
    });
    if (!row) throw missing();
    return this.detail(row);
  }
  async update(userId: string, id: string, dto: UpdateDebtDto) {
    if (!Object.keys(dto).length)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Informe ao menos um campo.',
      });
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.financialDebt.findFirst({
          where: { id, userId },
          include: { payments: true },
        });
        if (!row) throw missing();
        if (row.archivedAt) throw incompatible('Dívida arquivada não pode ser editada.');
        const structural = [
          'type',
          'originalPrincipal',
          'startDate',
          'installmentCount',
          'installments',
          'funding',
        ].some((k) => k in dto);
        if (row.payments.length && structural)
          throw incompatible('Após um pagamento, somente os textos podem ser editados.');
        if (structural) {
          const required = [
            'type',
            'originalPrincipal',
            'startDate',
            'installmentCount',
            'installments',
          ];
          if (required.some((k) => !(k in dto)))
            throw incompatible('A edição estrutural exige o agregado completo.');
          const aggregate = {
            ...dto,
            creditorName: dto.creditorName ?? row.creditorName,
          } as CreateDebtDto;
          validateAggregate(aggregate);
          if (aggregate.funding) await this.account(tx, userId, aggregate.funding.accountId);
          await tx.debtFunding.deleteMany({ where: { debtId: id } });
          await tx.debtInstallment.deleteMany({ where: { debtId: id } });
          await tx.financialDebt.update({
            where: { id },
            data: {
              ...this.data(aggregate, userId),
              creditorName: dto.creditorName ?? row.creditorName,
              description:
                dto.description === undefined ? row.description : dto.description || null,
              notes: dto.notes === undefined ? row.notes : dto.notes || null,
              installments: {
                create: aggregate.installments.map((x) => ({
                  installmentNumber: x.installmentNumber,
                  dueDate: civilDate(x.dueDate),
                  principalAmount: new Prisma.Decimal(x.principalAmount),
                  interestAmount: new Prisma.Decimal(x.interestAmount),
                  feeAmount: new Prisma.Decimal(x.feeAmount),
                })),
              },
              ...(aggregate.funding
                ? {
                    funding: {
                      create: {
                        userId,
                        accountId: aggregate.funding.accountId,
                        amount: new Prisma.Decimal(aggregate.funding.amount),
                        fundingDate: civilDate(aggregate.funding.fundingDate),
                      },
                    },
                  }
                : {}),
            },
          });
        } else
          await tx.financialDebt.update({
            where: { id },
            data: {
              creditorName: dto.creditorName,
              description: dto.description === undefined ? undefined : dto.description || null,
              notes: dto.notes === undefined ? undefined : dto.notes || null,
            },
          });
        return this.getTx(tx, userId, id);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async pay(userId: string, id: string, dto: PayDebtInstallmentDto) {
    requireCivil(dto.paymentDate, 'Data de pagamento');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const inst = await tx.debtInstallment.findFirst({
            where: { id, debt: { userId } },
            include: { debt: true, payment: true },
          });
          if (!inst) throw missing();
          if (inst.payment) {
            if (
              inst.payment.accountId === dto.accountId &&
              civilString(inst.payment.paymentDate) === dto.paymentDate
            )
              return { payment: this.publicPayment(inst.payment), created: false };
            throw new ConflictException({
              code: 'PAYMENT_CONFLICT',
              message: 'A parcela já possui outro pagamento.',
            });
          }
          if (inst.debt.archivedAt) throw incompatible('Dívida arquivada não pode ser paga.');
          if (inst.debt.status !== 'ACTIVE')
            throw incompatible('Dívida incompatível com pagamento.');
          await this.account(tx, userId, dto.accountId);
          const changed = await tx.debtInstallment.updateMany({
            where: { id, status: 'PENDING' },
            data: { status: 'PAID' },
          });
          if (changed.count !== 1)
            throw new ConflictException({
              code: 'PAYMENT_CONFLICT',
              message: 'A parcela já foi processada.',
            });
          const payment = await tx.debtPayment.create({
            data: {
              userId,
              debtId: inst.debtId,
              installmentId: id,
              accountId: dto.accountId,
              paymentDate: civilDate(dto.paymentDate),
              principalAmount: inst.principalAmount,
              interestAmount: inst.interestAmount,
              feeAmount: inst.feeAmount,
            },
          });
          const pending = await tx.debtInstallment.count({
            where: { debtId: inst.debtId, status: 'PENDING' },
          });
          await tx.financialDebt.update({
            where: { id: inst.debtId },
            data: { status: pending ? 'ACTIVE' : 'PAID_OFF' },
          });
          return { payment: this.publicPayment(payment), created: true };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (e instanceof HttpException) throw e;
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === 'P2002' || e.code === 'P2034')
      ) {
        const existing = await this.prisma.debtPayment.findUnique({ where: { installmentId: id } });
        if (
          existing &&
          existing.userId === userId &&
          existing.accountId === dto.accountId &&
          civilString(existing.paymentDate) === dto.paymentDate
        )
          return { payment: this.publicPayment(existing), created: false };
        throw new ConflictException({
          code: 'PAYMENT_CONFLICT',
          message: 'Pagamento concorrente ou divergente.',
        });
      }
      throw e;
    }
  }
  async archive(userId: string, id: string) {
    const row = await this.find(userId, id);
    if (row.status !== 'PAID_OFF') throw incompatible('Somente dívida quitada pode ser arquivada.');
    if (!row.archivedAt)
      await this.prisma.financialDebt.update({ where: { id }, data: { archivedAt: new Date() } });
    return this.get(userId, id);
  }
  async restore(userId: string, id: string) {
    const row = await this.find(userId, id);
    if (row.archivedAt)
      await this.prisma.financialDebt.update({ where: { id }, data: { archivedAt: null } });
    return this.get(userId, id);
  }
  private async find(userId: string, id: string) {
    if (invalidUuid(id)) throw missing();
    const x = await this.prisma.financialDebt.findFirst({ where: { id, userId } });
    if (!x) throw missing();
    return x;
  }
  private async getTx(tx: Prisma.TransactionClient, userId: string, id: string) {
    const x = await tx.financialDebt.findFirst({
      where: { id, userId },
      include: {
        funding: true,
        installments: { orderBy: { installmentNumber: 'asc' } },
        payments: { orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }] },
      },
    });
    if (!x) throw missing();
    return this.detail(x);
  }
  private summary(x: any): PublicFinancialDebt {
    const p = projections(x.originalPrincipal, x.installments, x.payments, this.today());
    return {
      id: x.id,
      type: x.type,
      creditorName: x.creditorName,
      description: x.description,
      notes: x.notes,
      originalPrincipal: x.originalPrincipal.toFixed(2),
      startDate: civilString(x.startDate),
      installmentCount: x.installmentCount,
      status: x.status,
      archivedAt: x.archivedAt?.toISOString() ?? null,
      createdAt: x.createdAt.toISOString(),
      updatedAt: x.updatedAt.toISOString(),
      projections: p,
    };
  }
  private detail(x: any): FinancialDebtDetail {
    return {
      ...this.summary(x),
      funding: x.funding
        ? {
            id: x.funding.id,
            accountId: x.funding.accountId,
            amount: x.funding.amount.toFixed(2),
            fundingDate: civilString(x.funding.fundingDate),
            createdAt: x.funding.createdAt.toISOString(),
          }
        : null,
      installments: x.installments.map((i: any) => publicInstallment(i, this.today())),
      payments: x.payments.map((p: any) => this.publicPayment(p)),
    };
  }
  private publicPayment(p: any) {
    return {
      id: p.id,
      debtId: p.debtId,
      installmentId: p.installmentId,
      accountId: p.accountId,
      paymentDate: civilString(p.paymentDate),
      principalAmount: p.principalAmount.toFixed(2),
      interestAmount: p.interestAmount.toFixed(2),
      feeAmount: p.feeAmount.toFixed(2),
      totalAmount: installmentTotal(p).toFixed(2),
      createdAt: p.createdAt.toISOString(),
    };
  }
}
