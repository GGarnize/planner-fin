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
});
