import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { TransactionTemplatesService } from './transaction-templates.service';

const databaseUrl = process.env.SPEC014_DATABASE_URL;
const runPg = Boolean(databaseUrl);
const describePg = runPg ? describe : describe.skip;

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const expenseCategoryA = '33333333-3333-4333-8333-333333333331';
const incomeCategoryA = '33333333-3333-4333-8333-333333333332';
const archivedCategoryA = '33333333-3333-4333-8333-333333333333';
const expenseCategoryB = '33333333-3333-4333-8333-333333333334';
const accountA = '44444444-4444-4444-8444-444444444441';
const accountB = '44444444-4444-4444-8444-444444444442';
const archivedAccountA = '44444444-4444-4444-8444-444444444443';
const missingUser = '55555555-5555-4555-8555-555555555555';
const createdAt = new Date('2026-08-11T10:00:00.000Z');
const archivedAt = new Date('2026-08-11T11:00:00.000Z');

function db() {
  if (!databaseUrl) throw new Error('SPEC014_DATABASE_URL ausente');
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const allowedHost = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    process.env.SPEC014_ALLOW_DESTRUCTIVE_TESTS !== 'true' ||
    !allowedHost ||
    !databaseName.startsWith('planner_fin_spec014_')
  )
    throw new Error('Use opt-in explicito e banco local sintetico planner_fin_spec014_*.');
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

async function assertSafeDatabase(prisma: PrismaClient) {
  const [{ current_database: databaseName }] = await prisma.$queryRaw<
    Array<{ current_database: string }>
  >`select current_database()`;
  if (!databaseName.startsWith('planner_fin_spec014_'))
    throw new Error('Banco conectado nao e sintetico da SPEC-014.');
}

function service(prisma: PrismaClient) {
  return new TransactionTemplatesService(prisma as unknown as PrismaService);
}

async function seed(prisma: PrismaClient) {
  await prisma.transactionTemplate.deleteMany();
  await prisma.financialAccount.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.financialCategory.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.user.createMany({
    data: [
      {
        id: userA,
        name: 'Pessoa Teste A',
        email: 'spec014-a@example.test',
        normalizedEmail: 'spec014-a@example.test',
        passwordHash: 'synthetic',
        updatedAt: createdAt,
      },
      {
        id: userB,
        name: 'Pessoa Teste B',
        email: 'spec014-b@example.test',
        normalizedEmail: 'spec014-b@example.test',
        passwordHash: 'synthetic',
        updatedAt: createdAt,
      },
    ],
  });
  await prisma.financialCategory.createMany({
    data: [
      {
        id: expenseCategoryA,
        userId: userA,
        name: 'Moradia',
        normalizedName: 'moradia',
        type: 'EXPENSE',
        updatedAt: createdAt,
      },
      {
        id: incomeCategoryA,
        userId: userA,
        name: 'Salario',
        normalizedName: 'salario',
        type: 'INCOME',
        updatedAt: createdAt,
      },
      {
        id: archivedCategoryA,
        userId: userA,
        name: 'Categoria Arquivada',
        normalizedName: 'categoria arquivada',
        type: 'EXPENSE',
        archivedAt,
        updatedAt: createdAt,
      },
      {
        id: expenseCategoryB,
        userId: userB,
        name: 'Moradia',
        normalizedName: 'moradia',
        type: 'EXPENSE',
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
        openingBalance: new Prisma.Decimal('0.00'),
        openingBalanceDate: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: createdAt,
      },
      {
        id: accountB,
        userId: userB,
        name: 'Conta B',
        type: 'CHECKING',
        currency: 'BRL',
        openingBalance: new Prisma.Decimal('0.00'),
        openingBalanceDate: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: createdAt,
      },
      {
        id: archivedAccountA,
        userId: userA,
        name: 'Conta Arquivada',
        type: 'CHECKING',
        currency: 'BRL',
        openingBalance: new Prisma.Decimal('0.00'),
        openingBalanceDate: new Date('2026-01-01T00:00:00.000Z'),
        archivedAt,
        updatedAt: createdAt,
      },
    ],
  });
}

async function createTemplate(
  prisma: PrismaClient,
  id: string,
  overrides: Partial<Prisma.TransactionTemplateUncheckedCreateInput> = {},
) {
  return prisma.transactionTemplate.create({
    data: {
      id,
      userId: userA,
      name: 'Aluguel',
      normalizedName: 'aluguel',
      type: 'EXPENSE',
      categoryId: expenseCategoryA,
      description: 'Moradia',
      plannedAmount: new Prisma.Decimal('1800.00'),
      defaultAccountId: accountA,
      notes: null,
      dueDay: 10,
      updatedAt: createdAt,
      ...overrides,
    },
  });
}

