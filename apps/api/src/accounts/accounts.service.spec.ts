import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it, vi } from 'vitest';
import { CreateAccountDto, isCivilDate } from './dto';
import { AccountsService, publicAccount, realizedBalanceWindow } from './accounts.service';
import { Prisma } from '@prisma/client';

const valid = {
  name: ' Conta ',
  type: 'CHECKING',
  institution: ' Banco ',
  currency: 'BRL',
  openingBalance: '123.45',
  openingBalanceDate: '2026-08-07',
};
const row = (extra = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  name: 'Conta',
  type: 'CHECKING' as const,
  institution: null,
  currency: 'BRL',
  openingBalance: new Prisma.Decimal('10.10'),
  openingBalanceDate: new Date('2026-08-07T00:00:00Z'),
  archivedAt: null,
  createdAt: new Date('2026-08-07T01:00:00Z'),
  updatedAt: new Date('2026-08-07T01:00:00Z'),
  ...extra,
});

describe('validação de contas', () => {
  it('aceita, apara e valida os campos aprovados', async () => {
    const dto = plainToInstance(CreateAccountDto, valid);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.name).toBe('Conta');
    expect(dto.institution).toBe('Banco');
  });
  it.each([
    { name: ' ' },
    { type: 'INVESTMENT' },
    { currency: 'USD' },
    { openingBalance: 1 },
    { openingBalance: '01.00' },
    { openingBalance: '1e2' },
    { openingBalance: '1.001' },
    { openingBalance: '100000000000000000.00' },
  ])('rejeita entrada inválida %o', async (change) =>
    expect(
      (await validate(plainToInstance(CreateAccountDto, { ...valid, ...change }))).length,
    ).toBeGreaterThan(0),
  );
  it.each(['123.45', '0', '-0', '-123.45', '99999999999999999.99', '-99999999999999999.99'])(
    'aceita saldo %s',
    async (openingBalance) =>
      expect(
        await validate(plainToInstance(CreateAccountDto, { ...valid, openingBalance })),
      ).toHaveLength(0),
  );
  it('valida datas gregorianas reais', () => {
    expect(isCivilDate('2024-02-29')).toBe(true);
    expect(isCivilDate('2023-02-29')).toBe(false);
    expect(isCivilDate('2026-13-01')).toBe(false);
  });
  it('projeta sem userId e normaliza decimal/data', () => {
    const result = publicAccount(row());
    expect(result.openingBalance).toBe('10.10');
    expect(result.openingBalanceDate).toBe('2026-08-07');
    expect(result).not.toHaveProperty('userId');
  });
  it('projeta explicitamente saldo realizado indisponível', () => {
    expect(publicAccount(row(), null).realizedBalance).toBeNull();
  });
});

