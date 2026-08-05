export interface ApiConfig {
  port: number;
  databaseUrl: string;
  corsOrigin: string;
}

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Configuração inválida: ${name} é obrigatória.`);
  return value;
}

export function loadApiConfig(): ApiConfig {
  const portText = process.env.API_PORT ?? '3000';
  const port = Number(portText);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('Configuração inválida: API_PORT deve ser uma porta TCP válida.');
  }
  const databaseUrl = readRequired('DATABASE_URL');
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    throw new Error('Configuração inválida: DATABASE_URL deve usar PostgreSQL.');
  }
  const corsOrigin = process.env.API_CORS_ORIGIN ?? 'http://localhost:9000';
  if (!corsOrigin.startsWith('http://localhost:') && !corsOrigin.startsWith('http://127.0.0.1:')) {
    throw new Error('Configuração inválida: API_CORS_ORIGIN deve apontar para origem local.');
  }
  return { port, databaseUrl, corsOrigin };
}
