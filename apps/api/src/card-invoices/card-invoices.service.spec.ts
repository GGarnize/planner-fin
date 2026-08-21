import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CardInvoicesService } from './card-invoices.service';

const invoice = (status: 'OPEN' | 'CLOSED' | 'PAID' = 'CLOSED') => ({
  id: 'invoice',
  userId: 'owner',
  cardId: 'card',
  referenceMonth: '2026-08',
  closingDate: new Date('2026-08-10T00:00:00.000Z'),
  dueDate: new Date('2026-08-17T00:00:00.000Z'),
  status,
  closedAt: status === 'OPEN' ? null : new Date('2026-08-11T00:00:00.000Z'),
  paidAt: status === 'PAID' ? new Date('2026-08-12T00:00:00.000Z') : null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  installments: [
    {
      id: 'installment',
      purchaseId: 'purchase',
      installmentNumber: 1,
      installmentCount: 1,
      amount: new Prisma.Decimal('120.00'),
      referenceMonth: '2026-08',
      invoiceId: 'invoice',
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      purchase: { description: 'Compra fictícia', categoryId: 'category' },
    },
  ],
  payment: null,
});

function setup(row = invoice()) {
  const tx = {
    cardInvoice: {
      findFirst: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    cardInvoicePayment: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    financialAccount: { findFirst: vi.fn().mockResolvedValue({ id: 'account', archivedAt: null }) },
    cardInstallment: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal('120.00') } }),
    },
  };
  const prisma = { ...tx, $transaction: vi.fn((callback) => callback(tx)) };
  return {
    tx,
    service: new CardInvoicesService(prisma as never, { jwtSecret: 'secret' } as never),
  };
}

