import { readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

export function isPrivateIPv4(ip) {
  const parts = String(ip)
    .split('.')
    .map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function isVirtualAdapterName(value) {
  return /docker|wsl|hyper-v|hyperv|virtual|vmware|vbox|loopback|teredo|isatap|bluetooth|npcap/i.test(
    String(value ?? ''),
  );
}

export function selectLanIPv4(adapters, override) {
  if (override) {
    if (!isPrivateIPv4(override))
      throw new Error('Override de IP LAN deve ser IPv4 privado valido.');
    return override;
  }

  const candidates = adapters
    .filter((adapter) => adapter && isPrivateIPv4(adapter.ip))
    .filter((adapter) => !adapter.ip.startsWith('127.'))
    .filter(
      (adapter) => !isVirtualAdapterName(`${adapter.name ?? ''} ${adapter.description ?? ''}`),
    )
    .sort((a, b) => scoreAdapter(b) - scoreAdapter(a));

  if (!candidates.length) throw new Error('Nenhum IPv4 LAN utilizavel foi detectado.');
  return candidates[0].ip;
}

function scoreAdapter(adapter) {
  const text = `${adapter.name ?? ''} ${adapter.description ?? ''}`;
  let score = 0;
  if (/wi-?fi|wireless|wlan/i.test(text)) score += 20;
  if (/ethernet|gbe|lan/i.test(text)) score += 15;
  if (String(adapter.ip).startsWith('192.168.')) score += 5;
  return score;
}

export function composeApiBaseUrl({ target, lanIp, remoteUrl }) {
  if (target === 'emulator') return 'https://10.0.2.2:3443/api';
  if (target === 'lan') {
    if (!lanIp) throw new Error('IP LAN e obrigatorio para build LAN.');
    return `https://${lanIp}:3443/api`;
  }
  if (target === 'remote') return validateRemoteApiBaseUrl(remoteUrl);
  throw new Error(`Target Android invalido: ${target}`);
}

export function validateRemoteApiBaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('PLANNER_FIN_REMOTE_API_BASE_URL deve ser uma URL absoluta.');
  }
  if (parsed.protocol !== 'https:') throw new Error('Modo remoto exige HTTPS.');
  if (parsed.username || parsed.password)
    throw new Error('Modo remoto nao aceita credenciais na URL.');
  if (parsed.pathname !== '/api') throw new Error('URL remota deve terminar exatamente em /api.');
  if (parsed.search || parsed.hash)
    throw new Error('URL remota nao deve conter query string nem fragmento.');
  return parsed.toString().replace(/\/$/, '');
}

export function assertHttpsApiBaseUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.pathname !== '/api') {
    throw new Error('VITE_API_BASE_URL Android deve usar HTTPS e terminar em /api.');
  }
  return parsed.toString().replace(/\/$/, '');
}

export function withTemporaryEnv(env, changes, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(changes)) {
    previous.set(key, Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined);
    env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

export function findLatestApk(root) {
  const apks = [];
  walk(root, apks);
  apks.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return apks[0]?.path;
}

function walk(dir, apks) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, apks);
    else if (extname(entry).toLowerCase() === '.apk') apks.push({ path, mtimeMs: stat.mtimeMs });
  }
}
