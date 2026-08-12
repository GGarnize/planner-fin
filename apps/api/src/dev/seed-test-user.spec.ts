import { describe, expect, it } from 'vitest';
import { verifyPassword } from '../auth/auth.utils';
import {
  loadLocalTestSeedConfig,
  seedLocalTestUser,
  type LocalTestSeedConfig,
} from './seed-test-user';

const baseEnv = {
  NODE_ENV: 'development',
  ALLOW_LOCAL_TEST_SEED: 'true',
  DATABASE_URL: 'postgresql://planner_fin_local:planner_fin_local@localhost:5432/planner_fin_local',
};

function makeStore() {
  const users = new Map<string, { id: string; email: string; passwordHash: string; name: string }>();
  let nextId = 1;
  return {
    users,
    sessionsCreated: 0,
    prisma: {
      user: {
        async findUnique({ where }: { where: { normalizedEmail: string } }) {
          return users.get(where.normalizedEmail) ?? null;
        },
        async create({
          data,
        }: {
          data: { name: string; email: string; normalizedEmail: string; passwordHash: string };
        }) {
          const user = {
            id: `user-${nextId++}`,
            email: data.email,
            passwordHash: data.passwordHash,
            name: data.name,
          };
          users.set(data.normalizedEmail, user);
          return user;
        },
        async update({
          where,
          data,
        }: {
          where: { normalizedEmail: string };
          data: { name: string; email: string; passwordHash: string };
        }) {
          const current = users.get(where.normalizedEmail);
          if (!current) throw new Error('Usuário não encontrado no teste.');
          const updated = { ...current, ...data };
          users.set(where.normalizedEmail, updated);
          return updated;
        },
      },
    },
  };
}

describe('fixture local de usuário sintético', () => {
  it('recusa execução em production', () => {
    expect(() => loadLocalTestSeedConfig({ ...baseEnv, NODE_ENV: 'production' })).toThrow(
      'NODE_ENV=production',
    );
  });

  it('recusa banco não local', () => {
    expect(() =>
      loadLocalTestSeedConfig({
        ...baseEnv,
        DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/planner_fin_local',
      }),
    ).toThrow('host de banco não aprovado');
  });

  it('recusa sem flag explícita', () => {
    expect(() => loadLocalTestSeedConfig({ ...baseEnv, ALLOW_LOCAL_TEST_SEED: undefined })).toThrow(
      'ALLOW_LOCAL_TEST_SEED=true',
    );
  });

  it('recusa banco local com nome não aprovado', () => {
    expect(() =>
      loadLocalTestSeedConfig({
        ...baseEnv,
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/planner_fin_prod',
      }),
    ).toThrow('banco não aprovado');
  });

  it('normaliza credencial sintética e aceita defaults locais', () => {
    const config = loadLocalTestSeedConfig(baseEnv);
    expect(config.email).toBe('codex.local@planner-fin.test');
    expect(config.password).toBeTruthy();
    expect(config.databaseName).toBe('planner_fin_local');
  });

  it('cria na primeira execução e atualiza sem duplicar na segunda', async () => {
    const store = makeStore();
    const config: LocalTestSeedConfig = {
      email: 'codex.local@planner-fin.test',
      password: 'PlannerFinLocal123!',
      name: 'Conta Sintética Local',
      databaseName: 'planner_fin_local',
    };

    const first = await seedLocalTestUser(store.prisma, config);
    const second = await seedLocalTestUser(store.prisma, config);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.userId).toBe(first.userId);
    expect(store.users).toHaveLength(1);
  });

  it('grava senha compatível com o verificador Argon2 real e não cria sessão/token', async () => {
    const store = makeStore();
    const config: LocalTestSeedConfig = {
      email: 'codex.local@planner-fin.test',
      password: 'PlannerFinLocal123!',
      name: 'Conta Sintética Local',
      databaseName: 'planner_fin_local',
    };

    const result = await seedLocalTestUser(store.prisma, config);
    const user = store.users.get(config.email);

    expect(result).toEqual({
      userId: 'user-1',
      email: config.email,
      created: true,
    });
    expect(user?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    await expect(verifyPassword(user?.passwordHash ?? '', config.password)).resolves.toBe(true);
    expect(JSON.stringify(result)).not.toContain('token');
    expect(JSON.stringify(result)).not.toContain('password');
    expect(store.sessionsCreated).toBe(0);
  });
});