describe('serviço de faturas', () => {
  it('close repetido preserva estado e não reabre PAID', async () => {
    const closed = setup(invoice('CLOSED'));
    await closed.service.close('owner', 'invoice');
    expect(closed.tx.cardInvoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'OPEN' }) }),
    );
    const paid = setup(invoice('PAID'));
    expect((await paid.service.close('owner', 'invoice')).status).toBe('PAID');
  });

  it('pay igual é no-op e pay divergente retorna 409', async () => {
    const same = setup(invoice('PAID'));
    same.tx.cardInvoicePayment.findUnique.mockResolvedValue({
      accountId: 'account',
      paymentDate: new Date('2026-08-12T00:00:00.000Z'),
    });
    await same.service.pay('owner', 'invoice', { accountId: 'account', paymentDate: '2026-08-12' });
    expect(same.tx.cardInvoicePayment.create).not.toHaveBeenCalled();
    await expect(
      same.service.pay('owner', 'invoice', { accountId: 'other', paymentDate: '2026-08-12' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('não paga OPEN e trata conta própria arquivada como 422', async () => {
    await expect(
      setup(invoice('OPEN')).service.pay('owner', 'invoice', {
        accountId: 'account',
        paymentDate: '2026-08-12',
      }),
    ).rejects.toMatchObject({ status: 409 });
    const archived = setup();
    archived.tx.financialAccount.findFirst.mockResolvedValue({
      id: 'account',
      archivedAt: new Date(),
    });
    await expect(
      archived.service.pay('owner', 'invoice', { accountId: 'account', paymentDate: '2026-08-12' }),
    ).rejects.toMatchObject({ status: 422 });
    expect(archived.tx.cardInvoicePayment.create).not.toHaveBeenCalled();
  });
});

function invoiceRow(
  id: string,
  cardId: string,
  dueDate: string,
  referenceMonth: string,
  status: 'OPEN' | 'CLOSED' | 'PAID' = 'OPEN',
) {
  return {
    id,
    userId: 'owner',
    cardId,
    referenceMonth,
    closingDate: new Date(`${referenceMonth}-01T00:00:00.000Z`),
    dueDate: new Date(`${dueDate}T00:00:00.000Z`),
    status,
    closedAt: null,
    paidAt: null,
    createdAt: new Date(`${referenceMonth}-01T00:00:00.000Z`),
    updatedAt: new Date(`${referenceMonth}-01T00:00:00.000Z`),
    installments: [] as never[],
    payment: null,
  };
}

type InvoiceRow = ReturnType<typeof invoiceRow>;
type InvoiceOrderBy = Array<{ dueDate?: 'asc' | 'desc'; id?: 'asc' | 'desc' }>;
type InvoiceCursorClause =
  | { dueDate: { gt: Date } }
  | { dueDate: Date; id: { gt: string } }
  | { dueDate: { lt: Date } }
  | { dueDate: Date; id: { lt: string } };

function fakeFindMany(rows: InvoiceRow[]) {
  return vi.fn(
    async (args: {
      where: {
        userId: string;
        cardId?: string;
        status?: string | { in: string[] };
        OR?: InvoiceCursorClause[];
      };
      orderBy: InvoiceOrderBy;
      take: number;
    }) => {
      const { where } = args;
      let result = rows.filter((r) => r.userId === where.userId);
      if (where.cardId) result = result.filter((r) => r.cardId === where.cardId);
      if (typeof where.status === 'string') result = result.filter((r) => r.status === where.status);
      else if (where.status) {
        const statuses = where.status.in;
        result = result.filter((r) => statuses.includes(r.status));
      }
      if (where.OR) {
        result = result.filter((r) =>
          where.OR!.some((clause) => {
            if ('gt' in clause.dueDate) return r.dueDate.getTime() > clause.dueDate.gt.getTime();
            if ('lt' in clause.dueDate) return r.dueDate.getTime() < clause.dueDate.lt.getTime();
            if (!('id' in clause)) return false;
            const sameDay = r.dueDate.getTime() === clause.dueDate.getTime();
            if ('gt' in clause.id) return sameDay && r.id > clause.id.gt;
            return sameDay && r.id < clause.id.lt;
          }),
        );
      }
      const dueDirection = args.orderBy.find((item) => 'dueDate' in item)?.dueDate ?? 'asc';
      const idDirection = args.orderBy.find((item) => 'id' in item)?.id ?? 'asc';
      result = [...result].sort((a, b) =>
        a.dueDate.getTime() !== b.dueDate.getTime()
          ? (a.dueDate.getTime() - b.dueDate.getTime()) * (dueDirection === 'asc' ? 1 : -1)
          : a.id.localeCompare(b.id) * (idDirection === 'asc' ? 1 : -1),
      );
      return result.slice(0, args.take);
    },
  );
}

describe('ordenação e paginação de faturas', () => {
  const rows: InvoiceRow[] = [
    invoiceRow('a1', '11111111-1111-4111-8111-111111111111', '2026-09-05', '2026-08'),
    invoiceRow('b1', '22222222-2222-4222-8222-222222222222', '2026-08-25', '2026-08'),
    invoiceRow('a2', '11111111-1111-4111-8111-111111111111', '2026-10-05', '2026-09'),
    invoiceRow('b0', '22222222-2222-4222-8222-222222222222', '2026-08-25', '2026-08'),
    invoiceRow('a0', '11111111-1111-4111-8111-111111111111', '2026-07-05', '2026-07'),
    invoiceRow('p1', '11111111-1111-4111-8111-111111111111', '2026-06-05', '2026-06', 'PAID'),
  ];
  function setupList() {
    const findMany = fakeFindMany(rows);
    const prisma = { cardInvoice: { findMany } };
    return {
      findMany,
      service: new CardInvoicesService(prisma as never, { jwtSecret: 'secret' } as never),
    };
  }

  it('ordena por vencimento asc com desempate determinístico por id', async () => {
    const { service, findMany } = setupList();
    const page = await service.list('owner', { limit: '10' });
    expect(page.items.map((x) => x.id)).toEqual(['a0', 'b0', 'b1', 'a1', 'a2', 'p1']);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['OPEN', 'CLOSED'] } }),
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('paginação por cursor não duplica nem salta faturas entre páginas', async () => {
    const { service } = setupList();
    const page1 = await service.list('owner', { limit: '2' });
    expect(page1.items.map((x) => x.id)).toEqual(['a0', 'b0']);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await service.list('owner', { limit: '2', cursor: page1.nextCursor! });
    expect(page2.items.map((x) => x.id)).toEqual(['b1', 'a1']);
    expect(page2.nextCursor).toBeTruthy();

    const page3 = await service.list('owner', { limit: '2', cursor: page2.nextCursor! });
    expect(page3.items.map((x) => x.id)).toEqual(['a2', 'p1']);
    expect(page3.nextCursor).toBeNull();

    const allIds = [...page1.items, ...page2.items, ...page3.items].map((x) => x.id);
    expect(allIds).toEqual(['a0', 'b0', 'b1', 'a1', 'a2', 'p1']);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('mantém o filtro cardId funcionando com a nova ordenação', async () => {
    const { service } = setupList();
    const filtered = await service.list('owner', { limit: '10', cardId: '11111111-1111-4111-8111-111111111111' });
    expect(filtered.items.map((x) => x.id)).toEqual(['a0', 'a1', 'a2', 'p1']);
  });

  it('mantém faturas pagas antigas depois das obrigações quando não há filtro de status', async () => {
    const { service } = setupList();
    const page = await service.list('owner', { limit: '3' });
    expect(page.items.map((x) => x.status)).toEqual(['OPEN', 'OPEN', 'OPEN']);

    const page2 = await service.list('owner', { limit: '3', cursor: page.nextCursor! });
    expect(page2.items.map((x) => x.id)).toEqual(['a1', 'a2', 'p1']);
    expect(page2.items.at(-1)?.status).toBe('PAID');
  });

  it('respeita status explícito sem misturar blocos da listagem geral', async () => {
    const { service } = setupList();
    const filtered = await service.list('owner', { limit: '10', status: 'PAID' });
    expect(filtered.items.map((x) => x.id)).toEqual(['p1']);
  });
});
