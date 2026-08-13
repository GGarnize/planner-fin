import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { InitialSetupDraft } from '@planner-fin/shared';
import type { PrismaService } from '../prisma/prisma.service';
import { InitialSetupService } from './setup.service';

const databaseUrl = process.env.SPEC019_DATABASE_URL;
const runPg = Boolean(databaseUrl);
const describePg = runPg ? describe : describe.skip;

const userA = '11111111-1111-4111-8111-111111111119';
const userB = '22222222-2222-4222-8222-222222222229';
const createdAt = new Date('2026-08-13T10:00:00.000Z');
const keyA = '33333333-3333-4333-8333-333333333339';
const keyB = '44444444-4444-4444-8444-444444444449';

const draft: InitialSetupDraft = {
  step: 'REVIEW',
  account: {
    name: 'Conta principal',
    type: 'CHECKING',
    openingBalance: null,
    openingBalanceDate: '2026-08-13',
  },
  categories: [
    { key: 'income', name: 'Renda', type: 'INCOME', icon: 'WORK', selected: true },
    { key: 'food', name: 'Alimentacao', type: 'EXPENSE', icon: 'RESTAURANT', selected: true },
  ],
};

function db() {
  if (!databaseUrl) throw new Error('SPEC019_DATABASE_URL ausente');
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const allowedHost = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    process.env.SPEC019_ALLOW_DESTRUCTIVE_TESTS !== 'true' ||
    !allowedHost ||
    !databaseName.startsWith('planner_fin_spec019_')
  )
    throw new Error('Use opt-in explicito e banco local sintetico planner_fin_spec019_*.');
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

async function assertSafeDatabase(prisma: PrismaClient) {
  const [{ current_database: databaseName }] = await prisma.$queryRaw<
    Array<{ current_database: string }>
  >`select current_database()`;
  if (!databaseName.startsWith('planner_fin_spec019_'))
    throw new Error('Banco conectado nao e sintetico da SPEC-019.');
}

function service(prisma: PrismaClient) {
  return new InitialSetupService(prisma as unknown as PrismaService);
}

async function seed(prisma: PrismaClient) {
  await prisma.setupConfirmation.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.userInitialSetup.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialTransaction.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialAccount.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialCategory.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.userPreferences.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.user.createMany({
    data: [
      {
        id: userA,
        name: 'Pessoa Teste A',
        email: 'spec019-a@example.test',
        normalizedEmail: 'spec019-a@example.test',
        passwordHash: 'synthetic',
        updatedAt: createdAt,
      },
      {
        id: userB,
        name: 'Pessoa Teste B',
        email: 'spec019-b@example.test',
        normalizedEmail: 'spec019-b@example.test',
        passwordHash: 'synthetic',
        updatedAt: createdAt,
      },
    ],
  });
  await prisma.userInitialSetup.createMany({
    data: [{ userId: userA }, { userId: userB }],
  });
}

describePg('setup inicial opcional com PostgreSQL real', () => {
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

  it('migration cria estado, draft versionado e confirmacao idempotente por usuario', async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      select column_name
      from information_schema.columns
      where table_name = 'UserInitialSetup'
      order by column_name
    `;
    expect(columns.map((row) => row.column_name)).toEqual(
      expect.arrayContaining(['userId', 'status', 'draft', 'draftVersion', 'previewTokenHash']),
    );
    await prisma.setupConfirmation.create({
      data: { userId: userA, idempotencyKey: keyA, payloadHash: 'a'.repeat(64), result: {} },
    });
    await expect(
      prisma.setupConfirmation.create({
        data: { userId: userA, idempotencyKey: keyA, payloadHash: 'b'.repeat(64), result: {} },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await expect(
      prisma.setupConfirmation.create({
        data: { userId: userB, idempotencyKey: keyA, payloadHash: 'c'.repeat(64), result: {} },
      }),
    ).resolves.toBeTruthy();
  });

  it('confirma tudo-ou-nada, retry nao duplica e respeita isolamento por usuario', async () => {
    const setup = service(prisma);
    await setup.saveDraft(userA, 0, draft);
    const preview = await setup.preview(userA, 1);

    const first = await setup.confirm(userA, preview.previewToken, keyA);
    const retry = await setup.confirm(userA, preview.previewToken, keyA);

    expect(first).toMatchObject({ statusCode: 201, status: 'COMPLETED', created: { accounts: 1 } });
    expect(retry).toMatchObject({ statusCode: 200, status: 'COMPLETED', created: { accounts: 1 } });
    expect(await prisma.financialAccount.count({ where: { userId: userA } })).toBe(1);
    expect(await prisma.financialCategory.count({ where: { userId: userA } })).toBe(2);
    expect(await prisma.financialAccount.count({ where: { userId: userB } })).toBe(0);
    expect(await setup.get(userA)).toMatchObject({ status: 'COMPLETED', eligible: false });
    expect(await setup.get(userB)).toMatchObject({ status: 'NOT_STARTED', eligible: true });
  });

  it('rollback em conflito externo nao cria categoria nem marca completed', async () => {
    const setup = service(prisma);
    await setup.saveDraft(userA, 0, draft);
    const preview = await setup.preview(userA, 1);
    await prisma.financialAccount.create({
      data: {
        userId: userA,
        name: 'Conta externa',
        type: 'CHECKING',
        currency: 'BRL',
        openingBalance: new Prisma.Decimal('0.00'),
        openingBalanceDate: new Date('2026-08-13T00:00:00.000Z'),
      },
    });

    await expect(setup.confirm(userA, preview.previewToken, keyB)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SETUP_DATA_CONFLICT' }),
    });
    expect(await prisma.financialAccount.count({ where: { userId: userA } })).toBe(1);
    expect(await prisma.financialCategory.count({ where: { userId: userA } })).toBe(0);
    expect(await setup.get(userA)).toMatchObject({ status: 'NOT_STARTED', eligible: false });
  });
});
