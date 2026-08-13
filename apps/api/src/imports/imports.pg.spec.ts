import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AccountsService } from '../accounts/accounts.service';
import { BudgetsService } from '../budgets/budgets.service';
import { DashboardService } from '../dashboard/dashboard.service';
import type { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import type { ImportUploadFile } from './imports.helpers';
import { ImportsService } from './imports.service';

const databaseUrl = process.env.SPEC021_DATABASE_URL;
const runPg = Boolean(databaseUrl);
const describePg = runPg ? describe : describe.skip;

const userA = '11111111-1111-4111-8111-111111111121';
const userB = '22222222-2222-4222-8222-222222222221';
const accountA = '33333333-3333-4333-8333-333333333321';
const accountB = '33333333-3333-4333-8333-333333333322';
const expenseA = '44444444-4444-4444-8444-444444444421';
const incomeA = '44444444-4444-4444-8444-444444444422';
const expenseB = '44444444-4444-4444-8444-444444444423';
const createdAt = new Date('2026-08-13T10:00:00.000Z');
const keyA = '55555555-5555-4555-8555-555555555521';
const keyB = '55555555-5555-4555-8555-555555555522';
const keyC = '55555555-5555-4555-8555-555555555523';
const config = { jwtSecret: 'x'.repeat(32) } as never;

function db() {
  if (!databaseUrl) throw new Error('SPEC021_DATABASE_URL ausente');
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const allowedHost = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    process.env.SPEC021_ALLOW_DESTRUCTIVE_TESTS !== 'true' ||
    !allowedHost ||
    !databaseName.startsWith('planner_fin_spec021_')
  )
    throw new Error('Use opt-in explicito e banco local sintetico planner_fin_spec021_*.');
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

async function assertSafeDatabase(prisma: PrismaClient) {
  const [{ current_database: databaseName }] = await prisma.$queryRaw<
    Array<{ current_database: string }>
  >`select current_database()`;
  if (!databaseName.startsWith('planner_fin_spec021_'))
    throw new Error('Banco conectado nao e sintetico da SPEC-021.');
}

function imports(prisma: PrismaClient) {
  return new ImportsService(prisma as unknown as PrismaService);
}

function errorCode(error: unknown) {
  return (error as { response?: { code?: string }; code?: string }).response?.code;
}

type ConfirmedResult = {
  created: boolean;
  status: string;
  sessionId: string;
  transactionIds: string[];
  createdCount: number;
};

function csvFile(content: string, name = 'extrato.csv'): ImportUploadFile {
  const buffer = Buffer.from(content);
  return {
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype: 'text/csv',
    size: buffer.length,
    buffer,
  };
}

const mapping = {
  version: 1 as const,
  delimiter: ',' as const,
  header: true,
  dateFormat: 'YYYY-MM-DD' as const,
  decimalSeparator: '.' as const,
  thousandsSeparator: null,
  columns: { date: 0, description: 1, amount: 2, externalId: 3 },
  externalIdReliable: true,
};

async function seed(prisma: PrismaClient) {
  await prisma.importConfirmation.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.importRow.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.importSession.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialTransaction.deleteMany({ where: { userId: { in: [userA, userB] } } });
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
        email: 'spec021-a@example.test',
        normalizedEmail: 'spec021-a@example.test',
        passwordHash: 'synthetic',
        updatedAt: createdAt,
      },
      {
        id: userB,
        name: 'Pessoa Teste B',
        email: 'spec021-b@example.test',
        normalizedEmail: 'spec021-b@example.test',
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
        openingBalance: new Prisma.Decimal('200.00'),
        openingBalanceDate: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: createdAt,
      },
    ],
  });
  await prisma.financialCategory.createMany({
    data: [
      {
        id: expenseA,
        userId: userA,
        name: 'Mercado',
        normalizedName: 'mercado',
        type: 'EXPENSE',
        updatedAt: createdAt,
      },
      {
        id: incomeA,
        userId: userA,
        name: 'Salario',
        normalizedName: 'salario',
        type: 'INCOME',
        updatedAt: createdAt,
      },
      {
        id: expenseB,
        userId: userB,
        name: 'Mercado',
        normalizedName: 'mercado',
        type: 'EXPENSE',
        updatedAt: createdAt,
      },
    ],
  });
  await prisma.monthlyBudget.create({
    data: {
      userId: userA,
      month: '2026-08',
      totalLimit: new Prisma.Decimal('500.00'),
      categories: { create: [{ categoryId: expenseA, limitAmount: new Prisma.Decimal('500.00') }] },
    },
  });
}

