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

export function publicAccount(account: FinancialAccount): PublicFinancialAccount {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    institution: account.institution,
    currency: 'BRL',
    openingBalance: account.openingBalance.toFixed(2),
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
    return publicAccount(
      await this.prisma.financialAccount.create({
        data: {
          ...dto,
          institution: dto.institution ?? null,
          openingBalance: new Prisma.Decimal(dto.openingBalance),
          openingBalanceDate: this.date(dto.openingBalanceDate),
          userId,
        },
      }),
    );
  }

  async list(userId: string, includeArchived: boolean): Promise<PublicFinancialAccount[]> {
    const rows = await this.prisma.financialAccount.findMany({
      where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(publicAccount);
  }

  async get(userId: string, id: string): Promise<PublicFinancialAccount> {
    const account = await this.find(userId, id);
    return publicAccount(account);
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
    return publicAccount(
      await this.prisma.financialAccount.update({ where: { id: account.id }, data }),
    );
  }

  async archive(userId: string, id: string): Promise<PublicFinancialAccount> {
    const account = await this.find(userId, id);
    if (account.archivedAt) return publicAccount(account);
    return publicAccount(
      await this.prisma.financialAccount.update({
        where: { id: account.id },
        data: { archivedAt: new Date() },
      }),
    );
  }

  async restore(userId: string, id: string): Promise<PublicFinancialAccount> {
    const account = await this.find(userId, id);
    if (!account.archivedAt) return publicAccount(account);
    return publicAccount(
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
}
