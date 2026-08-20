import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { FinancialEntriesService } from './financial-entries.service';

const databaseUrl = process.env.FEED_DATABASE_URL;
const runPg = Boolean(databaseUrl);
const describePg = runPg ? describe : describe.skip;

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const accountA = '33333333-3333-4333-8333-333333333331';
const accountB = '33333333-3333-4333-8333-333333333332';
const categoryExpenseA = '44444444-4444-4444-8444-444444444441';
const categoryIncomeA = '44444444-4444-4444-8444-444444444442';
const categoryB = '44444444-4444-4444-8444-444444444443';
const cardA = '55555555-5555-4555-8555-555555555551';
const cardB = '55555555-5555-4555-8555-555555555552';
const txPaid = '66666666-6666-4666-8666-666666666661';
const txPending = '66666666-6666-4666-8666-666666666662';
const txIncome = '66666666-6666-4666-8666-666666666663';
const txOther = '66666666-6666-4666-8666-666666666664';
const purchase1x = '77777777-7777-4777-8777-777777777771';
const purchase3x = '77777777-7777-4777-8777-777777777772';
const purchaseOther = '77777777-7777-4777-8777-777777777773';
const invoiceOpenFuture = '88888888-8888-4888-8888-888888888881';
const invoiceClosedPastUnpaid = '88888888-8888-4888-8888-888888888882';
const invoicePaidPast = '88888888-8888-4888-8888-888888888883';
const invoiceOther = '88888888-8888-4888-8888-888888888884';
const createdAt = new Date('2026-08-12T10:00:00.000Z');
const config = { jwtSecret: 'x'.repeat(32) } as never;

function db() {
  if (!databaseUrl) throw new Error('FEED_DATABASE_URL ausente');
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const allowedHost = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    process.env.FEED_ALLOW_DESTRUCTIVE_TESTS !== 'true' ||
    !allowedHost ||
    !databaseName.startsWith('planner_fin_feed_')
  )
    throw new Error('Use opt-in explicito e banco local sintetico planner_fin_feed_*.');
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

async function assertSafeDatabase(prisma: PrismaClient) {
  const [{ current_database: databaseName }] = await prisma.$queryRaw<
    Array<{ current_database: string }>
  >`select current_database()`;
  if (!databaseName.startsWith('planner_fin_feed_'))
    throw new Error('Banco conectado nao e sintetico do feed unificado.');
}

function entries(prisma: PrismaClient) {
  return new FinancialEntriesService(prisma as unknown as PrismaService, config);
}