async function readySession(prisma: PrismaClient, content?: string) {
  const service = imports(prisma);
  const session = await service.create(
    userA,
    { format: 'CSV', accountId: accountA, delimiter: ',' },
    csvFile(content ?? 'date,description,amount,external\n2026-08-13,Mercado,-10.00,E1\n'),
  );
  const mapped = await service.mapping(userA, session.id, session.draftVersion, mapping);
  let current = mapped;
  for (const row of mapped.rows) {
    current = await service.patchRow(userA, mapped.id, row.id, {
      draftVersion: current.draftVersion,
      categoryId: row.type === 'INCOME' ? incomeA : expenseA,
      selected: true,
    });
  }
  const preview = await service.preview(userA, current.id, current.draftVersion);
  return { service, session: current, preview };
}

describePg('importacao OFX/CSV com PostgreSQL real', () => {
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
    await prisma?.$disconnect();
  });

  it('aplica migration, indices, constraints e FKs reais sem destruir dados existentes', async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      select table_name from information_schema.tables
      where table_name in ('ImportSession', 'ImportRow', 'ImportConfirmation')
    `;
    expect(tables.map((row) => row.table_name).sort()).toEqual([
      'ImportConfirmation',
      'ImportRow',
      'ImportSession',
    ]);
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      select indexname from pg_indexes where tablename in ('ImportRow', 'ImportConfirmation')
    `;
    expect(indexes.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'ImportRow_confirmed_strong_identity_key',
        'ImportRow_transactionId_key',
        'ImportConfirmation_sessionId_key',
        'ImportConfirmation_userId_idempotencyKey_key',
      ]),
    );
    await readySession(prisma);
    await expect(
      prisma.importConfirmation.create({
        data: {
          sessionId: (await prisma.importSession.findFirstOrThrow({ where: { userId: userA } })).id,
          userId: userA,
          idempotencyKey: keyA,
          payloadHash: 'a'.repeat(64),
          result: {},
        },
      }),
    ).resolves.toBeTruthy();
    await expect(
      prisma.importConfirmation.create({
        data: {
          sessionId: (await prisma.importSession.findFirstOrThrow({ where: { userId: userA } })).id,
          userId: userA,
          idempotencyKey: keyB,
          payloadHash: 'b'.repeat(64),
          result: {},
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(await prisma.user.count({ where: { id: { in: [userA, userB] } } })).toBe(2);
  });

  it('preview e puro e nao afeta lancamentos, saldo, dashboard ou budget', async () => {
    const service = imports(prisma);
    const uploaded = await service.create(
      userA,
      { format: 'CSV', accountId: accountA, delimiter: ',' },
      csvFile('date,description,amount,external\n2026-08-13,Mercado,-10.00,E1\n'),
    );
    const mapped = await service.mapping(userA, uploaded.id, uploaded.draftVersion, mapping);
    const preview = await service.preview(userA, mapped.id, mapped.draftVersion);
    expect(preview.counts.total).toBe(1);
    expect(await prisma.financialTransaction.count({ where: { userId: userA } })).toBe(0);
    await expect(new AccountsService(prisma as never).get(userA, accountA)).resolves.toMatchObject({
      realizedBalance: '1000.00',
    });
    await expect(
      new BudgetsService(prisma as never).getByMonth(userA, '2026-08'),
    ).resolves.toMatchObject({ totals: { realizedExpense: '0.00', committedExpense: '0.00' } });
    await expect(
      new DashboardService(prisma as never, () => new Date('2026-08-13T12:00:00.000Z')).get(
        userA,
        '2026-08',
      ),
    ).resolves.toMatchObject({
      monthlyFlow: { expenseRealized: '0.00', expenseCommitted: '0.00' },
    });
    expect(mapped).not.toHaveProperty('sourceData');
  });

  it('confirma atomicamente N linhas pagas com linhagem e limpa dados transitorios', async () => {
    const { service, session, preview } = await readySession(
      prisma,
      'date,description,amount,external\n2026-08-13,Mercado,-10.00,E1\n2026-08-14,Salario,100.00,E2\n',
    );
    const result = (await service.confirm(userA, session.id, keyA, {
      draftVersion: session.draftVersion,
      previewToken: preview.previewToken,
    })) as ConfirmedResult;
    expect(result).toMatchObject({ created: true, status: 'CONFIRMED', createdCount: 2 });
    const rows = await prisma.importRow.findMany({ where: { sessionId: session.id } });
    const transactions = await prisma.financialTransaction.findMany({
      where: { id: { in: result.transactionIds } },
    });
    expect(transactions).toHaveLength(2);
    expect(transactions.every((tx) => tx.status === 'PAID')).toBe(true);
    expect(transactions.every((tx) => tx.plannedAmount.equals(tx.actualAmount ?? 0))).toBe(true);
    expect(transactions.map((tx) => tx.dueDate.toISOString())).toEqual(
      transactions.map((tx) => tx.paidAt?.toISOString()),
    );
    expect(rows.every((row) => result.transactionIds.includes(row.transactionId!))).toBe(true);
    await expect(prisma.importSession.findUnique({ where: { id: session.id } })).resolves.toMatchObject({
      status: 'CONFIRMED',
      sourceData: null,
      mapping: null,
      displayFileName: null,
    });
    expect(await prisma.importConfirmation.count({ where: { sessionId: session.id } })).toBe(1);
  });

  it('faz rollback integral quando relacao fica invalida antes do commit', async () => {
    const { service, session, preview } = await readySession(prisma);
    await prisma.financialCategory.update({ where: { id: expenseA }, data: { archivedAt: createdAt } });
    await expect(
      service.confirm(userA, session.id, keyA, {
        draftVersion: session.draftVersion,
        previewToken: preview.previewToken,
      }),
    ).rejects.toMatchObject({ response: { code: 'IMPORT_CATEGORY_UNAVAILABLE' } });
    expect(await prisma.financialTransaction.count({ where: { userId: userA } })).toBe(0);
    expect(await prisma.importRow.count({ where: { sessionId: session.id, transactionId: { not: null } } })).toBe(0);
    expect(await prisma.importConfirmation.count({ where: { sessionId: session.id } })).toBe(0);
    await expect(prisma.importSession.findUnique({ where: { id: session.id } })).resolves.toMatchObject({
      status: 'READY_FOR_REVIEW',
    });
  });

  it('mantem idempotencia sequencial e rejeita chave reutilizada com payload diferente', async () => {
    const { service, session, preview } = await readySession(prisma);
    const first = (await service.confirm(userA, session.id, keyA, {
      draftVersion: session.draftVersion,
      previewToken: preview.previewToken,
    })) as ConfirmedResult;
    const retry = await service.confirm(userA, session.id, keyA, {
      draftVersion: session.draftVersion,
      previewToken: preview.previewToken,
    });
    expect(retry).toEqual({ created: false, ...Object.fromEntries(Object.entries(first).filter(([key]) => key !== 'created')) });
    await expect(
      service.confirm(userA, session.id, keyA, {
        draftVersion: session.draftVersion,
        previewToken: 'outro-token',
      }),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
    expect(await prisma.financialTransaction.count({ where: { userId: userA } })).toBe(1);
  });

  it('duas confirmacoes concorrentes com mesma chave retornam resultado canonico sem duplicar', async () => {
    const { service, session, preview } = await readySession(prisma);
    const payload = { draftVersion: session.draftVersion, previewToken: preview.previewToken };
    const results = await Promise.allSettled([
      service.confirm(userA, session.id, keyA, payload),
      service.confirm(userA, session.id, keyA, payload),
    ]);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(0);
    const fulfilled = results as Array<PromiseFulfilledResult<ConfirmedResult>>;
    expect(fulfilled[0]!.value.transactionIds).toEqual(fulfilled[1]!.value.transactionIds);
    expect(await prisma.financialTransaction.count({ where: { userId: userA } })).toBe(1);
    expect(await prisma.importConfirmation.count({ where: { sessionId: session.id } })).toBe(1);
  });

  it('chaves concorrentes distintas produzem um vencedor e um conflito canonico', async () => {
    const { service, session, preview } = await readySession(prisma);
    const payload = { draftVersion: session.draftVersion, previewToken: preview.previewToken };
    const results = await Promise.allSettled([
      service.confirm(userA, session.id, keyB, payload),
      service.confirm(userA, session.id, keyC, payload),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => errorCode(result.reason)),
    ).toEqual(['IMPORT_ALREADY_CONFIRMED']);
    expect(await prisma.financialTransaction.count({ where: { userId: userA } })).toBe(1);
  });

  it('tombstone importado continua bloqueando duplicidade forte sem restaurar lancamento', async () => {
    const { service, session, preview } = await readySession(prisma);
    const confirmed = (await service.confirm(userA, session.id, keyA, {
      draftVersion: session.draftVersion,
      previewToken: preview.previewToken,
    })) as ConfirmedResult;
    await new TransactionsService(prisma as never, config).remove(userA, confirmed.transactionIds[0]!);
    const second = await imports(prisma).create(
      userA,
      { format: 'CSV', accountId: accountA, delimiter: ',' },
      csvFile('date,description,amount,external\n2026-08-13,Mercado,-10.00,E1\n'),
    );
    const mapped = await imports(prisma).mapping(userA, second.id, second.draftVersion, mapping);
    expect(mapped.rows[0]).toMatchObject({
      selected: false,
      validationStatus: 'BLOCKED',
      duplicateClassification: 'STRONG',
    });
    const tombstone = await prisma.financialTransaction.findUniqueOrThrow({
      where: { id: confirmed.transactionIds[0] },
    });
    expect(tombstone.deletedAt).toBeInstanceOf(Date);
    expect(await prisma.financialTransaction.count({ where: { userId: userA } })).toBe(1);
  });

  it('isola owner em leitura, edicao, preview, confirmacao e cancelamento', async () => {
    const { service, session, preview } = await readySession(prisma);
    await expect(service.get(userB, session.id, 100, 0, 'all')).rejects.toMatchObject({
      response: { code: 'IMPORT_NOT_FOUND' },
    });
    await expect(
      service.patchRow(userB, session.id, session.rows[0]!.id, {
        draftVersion: session.draftVersion,
        selected: false,
      }),
    ).rejects.toMatchObject({ response: { code: 'IMPORT_NOT_FOUND' } });
    await expect(service.preview(userB, session.id, session.draftVersion)).rejects.toMatchObject({
      response: { code: 'IMPORT_NOT_FOUND' },
    });
    await expect(
      service.confirm(userB, session.id, keyA, {
        draftVersion: session.draftVersion,
        previewToken: preview.previewToken,
      }),
    ).rejects.toMatchObject({ response: { code: 'IMPORT_NOT_FOUND' } });
    await expect(service.cancel(userB, session.id, session.draftVersion)).rejects.toMatchObject({
      response: { code: 'IMPORT_NOT_FOUND' },
    });
  });

  it('expira drafts sem renovar em leitura e remove somente transitorios antigos', async () => {
    const { service, session } = await readySession(prisma);
    const before = await prisma.importSession.findUniqueOrThrow({ where: { id: session.id } });
    await service.get(userA, session.id, 100, 0, 'all');
    const afterRead = await prisma.importSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(afterRead.expiresAt.toISOString()).toBe(before.expiresAt.toISOString());
    await prisma.importSession.update({
      where: { id: session.id },
      data: { expiresAt: new Date('2026-08-01T00:00:00.000Z'), updatedAt: new Date('2026-08-01T00:00:00.000Z') },
    });
    await service.cleanup(new Date('2026-08-10T00:00:00.000Z'));
    await expect(prisma.importSession.findUnique({ where: { id: session.id } })).resolves.toMatchObject({
      status: 'EXPIRED',
      sourceData: null,
      mapping: null,
      displayFileName: null,
      previewTokenHash: null,
    });
  });
});