describe('saldo realizado antes e no corte', () => {
  const movementSpies = () => ({
    financialTransaction: { findMany: vi.fn().mockResolvedValue([]) },
    financialTransfer: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { actualAmount: null } }),
    },
    cardInvoicePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
    debtFunding: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
    debtPayment: { findMany: vi.fn().mockResolvedValue([]) },
  });
  const expectNoMovementQueries = (spies: ReturnType<typeof movementSpies>) => {
    expect(spies.financialTransaction.findMany).not.toHaveBeenCalled();
    expect(spies.financialTransfer.aggregate).not.toHaveBeenCalled();
    expect(spies.cardInvoicePayment.aggregate).not.toHaveBeenCalled();
    expect(spies.debtFunding.aggregate).not.toHaveBeenCalled();
    expect(spies.debtPayment.findMany).not.toHaveBeenCalled();
  };

  it.each([
    ['hoje', '2026-08-08', '10.10'],
    ['amanhã', '2026-08-09', null],
  ])('retorna o contrato do corte %s sem consultar movimentos', async (_, date, balance) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T12:00:00.000Z'));
    const account = row({ openingBalanceDate: new Date(`${date}T00:00:00.000Z`) });
    const movements = movementSpies();
    const service = new AccountsService({
      financialAccount: { findFirst: vi.fn().mockResolvedValue(account) },
      ...movements,
    } as never);
    await expect(service.get(account.userId, account.id)).resolves.toMatchObject({
      realizedBalance: balance,
    });
    expectNoMovementQueries(movements);
    vi.useRealTimers();
  });

  it('aplica null de modo uniforme em create, list e get', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T12:00:00.000Z'));
    const future = row({ openingBalanceDate: new Date('2026-08-09T00:00:00.000Z') });
    const movements = movementSpies();
    const service = new AccountsService({
      financialAccount: {
        create: vi.fn().mockResolvedValue(future),
        findMany: vi.fn().mockResolvedValue([future]),
        findFirst: vi.fn().mockResolvedValue(future),
      },
      ...movements,
    } as never);
    const created = await service.create(future.userId, {
      name: future.name,
      type: future.type,
      currency: 'BRL',
      openingBalance: '10.10',
      openingBalanceDate: '2026-08-09',
    });
    expect(created.realizedBalance).toBeNull();
    expect(created.realizedBalance).not.toBe('0.00');
    await expect(service.list(future.userId, false)).resolves.toMatchObject([
      { realizedBalance: null },
    ]);
    await expect(service.get(future.userId, future.id)).resolves.toMatchObject({
      realizedBalance: null,
    });
    expectNoMovementQueries(movements);
    vi.useRealTimers();
  });

  it.each([
    ['passado para futuro', '2026-08-09', null, false],
    ['futuro para hoje', '2026-08-08', '25.00', false],
    ['futuro para passado', '2026-08-07', '25.00', true],
    ['futuro para outro futuro', '2026-08-10', null, false],
  ])('reflete edição de %s sem mutar movimentos', async (_, date, balance, queries) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T12:00:00.000Z'));
    const original = row({ openingBalanceDate: new Date('2026-08-09T00:00:00.000Z') });
    const updated = row({
      openingBalance: new Prisma.Decimal('25.00'),
      openingBalanceDate: new Date(`${date}T00:00:00.000Z`),
    });
    const movements = movementSpies();
    const update = vi.fn().mockResolvedValue(updated);
    const service = new AccountsService({
      financialAccount: { findFirst: vi.fn().mockResolvedValue(original), update },
      ...movements,
    } as never);
    await expect(
      service.update(original.userId, original.id, { openingBalanceDate: date }),
    ).resolves.toMatchObject({ realizedBalance: balance });
    expect(update).toHaveBeenCalledTimes(1);
    if (queries) expect(movements.financialTransaction.findMany).toHaveBeenCalledTimes(1);
    else expectNoMovementQueries(movements);
    vi.useRealTimers();
  });

  it.each(['archive', 'restore'] as const)(
    'preserva null ao executar %s em conta com corte futuro',
    async (operation) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-08T12:00:00.000Z'));
      const archivedAt = operation === 'restore' ? new Date('2026-08-01T00:00:00.000Z') : null;
      const account = row({
        openingBalanceDate: new Date('2026-08-09T00:00:00.000Z'),
        archivedAt,
      });
      const updated = row({
        openingBalanceDate: account.openingBalanceDate,
        archivedAt: operation === 'archive' ? new Date('2026-08-08T12:00:00.000Z') : null,
      });
      const movements = movementSpies();
      const service = new AccountsService({
        financialAccount: {
          findFirst: vi.fn().mockResolvedValue(account),
          update: vi.fn().mockResolvedValue(updated),
        },
        ...movements,
      } as never);
      await expect(service[operation](account.userId, account.id)).resolves.toMatchObject({
        realizedBalance: null,
      });
      expectNoMovementQueries(movements);
      vi.useRealTimers();
    },
  );
});

