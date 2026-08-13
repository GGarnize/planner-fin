import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { UserPreferencesService } from './preferences.service';

const databaseUrl = process.env.SPEC018_DATABASE_URL;
const runPg = Boolean(databaseUrl);
const describePg = runPg ? describe : describe.skip;

const userA = '11111111-1111-4111-8111-111111111118';
const userB = '22222222-2222-4222-8222-222222222228';
const createdAt = new Date('2026-08-12T10:00:00.000Z');

function db() {
  if (!databaseUrl) throw new Error('SPEC018_DATABASE_URL ausente');
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const allowedHost = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    process.env.SPEC018_ALLOW_DESTRUCTIVE_TESTS !== 'true' ||
    !allowedHost ||
    !databaseName.startsWith('planner_fin_spec018_')
  )
    throw new Error('Use opt-in explicito e banco local sintetico planner_fin_spec018_*.');
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

async function assertSafeDatabase(prisma: PrismaClient) {
  const [{ current_database: databaseName }] = await prisma.$queryRaw<
    Array<{ current_database: string }>
  >`select current_database()`;
  if (!databaseName.startsWith('planner_fin_spec018_'))
    throw new Error('Banco conectado nao e sintetico da SPEC-018.');
}

function service(prisma: PrismaClient) {
  return new UserPreferencesService(prisma as unknown as PrismaService);
}

async function seed(prisma: PrismaClient) {
  await prisma.userPreferences.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.user.createMany({
    data: [
      {
        id: userA,
        name: 'Pessoa Teste A',
        email: 'spec018-a@example.test',
        normalizedEmail: 'spec018-a@example.test',
        passwordHash: 'synthetic',
        updatedAt: createdAt,
      },
      {
        id: userB,
        name: 'Pessoa Teste B',
        email: 'spec018-b@example.test',
        normalizedEmail: 'spec018-b@example.test',
        passwordHash: 'synthetic',
        updatedAt: createdAt,
      },
    ],
  });
}

describePg('preferencias visuais com PostgreSQL real', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = db();
    await assertSafeDatabase(prisma);
  });

  beforeEach(async () => {
    await seed(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('materializa defaults canonicos para usuario legado', async () => {
    const result = await service(prisma).get(userA);
    expect(result).toMatchObject({ appearance: 'SYSTEM', accent: 'BLUE' });
    expect(await prisma.userPreferences.count({ where: { userId: userA } })).toBe(1);
  });

  it('mantem owner 1:1 real e isolamento por usuario', async () => {
    await service(prisma).patch(userA, { appearance: 'DARK', accent: 'PURPLE' });
    await service(prisma).patch(userB, { appearance: 'LIGHT', accent: 'TEAL' });

    await expect(
      prisma.userPreferences.create({
        data: { userId: userA, appearance: 'SYSTEM', accent: 'BLUE' },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await expect(
      prisma.userPreferences.create({
        data: {
          userId: '33333333-3333-4333-8333-333333333338',
          appearance: 'SYSTEM',
          accent: 'BLUE',
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);

    expect(await service(prisma).get(userA)).toMatchObject({
      appearance: 'DARK',
      accent: 'PURPLE',
    });
    expect(await service(prisma).get(userB)).toMatchObject({
      appearance: 'LIGHT',
      accent: 'TEAL',
    });
  });

  it('aplica last-write-wins e updatedAt da confirmacao do servidor', async () => {
    const first = await service(prisma).patch(userA, { appearance: 'DARK' });
    const second = await service(prisma).patch(userA, { appearance: 'SYSTEM', accent: 'ORANGE' });

    expect(await service(prisma).get(userA)).toMatchObject({
      appearance: 'SYSTEM',
      accent: 'ORANGE',
    });
    expect(new Date(second.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.updatedAt).getTime(),
    );
  });
});