async function seed(prisma: PrismaClient) {
  await prisma.cardInvoicePayment.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.cardInstallment.deleteMany({
    where: { purchase: { userId: { in: [userA, userB] } } },
  });
  await prisma.cardInvoice.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.cardPurchase.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialCreditCard.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialTransaction.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialAccount.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialCategory.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });

  await prisma.user.createMany({
    data: [
      {
        id: userA,
        name: 'Pessoa Teste A',
        email: 'feed-a@example.test',
        normalizedEmail: 'feed-a@example.test',
        passwordHash: 'synthetic',
        updatedAt: createdAt,
      },
      {
        id: userB,
        name: 'Pessoa Teste B',
        email: 'feed-b@example.test',
        normalizedEmail: 'feed-b@example.test',
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
        id: categoryExpenseA,
        userId: userA,
        name: 'Moradia',
        normalizedName: 'moradia',
        type: 'EXPENSE',
        updatedAt: createdAt,
      },
      {
        id: categoryIncomeA,
        userId: userA,
        name: 'Salário',
        normalizedName: 'salario',
        type: 'INCOME',
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
  await prisma.financialCreditCard.createMany({
    data: [
      {
        id: cardA,
        userId: userA,
        name: 'Nubank',
        closingDay: 10,
        dueDay: 17,
        updatedAt: createdAt,
      },
      {
        id: cardB,
        userId: userB,
        name: 'Cartão alheio',
        closingDay: 10,
        dueDay: 17,
        updatedAt: createdAt,
      },
    ],
  });
  await prisma.financialTransaction.createMany({
    data: [
      {
        id: txPaid,
        userId: userA,
        accountId: accountA,
        categoryId: categoryExpenseA,
        type: 'EXPENSE',
        status: 'PAID',
        description: 'Conta paga',
        plannedAmount: new Prisma.Decimal('100.00'),
        actualAmount: new Prisma.Decimal('90.00'),
        dueDate: new Date('2020-01-10T00:00:00.000Z'),
        paidAt: new Date('2020-01-10T00:00:00.000Z'),
      },
      {
        id: txPending,
        userId: userA,
        accountId: accountA,
        categoryId: categoryExpenseA,
        type: 'EXPENSE',
        status: 'PENDING',
        description: 'Conta pendente vencida',
        plannedAmount: new Prisma.Decimal('50.00'),
        dueDate: new Date('2020-01-11T00:00:00.000Z'),
      },
      {
        id: txIncome,
        userId: userA,
        accountId: accountA,
        categoryId: categoryIncomeA,
        type: 'INCOME',
        status: 'PENDING',
        description: 'Salário futuro',
        plannedAmount: new Prisma.Decimal('3000.00'),
        dueDate: new Date('2099-01-05T00:00:00.000Z'),
      },
      {
        id: txOther,
        userId: userB,
        accountId: accountB,
        categoryId: categoryB,
        type: 'EXPENSE',
        status: 'PENDING',
        description: 'Alheio',
        plannedAmount: new Prisma.Decimal('10.00'),
        dueDate: new Date('2020-01-11T00:00:00.000Z'),
      },
    ],
  });
  await prisma.cardInvoice.createMany({
    data: [
      {
        id: invoiceOpenFuture,
        userId: userA,
        cardId: cardA,
        referenceMonth: '2099-02',
        closingDate: new Date('2099-02-10T00:00:00.000Z'),
        dueDate: new Date('2099-02-17T00:00:00.000Z'),
        status: 'OPEN',
      },
      {
        id: invoiceClosedPastUnpaid,
        userId: userA,
        cardId: cardA,
        referenceMonth: '2020-03',
        closingDate: new Date('2020-03-10T00:00:00.000Z'),
        dueDate: new Date('2020-03-17T00:00:00.000Z'),
        status: 'CLOSED',
        closedAt: createdAt,
      },
      {
        id: invoicePaidPast,
        userId: userA,
        cardId: cardA,
        referenceMonth: '2020-04',
        closingDate: new Date('2020-04-10T00:00:00.000Z'),
        dueDate: new Date('2020-04-17T00:00:00.000Z'),
        status: 'PAID',
        closedAt: createdAt,
        paidAt: createdAt,
      },
      {
        id: invoiceOther,
        userId: userB,
        cardId: cardB,
        referenceMonth: '2099-02',
        closingDate: new Date('2099-02-10T00:00:00.000Z'),
        dueDate: new Date('2099-02-17T00:00:00.000Z'),
        status: 'OPEN',
      },
    ],
  });
  await prisma.cardPurchase.createMany({
    data: [
      {
        id: purchase1x,
        userId: userA,
        cardId: cardA,
        categoryId: categoryExpenseA,
        description: 'Abastecimento',
        purchaseDate: new Date('2099-01-20T00:00:00.000Z'),
        totalAmount: new Prisma.Decimal('150.00'),
        installmentCount: 1,
      },
      {
        id: purchase3x,
        userId: userA,
        cardId: cardA,
        categoryId: categoryExpenseA,
        description: 'Notebook',
        purchaseDate: new Date('2020-02-20T00:00:00.000Z'),
        totalAmount: new Prisma.Decimal('300.00'),
        installmentCount: 3,
      },
      {
        id: purchaseOther,
        userId: userB,
        cardId: cardB,
        categoryId: categoryB,
        description: 'Compra alheia',
        purchaseDate: new Date('2099-01-20T00:00:00.000Z'),
        totalAmount: new Prisma.Decimal('20.00'),
        installmentCount: 1,
      },
    ],
  });
  await prisma.cardInstallment.createMany({
    data: [
      {
        purchaseId: purchase1x,
        installmentNumber: 1,
        installmentCount: 1,
        amount: new Prisma.Decimal('150.00'),
        referenceMonth: '2099-02',
        invoiceId: invoiceOpenFuture,
      },
      {
        purchaseId: purchase3x,
        installmentNumber: 1,
        installmentCount: 3,
        amount: new Prisma.Decimal('100.00'),
        referenceMonth: '2020-03',
        invoiceId: invoiceClosedPastUnpaid,
      },
      {
        purchaseId: purchase3x,
        installmentNumber: 2,
        installmentCount: 3,
        amount: new Prisma.Decimal('100.00'),
        referenceMonth: '2020-04',
        invoiceId: invoicePaidPast,
      },
      {
        purchaseId: purchase3x,
        installmentNumber: 3,
        installmentCount: 3,
        amount: new Prisma.Decimal('100.00'),
        referenceMonth: '2099-02',
        invoiceId: invoiceOpenFuture,
      },
      {
        purchaseId: purchaseOther,
        installmentNumber: 1,
        installmentCount: 1,
        amount: new Prisma.Decimal('20.00'),
        referenceMonth: '2099-02',
        invoiceId: invoiceOther,
      },
    ],
  });
  await prisma.cardInvoicePayment.create({
    data: {
      userId: userA,
      invoiceId: invoicePaidPast,
      accountId: accountA,
      amount: new Prisma.Decimal('100.00'),
      paymentDate: createdAt,
    },
  });
}

describePg('feed unificado de lançamentos com PostgreSQL real', () => {
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

  it('une FinancialTransaction e CardPurchase sem incluir CardInvoicePayment', async () => {
    const service = entries(prisma);
    const page = await service.list(userA, {});
    const sources = page.data.map((e) => `${e.source}:${e.sourceId}`).sort();
    expect(sources).toEqual(
      [
        `CARD_PURCHASE:${purchase1x}`,
        `CARD_PURCHASE:${purchase3x}`,
        `TRANSACTION:${txPaid}`,
        `TRANSACTION:${txPending}`,
        `TRANSACTION:${txIncome}`,
      ].sort(),
    );
    expect(page.data).toHaveLength(5);
    expect(sources.some((s) => s.includes('CardInvoicePayment'))).toBe(false);
  });

  it('nunca mistura dados de outro usuário', async () => {
    const service = entries(prisma);
    const page = await service.list(userA, {});
    expect(page.data.some((e) => e.sourceId === txOther)).toBe(false);
    expect(page.data.some((e) => e.purchaseId === purchaseOther)).toBe(false);
  });

  it('resolve transacoes por status e compras por totalAmount canonico', async () => {
    const service = entries(prisma);
    const page = await service.list(userA, { dueDateFrom: '2020-01-01', dueDateTo: '2020-02-29' });
    const paid = page.data.find((e) => e.sourceId === txPaid)!;
    const pending = page.data.find((e) => e.sourceId === txPending)!;
    const purchase = page.data.find((e) => e.sourceId === purchase3x)!;
    expect(paid.amount).toBe('90.00');
    expect(pending.amount).toBe('50.00');
    expect(purchase.amount).toBe('300.00');
  });

  it('compra a vista e compra 3x viram uma linha cada por purchaseDate', async () => {
    const service = entries(prisma);
    const page1x = await service.list(userA, { dueDateFrom: '2099-01-01', dueDateTo: '2099-01-31' });
    const page3x = await service.list(userA, { dueDateFrom: '2020-02-01', dueDateTo: '2020-02-29' });
    const one = page1x.data.find((e) => e.sourceId === purchase1x)!;
    const three = page3x.data.find((e) => e.sourceId === purchase3x)!;
    expect(page1x.data.filter((e) => e.source === 'CARD_PURCHASE')).toHaveLength(1);
    expect(page3x.data.filter((e) => e.source === 'CARD_PURCHASE')).toHaveLength(1);
    expect(one.amount).toBe('150.00');
    expect(one.date).toBe('2099-01-20');
    expect(one.installmentCount).toBe(1);
    expect(three.amount).toBe('300.00');
    expect(three.date).toBe('2020-02-20');
    expect(three.installmentCount).toBe(3);
    expect(three.installmentNumber).toBeNull();
  });

  it('rotula compra de cartao com cardName e purchaseId sem numeracao 1/3', async () => {
    const service = entries(prisma);
    const page = await service.list(userA, { dueDateFrom: '2020-02-01', dueDateTo: '2020-02-29' });
    const purchase = page.data.find((e) => e.source === 'CARD_PURCHASE')!;
    expect(purchase.cardName).toBe('Nubank');
    expect(purchase.purchaseId).toBe(purchase3x);
    expect(purchase.accountId).toBeNull();
    expect(purchase.status).toBeNull();
    expect(purchase.type).toBe('EXPENSE');
    expect(purchase.overdue).toBe(false);
  });

  it('filtro de conta exclui compras de cartao sem inventar dado', async () => {
    const service = entries(prisma);
    const page = await service.list(userA, { accountId: accountA });
    expect(page.data.every((e) => e.source === 'TRANSACTION')).toBe(true);
    expect(page.data).toHaveLength(3);
  });

  it('filtro de status exclui compras de cartao sem inventar dado', async () => {
    const service = entries(prisma);
    const page = await service.list(userA, { status: 'PENDING' });
    expect(page.data.every((e) => e.source === 'TRANSACTION')).toBe(true);
    expect(page.data.map((e) => e.sourceId).sort()).toEqual([txIncome, txPending].sort());
  });

  it('filtro de data de pagamento exclui compras de cartao sem inventar dado', async () => {
    const service = entries(prisma);
    const page = await service.list(userA, { paidAtFrom: '2020-01-01', paidAtTo: '2020-01-31' });
    expect(page.data).toHaveLength(1);
    expect(page.data[0]!.source).toBe('TRANSACTION');
    expect(page.data[0]!.sourceId).toBe(txPaid);
  });

  it('filtro type=INCOME exclui compras de cartao pois sao sempre despesa', async () => {
    const service = entries(prisma);
    const page = await service.list(userA, { type: 'INCOME' });
    expect(page.data.map((e) => e.sourceId)).toEqual([txIncome]);
  });

  it('filtro de categoria se aplica às duas fontes', async () => {
    const service = entries(prisma);
    const page = await service.list(userA, { categoryId: categoryExpenseA });
    expect(page.data.every((e) => e.categoryId === categoryExpenseA)).toBe(true);
    expect(page.data.some((e) => e.source === 'TRANSACTION')).toBe(true);
    expect(page.data.some((e) => e.source === 'CARD_PURCHASE')).toBe(true);
    expect(page.data.some((e) => e.sourceId === txIncome)).toBe(false);
  });

  it('pagina globalmente sem duplicar nem pular itens, com ordenação estável', async () => {
    const service = entries(prisma);
    const seen = new Set<string>();
    let cursor: string | null = null;
    let guard = 0;
    do {
      const page = await service.list(userA, { limit: '2', ...(cursor ? { cursor } : {}) });
      expect(page.data.length).toBeLessThanOrEqual(2);
      for (const entry of page.data) {
        expect(seen.has(entry.id)).toBe(false);
        seen.add(entry.id);
      }
      const dates = page.data.map((e) => e.date);
      expect(dates).toEqual([...dates].sort().reverse());
      cursor = page.page.nextCursor;
      guard++;
    } while (cursor && guard < 20);
    expect(seen.size).toBe(5);
  });

  it('rejeita cursor com fingerprint de outra consulta', async () => {
    const service = entries(prisma);
    const page = await service.list(userA, { limit: '1' });
    await expect(
      service.list(userA, { limit: '2', cursor: page.page.nextCursor! }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_CURSOR' } });
  });
});
