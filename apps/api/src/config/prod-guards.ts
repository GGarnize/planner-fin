const ANDROID_WEBVIEW_ORIGIN = 'https://localhost';
const LOCAL_OR_LAN_HOSTNAME_PATTERN = /^(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d{1,3}\.\d{1,3})$/i;
const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const LOCAL_OR_TEST_DATABASE_NAMES = new Set(['planner_fin_local', 'planner_fin_test']);
const SPEC022_SYNTHETIC_DATABASE_PREFIX = 'planner_fin_spec022_';

export interface ProdGuardConfig {
  cookieSecure: boolean;
  corsOrigins: readonly string[];
  databaseUrl: string;
}

/**
 * Falha fechado antes de a API aceitar tráfego quando NODE_ENV=production
 * carrega uma configuração incompatível com o contrato de produção da SPEC-023.
 */
export function assertProductionSafety(config: ProdGuardConfig, env: NodeJS.ProcessEnv): void {
  if (!config.cookieSecure)
    throw new Error('Configuração insegura para produção: COOKIE_SECURE não pode ser false.');

  for (const origin of config.corsOrigins) {
    if (origin === ANDROID_WEBVIEW_ORIGIN) continue;
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Configuração insegura para produção: origem CORS inválida (${origin}).`);
    }
    if (parsed.protocol !== 'https:')
      throw new Error(
        `Configuração insegura para produção: origem CORS deve usar HTTPS (${origin}).`,
      );
    if (LOCAL_OR_LAN_HOSTNAME_PATTERN.test(parsed.hostname))
      throw new Error(
        `Configuração insegura para produção: origem CORS local/LAN não é permitida (${origin}).`,
      );
  }

  if (env.ALLOW_LOCAL_TEST_SEED === 'true')
    throw new Error(
      'Configuração insegura para produção: ALLOW_LOCAL_TEST_SEED não pode ser true.',
    );

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(config.databaseUrl);
  } catch {
    throw new Error('Configuração insegura para produção: DATABASE_URL inválida.');
  }
  if (LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname))
    throw new Error(
      'Configuração insegura para produção: DATABASE_URL não pode apontar a um host local.',
    );
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
  if (
    LOCAL_OR_TEST_DATABASE_NAMES.has(databaseName) ||
    databaseName.startsWith(SPEC022_SYNTHETIC_DATABASE_PREFIX)
  )
    throw new Error(
      'Configuração insegura para produção: DATABASE_URL aponta a um banco sintético/local.',
    );
}