async function expectRejectsWithCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ response: { code } });
}

async function expectPrismaError(
  promise: Promise<unknown>,
  code: string,
): Promise<Prisma.PrismaClientKnownRequestError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const known = error as Prisma.PrismaClientKnownRequestError;
    expect(known.code).toBe(code);
    return known;
  }
  throw new Error(`Esperava erro Prisma ${code}`);
}

describePg('modelos de lancamento com PostgreSQL real', () => {
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

  it('aplica constraints reais de valor, precisao Decimal, dueDay, unique e FKs', async () => {
    await expect(
      createTemplate(prisma, '66666666-6666-4666-8666-666666666660', {
        plannedAmount: new Prisma.Decimal('0.00'),
      }),
    ).rejects.toThrow();
    await expect(
      createTemplate(prisma, '66666666-6666-4666-8666-666666666661', {
        plannedAmount: new Prisma.Decimal('-1.00'),
      }),
    ).rejects.toThrow();
    await expect(
      createTemplate(prisma, '66666666-6666-4666-8666-666666666669', {
        plannedAmount: new Prisma.Decimal('100000000000000000.00'),
      }),
    ).rejects.toThrow();
    await createTemplate(prisma, '66666666-6666-4666-8666-666666666659', {
      plannedAmount: new Prisma.Decimal('99999999999999999.99'),
      dueDay: 1,
    });
    await createTemplate(prisma, '66666666-6666-4666-8666-666666666658', {
      name: 'Condominio',
      normalizedName: 'condominio',
      dueDay: 31,
    });
    await expect(
      createTemplate(prisma, '66666666-6666-4666-8666-666666666662', {
        name: 'Dia Zero',
        normalizedName: 'dia zero',
        dueDay: 0,
      }),
    ).rejects.toThrow();
    await expect(
      createTemplate(prisma, '66666666-6666-4666-8666-666666666663', {
        name: 'Dia Trinta e Dois',
        normalizedName: 'dia trinta e dois',
        dueDay: 32,
      }),
    ).rejects.toThrow();
    await createTemplate(prisma, '66666666-6666-4666-8666-666666666664', {
      name: 'Maior Valor',
      normalizedName: 'maior valor',
      plannedAmount: new Prisma.Decimal('12345678901234567.89'),
      dueDay: null,
    });
    await expect(
      createTemplate(prisma, '66666666-6666-4666-8666-666666666665', {
        name: 'ALUGUEL',
        normalizedName: 'aluguel',
      }),
    ).rejects.toThrow();
    await expect(
      createTemplate(prisma, '66666666-6666-4666-8666-666666666666', { userId: missingUser }),
    ).rejects.toThrow();
    await expect(
      createTemplate(prisma, '66666666-6666-4666-8666-666666666667', {
        categoryId: '77777777-7777-4777-8777-777777777777',
      }),
    ).rejects.toThrow();
    await expect(
      createTemplate(prisma, '66666666-6666-4666-8666-666666666668', {
        defaultAccountId: '88888888-8888-4888-8888-888888888888',
      }),
    ).rejects.toThrow();
  });

  it('bloqueia hard delete de user, categoria e conta referenciados por FK RESTRICT', async () => {
    await createTemplate(prisma, '66666666-6666-4666-8666-666666666650');
    await expect(
      prisma.financialCategory.delete({ where: { id: expenseCategoryA } }),
    ).rejects.toThrow();
    await expect(prisma.financialAccount.delete({ where: { id: accountA } })).rejects.toThrow();
    await expect(prisma.user.delete({ where: { id: userA } })).rejects.toThrow();
  });

  it('isola owner, normaliza nome e traduz conflito equivalente', async () => {
    const templates = service(prisma);
    const created = await templates.create(userA, {
      name: 'Aluguel',
      type: 'EXPENSE',
      categoryId: expenseCategoryA,
      description: 'Moradia',
      plannedAmount: '1800.00',
      defaultAccountId: accountA,
      notes: '',
      dueDay: 10,
    });
    expect(created).toMatchObject({
      name: 'Aluguel',
      plannedAmount: '1800.00',
      notes: null,
      defaultAccountAvailable: true,
    });
    await expectRejectsWithCode(
      templates.create(userA, {
        name: 'aluguel',
        type: 'EXPENSE',
        categoryId: expenseCategoryA,
        description: 'Outro',
        plannedAmount: '1.00',
      }),
      'TEMPLATE_NAME_CONFLICT',
    );
    const rawDuplicateError = await expectPrismaError(
      createTemplate(prisma, '66666666-6666-4666-8666-666666666657', {
        name: 'ALUGUEL',
        normalizedName: 'aluguel',
      }),
      'P2002',
    );
    expect(rawDuplicateError.meta?.target).toEqual(['userId', 'normalizedName']);
    await expect(
      templates.create(userB, {
        name: 'aluguel',
        type: 'EXPENSE',
        categoryId: expenseCategoryB,
        description: 'Outro owner',
        plannedAmount: '1.00',
        defaultAccountId: accountB,
      }),
    ).resolves.toMatchObject({ name: 'aluguel' });
  });

  it('devolve 404 indistinguivel para recurso alheio em leitura, update, archive e restore', async () => {
    const templates = service(prisma);
    const created = await templates.create(userA, {
      name: 'Energia',
      type: 'EXPENSE',
      categoryId: expenseCategoryA,
      description: 'Conta de energia',
      plannedAmount: '200.00',
    });
    expect(await templates.list(userB, true)).toHaveLength(0);
    await expectRejectsWithCode(templates.get(userB, created.id), 'TEMPLATE_NOT_FOUND');
    await expectRejectsWithCode(
      templates.update(userB, created.id, { description: 'Indevido' }),
      'TEMPLATE_NOT_FOUND',
    );
    await expectRejectsWithCode(templates.archive(userB, created.id), 'TEMPLATE_NOT_FOUND');
    await templates.archive(userA, created.id);
    await expectRejectsWithCode(templates.restore(userB, created.id), 'TEMPLATE_NOT_FOUND');
    await expectRejectsWithCode(templates.get(userA, 'uuid-invalido'), 'TEMPLATE_NOT_FOUND');
  });

  it('valida categoria, conta padrao e referencias arquivadas conforme owner', async () => {
    const templates = service(prisma);
    await expectRejectsWithCode(
      templates.create(userA, {
        name: 'Receita errada',
        type: 'EXPENSE',
        categoryId: incomeCategoryA,
        description: 'Incompativel',
        plannedAmount: '1.00',
      }),
      'CATEGORY_TYPE_MISMATCH',
    );
    await expectRejectsWithCode(
      templates.create(userA, {
        name: 'Categoria alheia',
        type: 'EXPENSE',
        categoryId: expenseCategoryB,
        description: 'Alheia',
        plannedAmount: '1.00',
      }),
      'RELATED_RESOURCE_NOT_FOUND',
    );
    await expectRejectsWithCode(
      templates.create(userA, {
        name: 'Conta alheia',
        type: 'EXPENSE',
        categoryId: expenseCategoryA,
        description: 'Alheia',
        plannedAmount: '1.00',
        defaultAccountId: accountB,
      }),
      'RELATED_RESOURCE_NOT_FOUND',
    );
    await expectRejectsWithCode(
      templates.create(userA, {
        name: 'Categoria arquivada',
        type: 'EXPENSE',
        categoryId: archivedCategoryA,
        description: 'Arquivada',
        plannedAmount: '1.00',
      }),
      'RELATED_RESOURCE_ARCHIVED',
    );
    await expectRejectsWithCode(
      templates.create(userA, {
        name: 'Conta arquivada',
        type: 'EXPENSE',
        categoryId: expenseCategoryA,
        description: 'Arquivada',
        plannedAmount: '1.00',
        defaultAccountId: archivedAccountA,
      }),
      'RELATED_RESOURCE_ARCHIVED',
    );
    const created = await templates.create(userA, {
      name: 'Sem conta',
      type: 'EXPENSE',
      categoryId: expenseCategoryA,
      description: 'Sem conta padrao',
      plannedAmount: '1.00',
      defaultAccountId: null,
    });
    expect(created).toMatchObject({ defaultAccountId: null, defaultAccountAvailable: false });
  });

  it('restaura modelo com referencias arquivadas e preserva availability false', async () => {
    const templates = service(prisma);
    const created = await templates.create(userA, {
      name: 'Condominio',
      type: 'EXPENSE',
      categoryId: expenseCategoryA,
      description: 'Predio',
      plannedAmount: '500.00',
      defaultAccountId: accountA,
    });
    await templates.archive(userA, created.id);
    await prisma.financialCategory.update({
      where: { id: expenseCategoryA },
      data: { archivedAt },
    });
    await prisma.financialAccount.update({ where: { id: accountA }, data: { archivedAt } });
    const restored = await templates.restore(userA, created.id);
    expect(restored).toMatchObject({
      categoryId: expenseCategoryA,
      categoryAvailable: false,
      defaultAccountId: accountA,
      defaultAccountAvailable: false,
      archivedAt: null,
    });
    await prisma.financialCategory.update({
      where: { id: expenseCategoryA },
      data: { archivedAt: null },
    });
    const patched = await templates.update(userA, created.id, { defaultAccountId: null });
    expect(patched).toMatchObject({ defaultAccountId: null, defaultAccountAvailable: false });
  });

  it('preserva updatedAt em archive/restore repetidos e PATCH sem alteracao semantica', async () => {
    const templates = service(prisma);
    const created = await templates.create(userA, {
      name: 'Internet',
      type: 'EXPENSE',
      categoryId: expenseCategoryA,
      description: 'Banda larga',
      plannedAmount: '120.00',
      defaultAccountId: accountA,
      notes: null,
      dueDay: 5,
    });
    const noopPatch = await templates.update(userA, created.id, {
      name: 'Internet',
      type: 'EXPENSE',
      categoryId: expenseCategoryA,
      description: 'Banda larga',
      plannedAmount: '120.00',
      defaultAccountId: accountA,
      notes: null,
      dueDay: 5,
    });
    expect(noopPatch.updatedAt).toBe(created.updatedAt);
    const archived = await templates.archive(userA, created.id);
    const archivedAgain = await templates.archive(userA, created.id);
    expect(archivedAgain.updatedAt).toBe(archived.updatedAt);
    const restored = await templates.restore(userA, created.id);
    const restoredAgain = await templates.restore(userA, created.id);
    expect(restoredAgain.updatedAt).toBe(restored.updatedAt);
    await templates.archive(userA, created.id);
    await expectRejectsWithCode(
      templates.update(userA, created.id, { description: 'Nova descricao' }),
      'TEMPLATE_ARCHIVED',
    );
    await expectRejectsWithCode(templates.update(userA, created.id, {}), 'VALIDATION_ERROR');
  });

  it('lista por filtros, busca case-insensitive e ordenacao canonica', async () => {
    const templates = service(prisma);
    await templates.create(userA, {
      name: 'Zeta',
      type: 'EXPENSE',
      categoryId: expenseCategoryA,
      description: 'Mercado',
      plannedAmount: '10.00',
    });
    const alpha = await templates.create(userA, {
      name: 'Alpha',
      type: 'EXPENSE',
      categoryId: expenseCategoryA,
      description: 'Assinatura',
      plannedAmount: '20.00',
    });
    const salary = await templates.create(userA, {
      name: 'Salario',
      type: 'INCOME',
      categoryId: incomeCategoryA,
      description: 'Receita mensal',
      plannedAmount: '100.00',
    });
    await templates.archive(userA, salary.id);
    expect((await templates.list(userA, false)).map((item) => item.name)).toEqual([
      'Alpha',
      'Zeta',
    ]);
    expect((await templates.list(userA, true, 'INCOME')).map((item) => item.id)).toEqual([
      salary.id,
    ]);
    expect((await templates.list(userA, true, undefined, 'mercado')).map((item) => item.name)).toEqual(
      ['Zeta'],
    );
    expect((await templates.list(userA, true, undefined, 'ALPHA')).map((item) => item.id)).toEqual([
      alpha.id,
    ]);
  });

  it('projeta somente contrato publico e mantem Decimal com duas casas', async () => {
    const output = await service(prisma).create(userA, {
      name: 'Mensalidade',
      type: 'EXPENSE',
      categoryId: expenseCategoryA,
      description: 'Servico',
      plannedAmount: '10.10',
      defaultAccountId: accountA,
      notes: 'observacao',
      dueDay: 31,
    });
    expect(output.plannedAmount).toBe('10.10');
    expect(output).not.toHaveProperty('userId');
    expect(output).not.toHaveProperty('normalizedName');
    expect(Object.keys(output).sort()).toEqual(
      [
        'archivedAt',
        'categoryAvailable',
        'categoryId',
        'createdAt',
        'defaultAccountAvailable',
        'defaultAccountId',
        'description',
        'dueDay',
        'id',
        'name',
        'notes',
        'plannedAmount',
        'type',
        'updatedAt',
      ].sort(),
    );
  });
});
