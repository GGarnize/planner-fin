import type { S3ReleaseStorageConfig } from '@planner-fin/storage';

const RELEASE_STORAGE_ENV_NAMES = [
  'BUCKET',
  'ENDPOINT',
  'REGION',
  'ACCESS_KEY_ID',
  'SECRET_ACCESS_KEY',
] as const;

/**
 * Retorna null quando o bucket de releases ainda não foi provisionado (nenhuma das
 * variáveis está definida) para não impedir o boot da API em produção antes da Fase E
 * ser concluída. Falha fechado apenas quando a configuração está parcialmente definida.
 */
export function loadReleaseStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): S3ReleaseStorageConfig | null {
  const values = Object.fromEntries(
    RELEASE_STORAGE_ENV_NAMES.map((name) => [name, env[name]?.trim() || undefined]),
  ) as Record<(typeof RELEASE_STORAGE_ENV_NAMES)[number], string | undefined>;
  const present = RELEASE_STORAGE_ENV_NAMES.filter((name) => values[name]);
  if (present.length === 0) return null;
  const missing = RELEASE_STORAGE_ENV_NAMES.filter((name) => !values[name]);
  if (missing.length > 0)
    throw new Error(`Configuração de bucket de releases incompleta: faltam ${missing.join(', ')}.`);
  return {
    bucket: values.BUCKET!,
    endpoint: values.ENDPOINT!,
    region: values.REGION!,
    accessKeyId: values.ACCESS_KEY_ID!,
    secretAccessKey: values.SECRET_ACCESS_KEY!,
  };
}
