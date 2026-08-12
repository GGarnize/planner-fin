import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AccountsService } from '../accounts/accounts.service';
import { BudgetsService } from '../budgets/budgets.service';
import { DashboardService } from '../dashboard/dashboard.service';
import type { PrismaService } from '../prisma/prisma.service';
import { RecurrencesService } from '../recurrences/recurrences.service';
import { TransactionsService } from './transactions.service';

const databaseUrl = process.env.SPEC017_DATABASE_URL;
const runPg = Boolean(databaseUrl);
const describePg = runPg ? describe : describe.skip;

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const accountA = '33333333-3333-4333-8333-333333333331';
const accountB = '33333333-3333-4333-8333-333333333332';
const categoryA = '44444444-4444-4444-8444-444444444441';
const categoryB = '44444444-4444-4444-8444-444444444442';
const paidId = '55555555-5555-4555-8555-555555555551';
const pendingId = '55555555-5555-4555-8555-555555555552';
const otherId = '55555555-5555-4555-8555-555555555553';
const recurrenceId = '66666666-6666-4666-8666-666666666661';
const createdAt = new Date('2026-08-12T10:00:00.000Z');
const config = { jwtSecret: 'x'.repeat(32) } as never;

function db() {
  if (!databaseUrl) throw new Error('SPEC017_DATABASE_URL ausente');
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const allowedHost = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    process.env.SPEC017_ALLOW_DESTRUCTIVE_TESTS !== 'true' ||
    !allowedHost ||
    !databaseName.startsWith('planner_fin_spec017_')
  )
    throw new Error('Use opt-in explicito e banco local sintetico planner_fin_spec017_*.');
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

async function assertSafeDatabase(prisma: PrismaClient) {
  const [{ current_database: databaseName }] = await prisma.$queryRaw<
    Array<{ current_database: string }>
  >`select current_database()`;
  if (!databaseName.startsWith('planner_fin_spec017_'))
    throw new Error('Banco conectado nao e sintetico da SPEC-017.');
}

function transactions(prisma: PrismaClient) {
  return new TransactionsService(prisma as unknown as PrismaService, config);
}

async function seed(prisma: PrismaClient) {
  await prisma.financialTransaction.deleteMany({
    where: { userId: { in: [userA, userB] } },
  });
  await prisma.recurrenceRule.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.monthlyBudgetCategory.deleteMany({
    where: { budget: { userId: { in: [userA, userB] } } },
  });
  await prisma.monthlyBudget.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialAccount.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialCategory.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.user.createMany({
    data: [
      {
        id: userA,
        name: 'Pessoa Teste A',
        email: 'spec017-a@example.test',
        normalizedEmail: 'spec017-a@example.test',
        passwordHash: 'synthetic',
        updatedAt: createdAt,
      },
      {
        id: userB,
        name: 'Pessoa Teste B',
        email: 'spec017-b@example.test',
        normalizedEmail: 'spec017-b@example.test',
        passwordHash: 'synthetic',
        updatedAt: createdAt,
      },
    ],
  });
  await prisma.financialAccount.createMany({
    data: [
      {
        id: accountA,
        userId: userA,
        name: 'Conta A',
        type: 'CHECKING',
        currency: 'BRL',
        openingBalance: new Prisma.Decimal('1000.00'),
        openingBalanceDate: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: createdAt,
      },
      {
        id: accountB,
        userId: userB,
        name: 'Conta B',
        type: 'CHECKING',
        currency: 'BRL',
        openingBalance: new Prisma.Decimal('0.00'),
        openingBalanceDate: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: createdAt,
      },
    ],
  });
  await prisma.financialCategory.createMany({
    data: [
      {
        id: categoryA,
        userId: userA,
        name: 'Moradia',
        normalizedName: 'moradia',
        type: 'EXPENSE',
        updatedAt: createdAt,
      },
      {
        id: categoryB,
        userId: userB,
        name: 'Moradia',
        normalizedName: 'moradia',
        type: 'EXPENSE',
        updatedAt: createdAt,
      },
    ],
  });
  await prisma.monthlyBudget.create({
    data: {
      userId: userA,
      month: '2026-08',
      totalLimit: new Prisma.Decimal('1000.00'),
      categories: {
        create: [{ categoryId: categoryA, limitAmount: new Prisma.Decimal('1000.00') }],
      },
    },
  });
  await prisma.financialTransaction.createMany({
    data: [
      {
        id: paidId,
        userId: userA,
        accountId: accountA,
        categoryId: categoryA,
        type: 'EXPENSE',
        status: 'PAID',
        description: 'Pago',
        plannedAmount: new Prisma.Decimal('100.00'),
        actualAmount: new Prisma.Decimal('90.00'),
        dueDate: new Date('2026-08-10T00:00:00.000Z'),
        paidAt: new Date('2026-08-10T00:00:00.000Z'),
      },
      {
        id: pendingId,
        userId: userA,
        accountId: accountA,
        categoryId: categoryA,
        type: 'EXPENSE',
        status: 'PENDING',
        description: 'Pendente',
        plannedAmount: new Prisma.Decimal('50.00'),
        dueDate: new Date('2026-08-11T00:00:00.000Z'),
      },
      {
        id: otherId,
        userId: userB,
        accountId: accountB,
        categoryId: categoryB,
        type: 'EXPENSE',
        status: 'PENDING',
        description: 'Alheio',
        plannedAmount: new Prisma.Decimal('10.00'),
        dueDate: new Date('2026-08-11T00:00:00.000Z'),
      },
    ],
  });
}

