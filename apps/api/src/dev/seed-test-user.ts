import { PrismaClient } from '@prisma/client';
import { hashPassword, normalizeEmail, passwordIsValid, verifyPassword } from '../auth/auth.utils';

const DEFAULT_EMAIL = 'codex.local@planner-fin.test';
const DEFAULT_PASSWORD = 'PlannerFinLocal123!';
const DEFAULT_NAME = 'Conta Sintética Local';
const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const LOCAL_DATABASE_NAMES = new Set(['planner_fin_local', 'planner_fin_test']);
const SPEC022_SYNTHETIC_DATABASE_PREFIX = 'planner_fin_spec022_';
const SYNTHETIC_EMAIL_DOMAIN = '.test';

export class LocalTestSeedGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalTestSeedGuardError';
  }
}

export interface LocalTestSeedConfig {
  email: string;
  password: string;
  name: string;
  databaseName: string;
}

export interface LocalTestSeedResult {
  userId: string;
  email: string;
  created: boolean;
}

interface UserStore {
  user: {
    findUnique(args: { where: { normalizedEmail: string }; select: { id: true } }): Promise<{
      id: string;
    } | null>;
    create(args: {
      data: {
        name: string;
        email: string;
        normalizedEmail: string;
        passwordHash: string;
      };
      select: { id: true; email: true; passwordHash: true };
    }): Promise<{ id: string; email: string; passwordHash: string }>;
    update(args: {
      where: { normalizedEmail: string };
      data: { name: string; email: string; passwordHash: string };
      select: { id: true; email: true; passwordHash: true };
    }): Promise<{ id: string; email: string; passwordHash: string }>;
  };
  userInitialSetup?: {
    upsert(args: {
      where: { userId: string };
      create: { userId: string };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
}

function readDatabaseUrl(raw: string | undefined): URL {
  if (!raw) throw new LocalTestSeedGuardError('DATABASE_URL é obrigatória.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LocalTestSeedGuardError('DATABASE_URL inválida.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new LocalTestSeedGuardError('DATABASE_URL deve usar PostgreSQL.');
  return url;
}

export function loadLocalTestSeedConfig(env: NodeJS.ProcessEnv): LocalTestSeedConfig {
  if (env.NODE_ENV === 'production')
    throw new LocalTestSeedGuardError('Fixture local recusada: NODE_ENV=production.');
  if (env.ALLOW_LOCAL_TEST_SEED !== 'true')
    throw new LocalTestSeedGuardError(
      'Fixture local recusada: defina ALLOW_LOCAL_TEST_SEED=true para autorizar.',
    );

  const databaseUrl = readDatabaseUrl(env.DATABASE_URL);
  if (!LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname))
    throw new LocalTestSeedGuardError(
      `Fixture local recusada: host de banco não aprovado (${databaseUrl.hostname}).`,
    );

  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
  if (
    !LOCAL_DATABASE_NAMES.has(databaseName) &&
    !databaseName.startsWith(SPEC022_SYNTHETIC_DATABASE_PREFIX)
  )
    throw new LocalTestSeedGuardError(
      `Fixture local recusada: banco não aprovado (${databaseName || '<vazio>'}).`,
    );

  const email = normalizeEmail(env.PLANNER_FIN_TEST_EMAIL ?? DEFAULT_EMAIL);
  const emailDomain = email.split('@')[1] ?? '';
  if (!emailDomain.endsWith(SYNTHETIC_EMAIL_DOMAIN))
    throw new LocalTestSeedGuardError(
      'Fixture local recusada: PLANNER_FIN_TEST_EMAIL deve usar domínio sintético .test.',
    );

  const password = env.PLANNER_FIN_TEST_PASSWORD ?? DEFAULT_PASSWORD;
  if (!passwordIsValid(password))
    throw new LocalTestSeedGuardError(
      'Fixture local recusada: PLANNER_FIN_TEST_PASSWORD deve seguir a política real de senha.',
    );

  return { email, password, name: DEFAULT_NAME, databaseName };
}

export async function seedLocalTestUser(
  prisma: UserStore,
  config: LocalTestSeedConfig,
): Promise<LocalTestSeedResult> {
  const existing = await prisma.user.findUnique({
    where: { normalizedEmail: config.email },
    select: { id: true },
  });
  const passwordHash = await hashPassword(config.password);
  const user = existing
    ? await prisma.user.update({
        where: { normalizedEmail: config.email },
        data: { name: config.name, email: config.email, passwordHash },
        select: { id: true, email: true, passwordHash: true },
      })
    : await prisma.user.create({
        data: {
          name: config.name,
          email: config.email,
          normalizedEmail: config.email,
          passwordHash,
        },
        select: { id: true, email: true, passwordHash: true },
      });

  if (!(await verifyPassword(user.passwordHash, config.password)))
    throw new Error('Fixture local falhou: hash gerado não valida a senha sintética.');

  await prisma.userInitialSetup?.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  return { userId: user.id, email: user.email, created: !existing };
}

async function main(): Promise<void> {
  const config = loadLocalTestSeedConfig(process.env);
  const prisma = new PrismaClient();
  try {
    const result = await seedLocalTestUser(prisma, config);
    const action = result.created ? 'criada' : 'atualizada';
    console.log(`Conta sintética local ${action}.`);
    console.log(`Banco: ${config.databaseName}`);
    console.log(`E-mail: ${result.email}`);
    console.log('Use a tela real de Login; nenhum token, cookie ou sessão foi criado pela fixture.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error(message);
    process.exitCode = 1;
  });
}
