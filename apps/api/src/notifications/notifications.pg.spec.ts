import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const databaseUrl = process.env.SPEC022_DATABASE_URL;
const runPg = Boolean(databaseUrl);
const describePg = runPg ? describe : describe.skip;

const userA = '11111111-1111-4111-8111-111111111122';
const userB = '22222222-2222-4222-8222-222222222222';
const deviceId = 'device_spec022_a';
const otherDeviceId = 'device_spec022_b';
const packageName = 'com.plannerfin.notificationtest';
const otherPackageName = 'com.plannerfin.notificationother';
const keyA = '33333333-3333-4333-8333-333333333322';
const keyB = '44444444-4444-4444-8444-444444444422';
const accountId = '66666666-6666-4666-8666-666666666622';
const expenseCategoryId = '77777777-7777-4777-8777-777777777722';
const incomeCategoryId = '88888888-8888-4888-8888-888888888822';

function db() {
  if (!databaseUrl) throw new Error('SPEC022_DATABASE_URL ausente');
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const allowedHost = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    process.env.SPEC022_ALLOW_DESTRUCTIVE_TESTS !== 'true' ||
    !allowedHost ||
    !databaseName.startsWith('planner_fin_spec022_')
  )
    throw new Error('Use opt-in explicito e banco local sintetico planner_fin_spec022_*.');
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

async function assertSafeDatabase(prisma: PrismaClient) {
  const [{ current_database: databaseName }] = await prisma.$queryRaw<
    Array<{ current_database: string }>
  >`select current_database()`;
  if (!databaseName.startsWith('planner_fin_spec022_'))
    throw new Error('Banco conectado nao e sintetico da SPEC-022.');
}

function service(prisma: PrismaClient) {
  return new NotificationsService(prisma as unknown as PrismaService);
}

async function seed(prisma: PrismaClient) {
  await prisma.notificationIngestConfirmation.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.capturedNotification.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.notificationDevice.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialTransaction.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialCategory.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialAccount.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.userPreferences.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.user.createMany({
    data: [
      {
        id: userA,
        name: 'Pessoa Teste A',
        email: 'spec022-a@example.test',
        normalizedEmail: 'spec022-a@example.test',
        passwordHash: 'synthetic',
        updatedAt: new Date('2026-08-13T19:30:00.000Z'),
      },
      {
        id: userB,
        name: 'Pessoa Teste B',
        email: 'spec022-b@example.test',
        normalizedEmail: 'spec022-b@example.test',
        passwordHash: 'synthetic',
        updatedAt: new Date('2026-08-13T19:30:00.000Z'),
      },
    ],
  });
}

function item(localId = '55555555-5555-4555-8555-555555555522') {
  return {
    localId,
    packageName,
    notificationKeyHash: 'a'.repeat(64),
    postedAt: '2026-08-13T19:31:00.000Z',
    capturedAt: '2026-08-13T19:31:01.000Z',
    title: 'Compra aprovada',
    text: 'Compra de R$ 42,90 em PADARIA EXEMPLO',
    subText: null,
    bigText: null,
    fingerprintVersion: 1 as const,
  };
}

async function seedAccountAndCategory(prisma: PrismaClient, userId: string) {
  await prisma.financialAccount.create({
    data: {
      id: accountId,
      userId,
      name: 'Conta Corrente Teste',
      type: 'CHECKING',
      currency: 'BRL',
      openingBalance: '0.00',
      openingBalanceDate: new Date('2026-01-01T00:00:00.000Z'),
    },
  });
  await prisma.financialCategory.createMany({
    data: [
      {
        id: expenseCategoryId,
        userId,
        name: 'Alimentacao',
        normalizedName: 'alimentacao',
        type: 'EXPENSE',
      },
      {
        id: incomeCategoryId,
        userId,
        name: 'Salario',
        normalizedName: 'salario',
        type: 'INCOME',
      },
    ],
  });
}