describe('ciclo de vida', () => {
  it('impede edição de conta arquivada', async () => {
    const prisma = {
      financialAccount: { findFirst: vi.fn().mockResolvedValue(row({ archivedAt: new Date() })) },
    };
    await expect(
      new AccountsService(prisma as never).update(row().userId, row().id, { name: 'Nova' }),
    ).rejects.toMatchObject({ response: { code: 'ACCOUNT_ARCHIVED' } });
  });
  it('mantém archive e restore repetidos sem update', async () => {
    const update = vi.fn();
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(row({ archivedAt: new Date('2026-08-07T02:00:00Z') }))
      .mockResolvedValueOnce(row());
    const aggregate = vi.fn().mockResolvedValue({ _sum: { actualAmount: null, amount: null } });
    const service = new AccountsService({
      financialAccount: { findFirst, update },
      financialTransaction: { findMany: vi.fn().mockResolvedValue([]) },
      financialTransfer: { aggregate },
      cardInvoicePayment: { aggregate },
      debtFunding: { aggregate },
      debtPayment: { findMany: vi.fn().mockResolvedValue([]) },
    } as never);
    await service.archive(row().userId, row().id);
    await service.restore(row().userId, row().id);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('saldo realizado com corte temporal', () => {
  it('produz a janela estrita no corte e inclusiva no dia civil D', () => {
    expect(realizedBalanceWindow(new Date('2026-01-31T00:00:00.000Z'), '2026-02-28')).toEqual({
      gt: new Date('2026-01-31T00:00:00.000Z'),
      lte: new Date('2026-02-28T00:00:00.000Z'),
    });
  });

  it('aplica paidAt, completedAt, paymentDate e fundingDate e consolida as cinco fontes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 28, 12));
    const financialTransaction = {
      findMany: vi.fn().mockResolvedValue([
        { type: 'INCOME', actualAmount: new Prisma.Decimal('200.00') },
        { type: 'EXPENSE', actualAmount: new Prisma.Decimal('50.00') },
      ]),
    };
    const financialTransfer = {
      aggregate: vi
        .fn()
        .mockResolvedValueOnce({ _sum: { actualAmount: new Prisma.Decimal('25.00') } })
        .mockResolvedValueOnce({ _sum: { actualAmount: new Prisma.Decimal('10.00') } }),
    };
    const cardInvoicePayment = {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal('30.00') } }),
    };
    const debtFunding = {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal('300.00') } }),
    };
    const debtPayment = {
      findMany: vi.fn().mockResolvedValue([
        {
          principalAmount: new Prisma.Decimal('100.00'),
          interestAmount: new Prisma.Decimal('8.00'),
          feeAmount: new Prisma.Decimal('2.00'),
        },
      ]),
    };
    const account = row({
      openingBalance: new Prisma.Decimal('1000.00'),
      openingBalanceDate: new Date('2026-01-31T00:00:00.000Z'),
    });
    const service = new AccountsService({
      financialAccount: { findFirst: vi.fn().mockResolvedValue(account) },
      financialTransaction,
      financialTransfer,
      cardInvoicePayment,
      debtFunding,
      debtPayment,
    } as never);

    await expect(service.get(account.userId, account.id)).resolves.toMatchObject({
      realizedBalance: '1295.00',
    });
    const window = {
      gt: new Date('2026-01-31T00:00:00.000Z'),
      lte: new Date('2026-02-28T00:00:00.000Z'),
    };
    expect(financialTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PAID', paidAt: window }),
      }),
    );
    expect(financialTransfer.aggregate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ status: 'COMPLETED', completedAt: window }),
      }),
    );
    expect(financialTransfer.aggregate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ status: 'COMPLETED', completedAt: window }),
      }),
    );
    expect(cardInvoicePayment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ paymentDate: window }) }),
    );
    expect(debtFunding.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ fundingDate: window }) }),
    );
    expect(debtPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ paymentDate: window }) }),
    );
    vi.useRealTimers();
  });

  it('passa a incluir eventos futuros somente quando o relógio civil alcança a data', async () => {
    vi.useFakeTimers();
    const account = row({ openingBalanceDate: new Date('2026-01-31T00:00:00.000Z') });
    const findMany = vi.fn().mockResolvedValue([]);
    const aggregate = vi.fn().mockResolvedValue({ _sum: { actualAmount: null, amount: null } });
    const service = new AccountsService({
      financialAccount: { findFirst: vi.fn().mockResolvedValue(account) },
      financialTransaction: { findMany },
      financialTransfer: { aggregate },
      cardInvoicePayment: { aggregate },
      debtFunding: { aggregate },
      debtPayment: { findMany: vi.fn().mockResolvedValue([]) },
    } as never);
    vi.setSystemTime(new Date(2026, 1, 28, 12));
    await service.get(account.userId, account.id);
    vi.setSystemTime(new Date(2026, 2, 1, 12));
    await service.get(account.userId, account.id);
    expect(findMany.mock.calls[0]![0].where.paidAt.lte).toEqual(
      new Date('2026-02-28T00:00:00.000Z'),
    );
    expect(findMany.mock.calls[1]![0].where.paidAt.lte).toEqual(
      new Date('2026-03-01T00:00:00.000Z'),
    );
    vi.useRealTimers();
  });

  it('avalia cada ponta da transferência contra o corte da própria conta', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 31, 12));
    const accountA = row({ openingBalanceDate: new Date('2026-01-31T00:00:00.000Z') });
    const accountB = row({
      id: '33333333-3333-4333-8333-333333333333',
      openingBalanceDate: new Date('2026-02-28T00:00:00.000Z'),
    });
    const transferAggregate = vi.fn().mockResolvedValue({ _sum: { actualAmount: null } });
    const emptyAggregate = vi.fn().mockResolvedValue({ _sum: { amount: null } });
    const service = new AccountsService({
      financialAccount: {
        findFirst: vi.fn().mockResolvedValueOnce(accountA).mockResolvedValueOnce(accountB),
      },
      financialTransaction: { findMany: vi.fn().mockResolvedValue([]) },
      financialTransfer: { aggregate: transferAggregate },
      cardInvoicePayment: { aggregate: emptyAggregate },
      debtFunding: { aggregate: emptyAggregate },
      debtPayment: { findMany: vi.fn().mockResolvedValue([]) },
    } as never);
    await service.get(accountA.userId, accountA.id);
    await service.get(accountB.userId, accountB.id);
    expect(transferAggregate.mock.calls[0]![0].where.completedAt.gt).toEqual(
      accountA.openingBalanceDate,
    );
    expect(transferAggregate.mock.calls[2]![0].where.completedAt.gt).toEqual(
      accountB.openingBalanceDate,
    );
    vi.useRealTimers();
  });

  it('recalcula imediatamente após editar saldo ou data sem mutar movimentos', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 28, 12));
    const original = row({ openingBalanceDate: new Date('2026-01-31T00:00:00.000Z') });
    const updated = row({
      openingBalance: new Prisma.Decimal('500.00'),
      openingBalanceDate: new Date('2026-02-10T00:00:00.000Z'),
    });
    const movementFind = vi.fn().mockResolvedValue([]);
    const aggregate = vi.fn().mockResolvedValue({ _sum: { actualAmount: null, amount: null } });
    const accountUpdate = vi.fn().mockResolvedValue(updated);
    const service = new AccountsService({
      financialAccount: { findFirst: vi.fn().mockResolvedValue(original), update: accountUpdate },
      financialTransaction: { findMany: movementFind },
      financialTransfer: { aggregate },
      cardInvoicePayment: { aggregate },
      debtFunding: { aggregate },
      debtPayment: { findMany: vi.fn().mockResolvedValue([]) },
    } as never);
    await expect(
      service.update(original.userId, original.id, {
        openingBalance: '500.00',
        openingBalanceDate: '2026-02-10',
      }),
    ).resolves.toMatchObject({ realizedBalance: '500.00' });
    expect(movementFind.mock.calls[0]![0].where.paidAt.gt).toEqual(updated.openingBalanceDate);
    expect(accountUpdate).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
