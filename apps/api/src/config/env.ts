export interface ApiConfig {
  port: number;
  databaseUrl: string;
  corsOrigin: string;
  jwtSecret: string;
  refreshHmacSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  accessTokenSeconds: 900;
  refreshTokenSeconds: 2592000;
  cookieSecure: boolean;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Configuração inválida: ${name} é obrigatória.`);
  return value;
}

function strongSecret(name: string): string {
  const value = required(name);
  if (
    Buffer.byteLength(value, 'utf8') < 32 ||
    new Set(value).size < 8 ||
    /^(change|example|placeholder|secret)/i.test(value)
  )
    throw new Error(
      `Configuração inválida: ${name} deve conter ao menos 256 bits e não pode ser placeholder.`,
    );
  return value;
}

export function loadApiConfig(): ApiConfig {
  const port = Number(process.env.API_PORT ?? '3000');
  if (!Number.isInteger(port) || port <= 0 || port > 65535)
    throw new Error('Configuração inválida: API_PORT deve ser uma porta TCP válida.');
  const databaseUrl = required('DATABASE_URL');
  if (!/^postgres(ql)?:\/\//.test(databaseUrl))
    throw new Error('Configuração inválida: DATABASE_URL deve usar PostgreSQL.');
  const corsOrigin = process.env.API_CORS_ORIGIN ?? 'http://localhost:9000';
  const origin = new URL(corsOrigin);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== corsOrigin)
    throw new Error('Configuração inválida: API_CORS_ORIGIN deve ser uma origem HTTP explícita.');
  const jwtSecret = strongSecret('JWT_SECRET');
  const refreshHmacSecret = strongSecret('REFRESH_HMAC_SECRET');
  if (jwtSecret === refreshHmacSecret)
    throw new Error('Configuração inválida: os segredos JWT e HMAC devem ser independentes.');
  return {
    port,
    databaseUrl,
    corsOrigin,
    jwtSecret,
    refreshHmacSecret,
    jwtIssuer: process.env.JWT_ISSUER ?? 'planner-fin-api',
    jwtAudience: process.env.JWT_AUDIENCE ?? 'planner-fin-web',
    accessTokenSeconds: 900,
    refreshTokenSeconds: 2592000,
    cookieSecure: process.env.COOKIE_SECURE !== 'false',
  };
}