describePg('captura de notificacoes com PostgreSQL real', () => {
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

  it('vincula device ao owner e persiste preferencias por device', async () => {
    const device = await service(prisma).bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });

    expect(device).toMatchObject({
      deviceId,
      status: 'ACTIVE',
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    expect(device.ownerBindingId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await service(prisma).list(userB)).toEqual([]);
  });

  it('ingere lote idempotente e nao duplica retry', async () => {
    const svc = service(prisma);
    const device = await svc.bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    const body = { deviceId, ownerBindingId: device.ownerBindingId, items: [item()] };

    const first = await svc.ingest(userA, keyA, body);
    const retry = await svc.ingest(userA, keyA, body);
    const duplicateIdentity = await svc.ingest(userA, keyB, body);

    expect(first).toMatchObject({ createdCount: 1, duplicateCount: 0 });
    expect(retry).toEqual(first);
    expect(duplicateIdentity).toMatchObject({ createdCount: 0, duplicateCount: 1 });
    expect(await prisma.capturedNotification.count({ where: { userId: userA } })).toBe(1);
  });

  it('rejeita idempotency-key reutilizada com payload divergente', async () => {
    const svc = service(prisma);
    const device = await svc.bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    await svc.ingest(userA, keyA, { deviceId, ownerBindingId: device.ownerBindingId, items: [item()] });

    await expect(
      svc.ingest(userA, keyA, {
        deviceId,
        ownerBindingId: device.ownerBindingId,
        items: [{ ...item(), text: 'Payload divergente' }],
      }),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
  });

  it('bloqueia pacote nao monitorado, device revogado e owner cruzado', async () => {
    const svc = service(prisma);
    const device = await svc.bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    await expect(
      svc.ingest(userA, keyA, {
        deviceId,
        ownerBindingId: device.ownerBindingId,
        items: [{ ...item(), packageName: otherPackageName }],
      }),
    ).rejects.toMatchObject({ response: { code: 'NOTIFICATION_PACKAGE_NOT_MONITORED' } });

    await expect(
      svc.ingest(userB, keyA, { deviceId, ownerBindingId: device.ownerBindingId, items: [item()] }),
    ).rejects.toMatchObject({ response: { code: 'NOTIFICATION_DEVICE_NOT_FOUND' } });

    await svc.revoke(userA, device.id);
    await expect(
      svc.ingest(userA, keyB, { deviceId, ownerBindingId: device.ownerBindingId, items: [item()] }),
    ).rejects.toMatchObject({ response: { code: 'NOTIFICATION_DEVICE_REVOKED' } });
  });

  it('purga expirados sem afetar notificacoes validas', async () => {
    const svc = service(prisma);
    const device = await svc.bind(userA, {
      deviceId: otherDeviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    await svc.ingest(userA, keyA, {
      deviceId: otherDeviceId,
      ownerBindingId: device.ownerBindingId,
      items: [item()],
    });
    await prisma.capturedNotification.updateMany({
      where: { userId: userA },
      data: { expiresAt: new Date('2026-08-01T00:00:00.000Z') },
    });
    expect(await svc.purgeExpired(userA, new Date('2026-08-13T19:40:00.000Z'))).toEqual({
      purgedCount: 1,
    });
  });

  it('classifica deterministicamente no momento da ingestao', async () => {
    const svc = service(prisma);
    const device = await svc.bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    await svc.ingest(userA, keyA, { deviceId, ownerBindingId: device.ownerBindingId, items: [item()] });

    const list = await svc.listCaptured(userA, {});
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({
      status: 'FINANCIAL_CANDIDATE',
      parsedType: 'EXPENSE',
      parsedAmount: '42.90',
    });
    expect(list.data[0]!.classificationReasons.length).toBeGreaterThan(0);
  });

  it('lista "para revisar" exclui estados historicos por padrao, mas aceita filtro explicito', async () => {
    const svc = service(prisma);
    await seedAccountAndCategory(prisma, userA);
    const device = await svc.bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    await svc.ingest(userA, keyA, {
      deviceId,
      ownerBindingId: device.ownerBindingId,
      items: [
        item(),
        { ...item('99999999-2222-4222-8222-999999999922'), notificationKeyHash: 'c'.repeat(64) },
      ],
    });
    const [pending, toDismiss] = (await svc.listCaptured(userA, {})).data;
    await svc.dismiss(userA, toDismiss!.id);

    const defaultList = await svc.listCaptured(userA, {});
    expect(defaultList.data.map((row) => row.id)).toEqual([pending!.id]);
    expect(defaultList.page.filteredCount).toBe(1);

    const dismissedOnly = await svc.listCaptured(userA, { status: 'DISMISSED' });
    expect(dismissedOnly.data.map((row) => row.id)).toEqual([toDismiss!.id]);
  });

  it('confirma candidato criando exatamente um lancamento, de forma idempotente', async () => {
    const svc = service(prisma);
    await seedAccountAndCategory(prisma, userA);
    const device = await svc.bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    await svc.ingest(userA, keyA, { deviceId, ownerBindingId: device.ownerBindingId, items: [item()] });
    const [captured] = (await svc.listCaptured(userA, {})).data;

    const confirmDto = {
      accountId,
      categoryId: expenseCategoryId,
      type: 'EXPENSE' as const,
      amount: '42.90',
      description: 'Padaria exemplo',
      date: '2026-08-13',
    };
    const confirmed = await svc.confirm(userA, captured!.id, confirmDto);
    const confirmedAgain = await svc.confirm(userA, captured!.id, confirmDto);

    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.confirmedTransactionId).toBeTruthy();
    expect(confirmedAgain.confirmedTransactionId).toBe(confirmed.confirmedTransactionId);
    expect(
      await prisma.financialTransaction.count({
        where: { userId: userA, description: 'Padaria exemplo' },
      }),
    ).toBe(1);
  });

  it('confirmacoes concorrentes convergem para exatamente um lancamento', async () => {
    const svc = service(prisma);
    await seedAccountAndCategory(prisma, userA);
    const device = await svc.bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    await svc.ingest(userA, keyA, { deviceId, ownerBindingId: device.ownerBindingId, items: [item()] });
    const [captured] = (await svc.listCaptured(userA, {})).data;

    const confirmDto = {
      accountId,
      categoryId: expenseCategoryId,
      type: 'EXPENSE' as const,
      amount: '42.90',
      description: 'Padaria exemplo',
      date: '2026-08-13',
    };
    const [first, second] = await Promise.all([
      svc.confirm(userA, captured!.id, confirmDto),
      svc.confirm(userA, captured!.id, confirmDto),
    ]);

    expect(first.confirmedTransactionId).toBeTruthy();
    expect(second.confirmedTransactionId).toBe(first.confirmedTransactionId);
    expect(
      await prisma.financialTransaction.count({
        where: { userId: userA, description: 'Padaria exemplo' },
      }),
    ).toBe(1);
  });

  it('bloqueia confirmacao sem conta/categoria propria ou compativel', async () => {
    const svc = service(prisma);
    await seedAccountAndCategory(prisma, userA);
    const device = await svc.bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    await svc.ingest(userA, keyA, { deviceId, ownerBindingId: device.ownerBindingId, items: [item()] });
    const [captured] = (await svc.listCaptured(userA, {})).data;

    await expect(
      svc.confirm(userA, captured!.id, {
        accountId: '99999999-9999-4999-8999-999999999999',
        categoryId: expenseCategoryId,
        type: 'EXPENSE',
        amount: '42.90',
        description: 'Padaria exemplo',
        date: '2026-08-13',
      }),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });

    await expect(
      svc.confirm(userA, captured!.id, {
        accountId,
        categoryId: incomeCategoryId,
        type: 'EXPENSE',
        amount: '42.90',
        description: 'Padaria exemplo',
        date: '2026-08-13',
      }),
    ).rejects.toMatchObject({ response: { code: 'CATEGORY_TYPE_MISMATCH' } });
  });

  it('descarte nao cria lancamento e bloqueia confirmacao posterior', async () => {
    const svc = service(prisma);
    await seedAccountAndCategory(prisma, userA);
    const device = await svc.bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    await svc.ingest(userA, keyA, { deviceId, ownerBindingId: device.ownerBindingId, items: [item()] });
    const [captured] = (await svc.listCaptured(userA, {})).data;

    const dismissed = await svc.dismiss(userA, captured!.id);
    expect(dismissed.status).toBe('DISMISSED');
    expect(await prisma.financialTransaction.count({ where: { userId: userA } })).toBe(0);

    await expect(
      svc.confirm(userA, captured!.id, {
        accountId,
        categoryId: expenseCategoryId,
        type: 'EXPENSE',
        amount: '42.90',
        description: 'Padaria exemplo',
        date: '2026-08-13',
      }),
    ).rejects.toMatchObject({ response: { code: 'NOTIFICATION_ALREADY_DISMISSED' } });
  });

  it('marca como nao financeira sem efeito financeiro', async () => {
    const svc = service(prisma);
    const device = await svc.bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    await svc.ingest(userA, keyA, { deviceId, ownerBindingId: device.ownerBindingId, items: [item()] });
    const [captured] = (await svc.listCaptured(userA, {})).data;

    const marked = await svc.markNonFinancial(userA, captured!.id);
    expect(marked.status).toBe('NON_FINANCIAL');
    expect(await prisma.financialTransaction.count({ where: { userId: userA } })).toBe(0);
  });

  it('apaga historico nao confirmado preservando notificacoes confirmadas', async () => {
    const svc = service(prisma);
    await seedAccountAndCategory(prisma, userA);
    const device = await svc.bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    await svc.ingest(userA, keyA, {
      deviceId,
      ownerBindingId: device.ownerBindingId,
      items: [
        item(),
        {
          ...item('99999999-1111-4111-8111-999999999911'),
          notificationKeyHash: 'b'.repeat(64),
        },
      ],
    });
    const [confirmable, other] = (await svc.listCaptured(userA, {})).data;
    await svc.confirm(userA, confirmable!.id, {
      accountId,
      categoryId: expenseCategoryId,
      type: 'EXPENSE',
      amount: '42.90',
      description: 'Padaria exemplo',
      date: '2026-08-13',
    });

    const result = await svc.purgeAllHistory(userA);

    expect(result).toEqual({ purgedCount: 1 });
    expect(await prisma.capturedNotification.findUnique({ where: { id: confirmable!.id } })).not.toBeNull();
    expect(await prisma.capturedNotification.findUnique({ where: { id: other!.id } })).toBeNull();
  });

  it('isola por owner nas novas rotas de revisao', async () => {
    const svc = service(prisma);
    const device = await svc.bind(userA, {
      deviceId,
      captureEnabled: true,
      monitoredPackages: [packageName],
    });
    await svc.ingest(userA, keyA, { deviceId, ownerBindingId: device.ownerBindingId, items: [item()] });
    const [captured] = (await svc.listCaptured(userA, {})).data;

    expect((await svc.listCaptured(userB, {})).data).toEqual([]);
    await expect(svc.getCaptured(userB, captured!.id)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
    await expect(svc.dismiss(userB, captured!.id)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });
});
