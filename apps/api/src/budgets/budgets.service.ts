import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PublicMonthlyBudget } from '@planner-fin/shared';
import { PrismaService } from '../prisma/prisma.service';
import { money, monthDateBounds, totals } from './budget-finance';
import type { BudgetCategoryDto, CopyBudgetDto, CreateBudgetDto, UpdateBudgetDto } from './dto';

type Tx = Prisma.TransactionClient;
const missing = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Orçamento não encontrado.' });
const invalid = (message: string) => new BadRequestException({ code: 'VALIDATION_ERROR', message });
const incompatible = (code: string, message: string) =>
  new UnprocessableEntityException({ code, message });

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  private decimal(value: string, field: string): Prisma.Decimal {
    const result = new Prisma.Decimal(value);
    if (!result.greaterThan(0)) throw invalid(`${field} deve ser maior que zero.`);
    return result;
  }
  private uniqueCategories(categories: BudgetCategoryDto[]) {
    if (new Set(categories.map((item) => item.categoryId)).size !== categories.length)
      throw invalid('Não repita categorias no orçamento.');
  }
  private async validateCategories(
    tx: Tx,
    userId: string,
    categories: BudgetCategoryDto[],
    existing = new Map<string, string>(),
  ) {
    this.uniqueCategories(categories);
    categories.forEach((item) => this.decimal(item.limitAmount, 'O limite da categoria'));
    if (!categories.length) return;
    const rows = await tx.financialCategory.findMany({
      where: { id: { in: categories.map((item) => item.categoryId) }, userId },
    });
    if (rows.length !== categories.length) throw missing();
    for (const row of rows) {
      if (row.type !== 'EXPENSE')
        throw incompatible('CATEGORY_TYPE_MISMATCH', 'Use somente categorias de despesa.');
      if (row.archivedAt) {
        const requested = categories.find((item) => item.categoryId === row.id)!.limitAmount;
        if (existing.get(row.id) !== requested)
          throw incompatible(
            'RELATED_RESOURCE_ARCHIVED',
            'Uma categoria arquivada só pode ser preservada com o mesmo limite ou removida.',
          );
      }
    }
  }
  private conflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new ConflictException({
        code: 'BUDGET_MONTH_CONFLICT',
        message: 'Já existe um orçamento para este mês.',
      });
    throw error;
  }
  async create(userId: string, dto: CreateBudgetDto): Promise<PublicMonthlyBudget> {
    if (!Object.prototype.hasOwnProperty.call(dto, 'notes'))
      throw invalid('Informe notes, mesmo que null.');
    const totalLimit = this.decimal(dto.totalLimit, 'O limite total');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.validateCategories(tx, userId, dto.categories);
          const row = await tx.monthlyBudget.create({
            data: {
              userId,
              month: dto.month,
              totalLimit,
              notes: dto.notes,
              categories: {
                create: dto.categories.map((item) => ({
                  categoryId: item.categoryId,
                  limitAmount: new Prisma.Decimal(item.limitAmount),
                })),
              },
            },
            include: { categories: { include: { category: true } } },
          });
          return this.project(tx, row);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      return this.conflict(error);
    }
  }
  async getByMonth(userId: string, month: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.monthlyBudget.findFirst({
          where: { userId, month },
          include: { categories: { include: { category: true } } },
        });
        if (!row) throw missing();
        return this.project(tx, row);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async getById(userId: string, id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
      throw invalid('Identificador inválido.');
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.monthlyBudget.findFirst({
          where: { userId, id },
          include: { categories: { include: { category: true } } },
        });
        if (!row) throw missing();
        return this.project(tx, row);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async update(userId: string, id: string, dto: UpdateBudgetDto) {
    if (!Object.keys(dto).length) throw invalid('Informe ao menos um campo.');
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.monthlyBudget.findFirst({
          where: { id, userId },
          include: { categories: { include: { category: true } } },
        });
        if (!row) throw missing();
        const existing = new Map(
          row.categories.map((item) => [item.categoryId, money(item.limitAmount)]),
        );
        if (dto.categories) await this.validateCategories(tx, userId, dto.categories, existing);
        const totalLimit = dto.totalLimit
          ? this.decimal(dto.totalLimit, 'O limite total')
          : row.totalLimit;
        const categoriesChanged =
          dto.categories !== undefined &&
          (dto.categories.length !== existing.size ||
            dto.categories.some((item) => existing.get(item.categoryId) !== item.limitAmount));
        const scalarChanged =
          !totalLimit.equals(row.totalLimit) ||
          (dto.notes !== undefined && dto.notes !== row.notes);
        if (categoriesChanged) {
          await tx.monthlyBudgetCategory.deleteMany({ where: { budgetId: row.id } });
          if (dto.categories!.length)
            await tx.monthlyBudgetCategory.createMany({
              data: dto.categories!.map((item) => ({
                budgetId: row.id,
                categoryId: item.categoryId,
                limitAmount: new Prisma.Decimal(item.limitAmount),
              })),
            });
        }
        if (scalarChanged)
          await tx.monthlyBudget.update({
            where: { id: row.id },
            data: { totalLimit, ...(dto.notes === undefined ? {} : { notes: dto.notes }) },
          });
        const fresh = await tx.monthlyBudget.findUniqueOrThrow({
          where: { id: row.id },
          include: { categories: { include: { category: true } } },
        });
        return this.project(tx, fresh);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async copy(userId: string, id: string, dto: CopyBudgetDto) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const source = await tx.monthlyBudget.findFirst({
            where: { id, userId },
            include: { categories: { include: { category: true } } },
          });
          if (!source) throw missing();
          if (source.month === dto.targetMonth)
            throw invalid('O mês de destino deve ser diferente.');
          if (source.categories.some((item) => item.category.archivedAt))
            throw incompatible(
              'RELATED_RESOURCE_ARCHIVED',
              'Reative ou remova categorias arquivadas antes de copiar.',
            );
          const target = await tx.monthlyBudget.create({
            data: {
              userId,
              month: dto.targetMonth,
              totalLimit: source.totalLimit,
              notes: source.notes,
              categories: {
                create: source.categories.map((item) => ({
                  categoryId: item.categoryId,
                  limitAmount: item.limitAmount,
                })),
              },
            },
            include: { categories: { include: { category: true } } },
          });
          return this.project(tx, target);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      return this.conflict(error);
    }
  }
  private async project(
    tx: Tx,
    budget: Prisma.MonthlyBudgetGetPayload<{
      include: { categories: { include: { category: true } } };
    }>,
  ): Promise<PublicMonthlyBudget> {
    const { from, to } = monthDateBounds(budget.month);
    const [transactions, installments, debt] = await Promise.all([
      tx.financialTransaction.groupBy({
        by: ['categoryId', 'status'],
        where: { userId: budget.userId, type: 'EXPENSE', dueDate: { gte: from, lt: to } },
        _sum: { plannedAmount: true, actualAmount: true },
      }),
      tx.cardInstallment.findMany({
        where: { referenceMonth: budget.month, purchase: { userId: budget.userId } },
        select: { amount: true, purchase: { select: { categoryId: true } } },
      }),
      tx.debtPayment.aggregate({
        where: { userId: budget.userId, paymentDate: { gte: from, lt: to } },
        _sum: { interestAmount: true, feeAmount: true },
      }),
    ]);
    const zero = new Prisma.Decimal(0);
    const values = new Map<string, { realized: Prisma.Decimal; committed: Prisma.Decimal }>();
    const add = (categoryId: string, realized: Prisma.Decimal, committed: Prisma.Decimal) => {
      const current = values.get(categoryId) ?? { realized: zero, committed: zero };
      values.set(categoryId, {
        realized: current.realized.add(realized),
        committed: current.committed.add(committed),
      });
    };
    transactions.forEach((item) =>
      add(
        item.categoryId,
        item.status === 'PAID' ? (item._sum.actualAmount ?? zero) : zero,
        item._sum.plannedAmount ?? zero,
      ),
    );
    installments.forEach((item) => add(item.purchase.categoryId, item.amount, item.amount));
    const debtCost = (debt._sum.interestAmount ?? zero).add(debt._sum.feeAmount ?? zero);
    const budgetedIds = new Set(budget.categories.map((item) => item.categoryId));
    let categorizedRealized = zero,
      categorizedCommitted = zero,
      unbudgetedRealized = zero,
      unbudgetedCommitted = zero;
    values.forEach((value, categoryId) => {
      categorizedRealized = categorizedRealized.add(value.realized);
      categorizedCommitted = categorizedCommitted.add(value.committed);
      if (!budgetedIds.has(categoryId)) {
        unbudgetedRealized = unbudgetedRealized.add(value.realized);
        unbudgetedCommitted = unbudgetedCommitted.add(value.committed);
      }
    });
    const realized = categorizedRealized.add(debtCost);
    const committed = categorizedCommitted.add(debtCost);
    return {
      id: budget.id,
      month: budget.month,
      totalLimit: money(budget.totalLimit),
      notes: budget.notes,
      ...totals(budget.totalLimit, realized, committed),
      categories: budget.categories
        .map((item) => {
          const value = values.get(item.categoryId) ?? { realized: zero, committed: zero };
          return {
            categoryId: item.categoryId,
            categoryName: item.category.name,
            categoryArchived: Boolean(item.category.archivedAt),
            ...totals(item.limitAmount, value.realized, value.committed),
          };
        })
        .sort(
          (a, b) =>
            a.categoryName.localeCompare(b.categoryName) ||
            a.categoryId.localeCompare(b.categoryId),
        ),
      unbudgetedRealizedExpense: money(unbudgetedRealized),
      unbudgetedCommittedExpense: money(unbudgetedCommitted),
      uncategorizedDebtCostRealized: money(debtCost),
      uncategorizedDebtCostCommitted: money(debtCost),
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
    };
  }
}
