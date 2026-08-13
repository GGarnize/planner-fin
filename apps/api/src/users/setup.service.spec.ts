import { describe, expect, it } from 'vitest';
import { InitialSetupService } from './setup.service';

const userId = '11111111-1111-4111-8111-111111111119';
const draft = {
  step: 'REVIEW' as const,
  account: {
    name: 'Conta principal',
    type: 'CHECKING' as const,
    openingBalance: null,
    openingBalanceDate: '2026-08-13',
  },
  categories: [
    { key: 'income', name: 'Renda', type: 'INCOME' as const, icon: 'WORK' as const, selected: true },
    {
      key: 'food',
      name: 'Alimentacao',
      type: 'EXPENSE' as const,
      icon: 'RESTAURANT' as const,
      selected: false,
    },
  ],
};

function prisma() {
  const state = {
    setup: null as Record<string, unknown> | null,
    confirmations: [] as Array<Record<string, unknown>>,
    accounts: [] as Array<Record<string, unknown>>,
    categories: [] as Array<Record<string, unknown>>,
    transactions: [] as Array<Record<string, unknown>>,
  };
  type FakeClient = {
    $transaction: (fn: (tx: FakeClient) => unknown) => Promise<unknown>;
    userInitialSetup: {
      findUnique: () => Promise<Record<string, unknown> | null>;
      create: ({ data }: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
      update: ({ data }: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
      upsert: ({
        create,
        update,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => Promise<Record<string, unknown>>;
    };
    setupConfirmation: {
      findUnique: ({
        where,
      }: {
        where: { userId_idempotencyKey: { idempotencyKey: string } };
      }) => Promise<Record<string, unknown> | null>;
      create: ({ data }: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    };
    financialAccount: {
      count: () => Promise<number>;
      create: ({ data }: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    };
    financialCategory: {
      count: () => Promise<number>;
      create: ({ data }: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    };
    financialTransaction: { count: () => Promise<number> };
  };

  const client: FakeClient = {
    $transaction: async (fn: (tx: typeof client) => unknown) => fn(client),
    userInitialSetup: {
      findUnique: async () => state.setup,
      create: async ({ data }: { data: Record<string, unknown> }) =>
        (state.setup = {
          status: 'NOT_STARTED',
          draft: null,
          draftVersion: 0,
          suggestionVersion: 1,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (!state.setup) throw new Error('missing setup');
        state.setup = {
          ...state.setup,
          ...data,
          draftVersion:
            typeof data.draftVersion === 'object' && data.draftVersion
              ? Number(state.setup.draftVersion) + 1
              : (data.draftVersion ?? state.setup.draftVersion),
          updatedAt: new Date(),
        };
        return state.setup;
      },
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        if (!state.setup) return client.userInitialSetup.create({ data: create });
        return client.userInitialSetup.update({ data: update });
      },
    },
    setupConfirmation: {
      findUnique: async ({ where }: { where: { userId_idempotencyKey: { idempotencyKey: string } } }) =>
        state.confirmations.find(
          (item) => item.idempotencyKey === where.userId_idempotencyKey.idempotencyKey,
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.confirmations.push(data);
        return data;
      },
    },
    financialAccount: {
      count: async () => state.accounts.length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `account-${state.accounts.length + 1}`, ...data };
        state.accounts.push(row);
        return row;
      },
    },
    financialCategory: {
      count: async () => state.categories.length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `category-${state.categories.length + 1}`, ...data };
        state.categories.push(row);
        return row;
      },
    },
    financialTransaction: { count: async () => state.transactions.length },
  };
  return { client, state };
}

describe('InitialSetupService', () => {
  it('sem linha nao participa e nao cria registro por leitura', async () => {
    const { client, state } = prisma();
    const result = await new InitialSetupService(client as never).get(userId);
    expect(result).toMatchObject({ participating: false, eligible: false, status: null });
    expect(state.setup).toBeNull();
  });

  it('salva draft server-side versionado e canoniza saldo omitido para 0.00', async () => {
    const { client } = prisma();
    const service = new InitialSetupService(client as never);
    const result = await service.saveDraft(userId, null, draft);
    expect(result.draftVersion).toBe(1);
    expect(result.draft?.account.openingBalance).toBe('0.00');
    await expect(service.saveDraft(userId, 0, draft)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SETUP_VERSION_CONFLICT' }),
    });
  });

  it('gera preview sem criar conta ou categoria', async () => {
    const { client, state } = prisma();
    const service = new InitialSetupService(client as never);
    await service.saveDraft(userId, null, draft);
    const preview = await service.preview(userId, 1);
    expect(preview.summary.counts).toMatchObject({ accounts: 1, categories: 1, transactions: 0 });
    expect(state.accounts).toHaveLength(0);
    expect(state.categories).toHaveLength(0);
  });

  it('confirma atomicamente e retry com mesma chave nao duplica', async () => {
    const { client, state } = prisma();
    const service = new InitialSetupService(client as never);
    await service.saveDraft(userId, null, draft);
    const preview = await service.preview(userId, 1);
    const first = await service.confirm(
      userId,
      preview.previewToken,
      '33333333-3333-4333-8333-333333333339',
    );
    const retry = await service.confirm(
      userId,
      preview.previewToken,
      '33333333-3333-4333-8333-333333333339',
    );
    expect(first.statusCode).toBe(201);
    expect(retry.statusCode).toBe(200);
    expect(state.accounts).toHaveLength(1);
    expect(state.categories).toHaveLength(1);
  });

  it('skip cria zero entidade financeira', async () => {
    const { client, state } = prisma();
    await new InitialSetupService(client as never).skip(userId);
    expect(state.setup?.status).toBe('SKIPPED');
    expect(state.accounts).toHaveLength(0);
    expect(state.categories).toHaveLength(0);
  });
});
