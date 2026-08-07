import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type FinancialAccount } from '@prisma/client';
import type { PublicFinancialAccount } from '@planner-fin/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto, isCivilDate, UpdateAccountDto } from './dto';

const notFound = () =>
  new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Conta não encontrada.' });
const invalidDate = () =>
  new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Revise os dados informados.',
    details: [{ field: 'openingBalanceDate', message: 'Informe uma data de referência válida.' }],
  });

export function publicAccount(
  account: FinancialAccount,
  realizedBalance: Prisma.Decimal = account.openingBalance,
): PublicFinancialAccount {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    institution: account.institution,
    currency: 'BRL',
    openingBalance: account.openingBalance.toFixed(2),
    realizedBalance: realizedBalance.toFixed(2),
    openingBalanceDate: account.openingBalanceDate.toISOString().slice(0, 10),
    archivedAt: account.archivedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  private date(value: string): Date {
    if (!isCivilDate(value)) throw invalidDate();
    return new Date(`${value}T00:00:00.000Z`);
  }

  async create(userId: string, dto: CreateAccountDto): Promise<PublicFinancialAccount> {
    const account = await this.prisma.financialAccount.create({
      data: {
        ...dto,
        institution: dto.institution ?? null,
        openingBalance: new Prisma.Decimal(dto.openingBalance),
        openingBalanceDate: this.date(dto.openingBalanceDate),
        userId,
      },
    });
    return publicAccount(account);
  }

  async list(userId: string, includeArchived: boolean): Promise<PublicFinancialAccount[]> {
    const rows = await this.prisma.financialAccount.findMany({
      where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return Promise.all(rows.map((account) => this.publicWithBalance(account)));
  }

  async get(userId: string, id: string): Promise<PublicFinancialAccount> {
    const account = await this.find(userId, id);
    return this.publicWithBalance(account);
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<PublicFinancialAccount> {
    if (Object.keys(dto).length === 0)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Revise os dados informados.',
        details: [{ field: 'body', message: 'Informe ao menos um campo.' }],
      });
    const account = await this.find(userId, id);
    if (account.archivedAt)
      throw new ConflictException({
        code: 'ACCOUNT_ARCHIVED',
        message: 'Reative a conta antes de editar.',
      });
    const data: Prisma.FinancialAccountUpdateInput = { ...dto };
    if (dto.openingBalance !== undefined)
      data.openingBalance = new Prisma.Decimal(dto.openingBalance);
    if (dto.openingBalanceDate !== undefined)
      data.openingBalanceDate = this.date(dto.openingBalanceDate);
    return this.publicWithBalance(
      await this.prisma.financialAccount.update({ where: { id: account.id }, data }),
    );
  }

  async archive(userId: string, id: string): Promise<PublicFinancialAccount> {
    const account = await this.find(userId, id);
    if (account.archivedAt) return this.publicWithBalance(account);
    return this.publicWithBalance(
      await this.prisma.financialAccount.update({
        where: { id: account.id },
        data: { archivedAt: new Date() },
      }),
    );
  }

  async restore(userId: string, id: string): Promise<PublicFinancialAccount> {
    const account = await this.find(userId, id);
    if (!account.archivedAt) return this.publicWithBalance(account);
    return this.publicWithBalance(
      await this.prisma.financialAccount.update({
        where: { id: account.id },
        data: { archivedAt: null },
      }),
    );
  }

  private async find(userId: string, id: string): Promise<FinancialAccount> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
      throw notFound();
    const account = await this.prisma.financialAccount.findFirst({ where: { id, userId } });
    if (!account) throw notFound();
    return account;
  }

  private async publicWithBalance(account: FinancialAccount): Promise<PublicFinancialAccount> {
    const [transactions, outgoing, incoming, payments] = await Promise.all([
      this.prisma.financialTransaction.findMany({
        where: { userId: account.userId, accountId: account.id, status: 'PAID' },
        select: { type: true, actualAmount: true },
      }),
      this.prisma.financialTransfer.aggregate({
        where: { userId: account.userId, sourceAccountId: account.id, status: 'COMPLETED' },
        _sum: { actualAmount: true },
      }),
      this.prisma.financialTransfer.aggregate({
        where: { userId: account.userId, destinationAccountId: account.id, status: 'COMPLETED' },
        _sum: { actualAmount: true },
      }),
      this.prisma.cardInvoicePayment.aggregate({
        where: { userId: account.userId, accountId: account.id },
        _sum: { amount: true },
      }),
    ]);
    const transactionBalance = transactions.reduce(
      (total, row) =>
        row.type === 'INCOME'
          ? total.plus(row.actualAmount ?? 0)
          : total.minus(row.actualAmount ?? 0),
      account.openingBalance,
    );
    const balance = transactionBalance
      .minus(outgoing._sum.actualAmount ?? 0)
      .plus(incoming._sum.actualAmount ?? 0)
      .minus(payments._sum.amount ?? 0);
    return publicAccount(account, balance);
  }
}
