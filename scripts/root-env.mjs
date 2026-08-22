import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function readRootEnv(root, options = {}) {
  const exists = options.exists ?? existsSync;
  const readFile = options.readFile ?? ((path) => readFileSync(path, 'utf8'));
  const path = resolve(root, '.env');

  if (!exists(path)) return { path, exists: false, values: {}, parseError: false };

  try {
    return { path, exists: true, values: parseEnv(readFile(path)), parseError: false };
  } catch {
    return { path, exists: true, values: {}, parseError: true };
  }
}

export function inspectRootEnv(root, options = {}) {
  const env = options.env ?? process.env;
  const rootEnv = readRootEnv(root, options);
  const externalDatabaseUrl = hasOwn(env, 'DATABASE_URL');
  const fileDatabaseUrl = hasOwn(rootEnv.values, 'DATABASE_URL');

  return {
    path: rootEnv.path,
    exists: rootEnv.exists,
    parseError: rootEnv.parseError,
    databaseUrl: externalDatabaseUrl
      ? env.DATABASE_URL
      : fileDatabaseUrl
        ? rootEnv.values.DATABASE_URL
        : undefined,
    databaseUrlSource: externalDatabaseUrl
      ? 'process.env'
      : fileDatabaseUrl
        ? 'arquivo .env raiz'
        : null,
  };
}

export function loadRootEnv(root, options = {}) {
  const env = options.env ?? process.env;
  const rootEnv = readRootEnv(root, options);

  if (!rootEnv.exists) return { path: rootEnv.path, loaded: false, loadedKeys: [] };
  if (rootEnv.parseError) {
    throw new Error('O arquivo .env raiz não pôde ser interpretado.');
  }

  const loadedKeys = [];
  for (const [name, value] of Object.entries(rootEnv.values)) {
    if (hasOwn(env, name)) continue;
    env[name] = value;
    loadedKeys.push(name);
  }

  return { path: rootEnv.path, loaded: true, loadedKeys };
}
