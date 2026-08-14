import { pathToFileURL } from 'node:url';

const LOCAL_OR_LAN_HOSTNAME_PATTERN =
  /^(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d{1,3}\.\d{1,3})$/i;

export function assertProductionWebApiBaseUrl(raw) {
  const value = raw?.trim();
  if (!value) throw new Error('VITE_API_BASE_URL é obrigatória em produção.');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Build web:prod exige VITE_API_BASE_URL absoluta.');
  }
  if (url.protocol !== 'https:') throw new Error('Build web:prod exige VITE_API_BASE_URL HTTPS.');
  if (url.pathname.replace(/\/$/, '') !== '/api')
    throw new Error('Build web:prod exige VITE_API_BASE_URL terminada em /api.');
  if (LOCAL_OR_LAN_HOSTNAME_PATTERN.test(url.hostname))
    throw new Error('Build web:prod não aceita VITE_API_BASE_URL local/LAN.');
  return value;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    assertProductionWebApiBaseUrl(process.env.VITE_API_BASE_URL);
    console.log('VITE_API_BASE_URL válida para build de produção.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Erro desconhecido.');
    process.exitCode = 1;
  }
}