describePg('exclusao individual de lancamento com PostgreSQL real', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = db();
    await prisma.$connect();
    await assertSafeDatabase(prisma);
  });

  beforeEach(async () => {
    await seed(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('migration cria deletedAt nulo e preserva dados historicos existentes', async () => {
    const columns = await prisma.$queryRaw<Array<{ data_type: string; is_nullable: string }>>`
      select data_type, is_nullable
      from information_schema.columns
      where table_name = 'FinancialTransaction' and column_name = 'deletedAt'
    `;
    expect(columns).toEqual([{ data_type: 'timestamp with time zone', is_nullable: 'YES' }]);
    const rows = await prisma.financialTransaction.findMany({
      where: { id: { in: [paidId, pendingId] } },
      orderBy: { id: 'asc' },
    });
    expect(rows.every((row) => row.deletedAt === null)).toBe(true);
    expect(rows.find((row) => row.id === paidId)?.actualAmount?.toFixed(2)).toBe('90.00');
  });

  it('delete proprio e repetido retorna 204 logico, preservando valores e updatedAt do tombstone', async () => {
    const service = transactions(prisma);
    await service.remove(userA, pendingId);
    const first = await prisma.financialTransaction.findUniqueOrThrow({ where: { id: pendingId } });
    await service.remove(userA, pendingId);
    const second = await prisma.financialTransaction.findUniqueOrThrow({
      where: { id: pendingId },
    });
    expect(first.deletedAt).toBeInstanceOf(Date);
    expect(second.deletedAt?.toISOString()).toBe(first.deletedAt?.toISOString());
    expect(second.updatedAt.toISOString()).toBe(first.updatedAt.toISOString());
    expect(second.plannedAmount.toFixed(2)).toBe('50.00');
    expect(second.status).toBe('PENDING');
    await expect(service.get(userA, pendingId)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('owner alheio e inexistente recebem o mesmo 404 sem mutacao', async () => {
    const service = transactions(prisma);
    await expect(service.remove(userA, otherId)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
    await expect(
      service.remove(userA, '77777777-7777-4777-8777-777777777777'),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    expect(
      (await prisma.financialTransaction.findUniqueOrThrow({ where: { id: otherId } })).deletedAt,
    ).toBeNull();
  });

  it('read models removem PENDING de comprometido e PAID de realizado', async () => {
    const service = transactions(prisma);
    await service.remove(userA, pendingId);
    await service.remove(userA, paidId);

    await expect(service.list(userA, {})).resolves.toMatchObject({ data: [] });
    await expect(new AccountsService(prisma as never).get(userA, accountA)).resolves.toMatchObject({
      realizedBalance: '1000.00',
    });
    await expect(
      new BudgetsService(prisma as never).getByMonth(userA, '2026-08'),
    ).resolves.toMatchObject({
      totals: { realizedExpense: '0.00', committedExpense: '0.00' },
    });
    await expect(
      new DashboardService(prisma as never, () => new Date('2026-08-12T12:00:00.000Z')).get(
        userA,
        '2026-08',
      ),
    ).resolves.toMatchObject({
      monthlyFlow: { expenseRealized: '0.00', expenseCommitted: '0.00' },
    });
  });

  it('tombstone recorrente nao renasce e futuras ocorrencias continuam', async () => {
    await prisma.recurrenceRule.create({
      data: {
        id: recurrenceId,
        userId: userA,
        kind: 'TRANSACTION',
        frequency: 'MONTHLY',
        startDate: new Date('2026-08-05T00:00:00.000Z'),
        dayOfMonth: 5,
        transactionType: 'EXPENSE',
        accountId: accountA,
        categoryId: categoryA,
        plannedAmount: new Prisma.Decimal('70.00'),
        description: 'Recorrente',
        nextOccurrenceDate: new Date('2026-08-05T00:00:00.000Z'),
      },
    });
    const recurrences = new RecurrencesService(prisma as never);
    await recurrences.generate(userA, recurrenceId);
    const occurrence = await prisma.financialTransaction.findUniqueOrThrow({
      where: {
        recurrenceRuleId_occurrenceDate: {
          recurrenceRuleId: recurrenceId,
          occurrenceDate: new Date('2026-08-05T00:00:00.000Z'),
        },
      },
    });
    await transactions(prisma).remove(userA, occurrence.id);
    const tombstone = await prisma.financialTransaction.findUniqueOrThrow({
      where: { id: occurrence.id },
    });
    await prisma.recurrenceRule.update({
      where: { id: recurrenceId },
      data: { nextOccurrenceDate: new Date('2026-08-05T00:00:00.000Z') },
    });
    await recurrences.generate(userA, recurrenceId);
    const rows = await prisma.financialTransaction.findMany({
      where: { recurrenceRuleId: recurrenceId },
      orderBy: { occurrenceDate: 'asc' },
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]!.id).toBe(occurrence.id);
    expect(rows[0]!.deletedAt?.toISOString()).toBe(tombstone.deletedAt?.toISOString());
    expect(rows.map((item) => item.occurrenceDate?.toISOString().slice(0, 10))).toEqual(
      expect.arrayContaining(['2026-09-05']),
    );
    const rule = await prisma.recurrenceRule.findUniqueOrThrow({ where: { id: recurrenceId } });
    expect(rule.status).toBe('ACTIVE');
    expect(rule.archivedAt).toBeNull();
  });
});
