import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function computeNextPatchVersion(version) {
  const match = SEMVER_PATTERN.exec(String(version ?? ''));
  if (!match) throw new Error(`Versão inválida para bump de patch: ${version}`);
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

export function computeNextVersionCode(versionCode) {
  if (!Number.isInteger(versionCode) || versionCode < 1) {
    throw new Error(`versionCode inválido para incremento: ${versionCode}`);
  }
  return versionCode + 1;
}

const BUILD_TOOLS_REQUIRED_FILES_WIN32 = ['apksigner.bat', 'aapt.exe'];
const BUILD_TOOLS_REQUIRED_FILES_POSIX = ['apksigner', 'aapt'];

function compareVersionDirs(a, b) {
  const partsA = a.split('.').map((part) => Number(part));
  const partsB = b.split('.').map((part) => Number(part));
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i += 1) {
    const diff = (partsB[i] || 0) - (partsA[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Percorre <sdkDir>/build-tools/* do mais novo para o mais antigo e retorna o primeiro
 * diretório que contenha de fato apksigner e aapt (build-tools mais recente pode estar
 * incompleto, ex: 36.0.0 sem apksigner/aapt neste ambiente). listDirFn/existsFn são
 * injetáveis apenas para teste.
 */
export function findCompleteBuildTools(
  sdkDir,
  { listDirFn = readdirSync, existsFn = existsSync, platform = process.platform } = {},
) {
  const buildToolsRoot = join(sdkDir, 'build-tools');
  if (!existsFn(buildToolsRoot)) {
    throw new Error(`build-tools não encontrado em ${buildToolsRoot}.`);
  }
  const required =
    platform === 'win32' ? BUILD_TOOLS_REQUIRED_FILES_WIN32 : BUILD_TOOLS_REQUIRED_FILES_POSIX;
  const candidates = listDirFn(buildToolsRoot)
    .filter((name) => /^\d+(\.\d+)*$/.test(name))
    .sort(compareVersionDirs);
  for (const version of candidates) {
    const dir = join(buildToolsRoot, version);
    const complete = required.every((file) => existsFn(join(dir, file)));
    if (complete) return { version, path: dir };
  }
  throw new Error(
    `Nenhuma versão completa de build-tools encontrada em ${buildToolsRoot} (precisa de ${required.join(' e ')}).`,
  );
}

export const NON_SECRET_CONFIG_FIELDS = [
  'apiBaseUrlProd',
  'keystoreFile',
  'keyAlias',
  'androidSdkDir',
  'bucket',
  'endpoint',
  'region',
];

const SECRET_LOOKING_KEY_PATTERN = /password|secret|token|accesskey|access_key/i;

export function assertNoSecretLikeFields(config) {
  const offending = Object.keys(config ?? {}).filter((key) => SECRET_LOOKING_KEY_PATTERN.test(key));
  if (offending.length) {
    throw new Error(
      `release-config.json não pode conter campos de segredo (${offending.join(', ')}) — use o Credential Manager.`,
    );
  }
}

/**
 * Lê o config não secreto; se o arquivo não existir, cria um template com placeholders e
 * retorna { created: true } para o chamador orientar o usuário a preenchê-lo. Nunca aceita
 * campos que pareçam segredo (falha fechado).
 */
export function loadOrInitReleaseConfig(
  configPath,
  defaults,
  { existsFn = existsSync, readFileFn = readFileSync, writeFileFn = writeFileSync, mkdirFn = mkdirSync } = {},
) {
  assertNoSecretLikeFields(defaults);
  if (!existsFn(configPath)) {
    mkdirFn(dirname(configPath), { recursive: true });
    writeFileFn(configPath, `${JSON.stringify(defaults, null, 2)}\n`, 'utf8');
    return { config: defaults, created: true };
  }
  const config = JSON.parse(readFileFn(configPath, 'utf8'));
  assertNoSecretLikeFields(config);
  return { config, created: false };
}

export function assertConfigComplete(config, requiredFields = NON_SECRET_CONFIG_FIELDS) {
  const missing = requiredFields.filter((field) => !config?.[field]);
  if (missing.length) {
    throw new Error(`release-config.json incompleto — preencha: ${missing.join(', ')}.`);
  }
  return config;
}

/**
 * Sempre grava (sobrescreve) o release-config.json não secreto — usado pelo comando
 * "setup" depois de coletar os valores atualizados do usuário. Diferente de
 * loadOrInitReleaseConfig, que só cria um template quando o arquivo ainda não existe e
 * nunca sobrescreve um já presente.
 */
export function saveReleaseConfig(
  configPath,
  config,
  { writeFileFn = writeFileSync, mkdirFn = mkdirSync } = {},
) {
  assertNoSecretLikeFields(config);
  mkdirFn(dirname(configPath), { recursive: true });
  writeFileFn(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return config;
}

/**
 * Falha fechada: nenhum segredo obrigatório pode estar ausente/vazio. Usado tanto para as
 * senhas de assinatura quanto para as credenciais do bucket Railway antes de exportar env
 * vars para o processo filho.
 */
export function assertRequiredSecrets(secrets, requiredNames) {
  const missing = requiredNames.filter((name) => !secrets?.[name]);
  if (missing.length) {
    throw new Error(
      `Segredo obrigatório ausente no Windows Credential Manager: ${missing.join(', ')}. Rode "pnpm android:release:setup".`,
    );
  }
}

const REDACTED = '***REDACTED***';

export function redactSecrets(obj, secretKeys) {
  const clone = { ...obj };
  for (const key of secretKeys) {
    if (key in clone) clone[key] = REDACTED;
  }
  return clone;
}

const ALLOWED_RELEASE_BUMP_PATHS = new Set([
  'apps/web/package.json',
  'apps/web/android/version.json',
]);

/** Extrai os paths (relativos, `/` normalizado) de uma saída `git status --porcelain`. */
export function parsePorcelainPaths(porcelainOutput) {
  return String(porcelainOutput ?? '')
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.slice(3).trim().replaceAll('\\', '/'));
}

/**
 * Recebe a saída de `git status --porcelain` (já como string) e garante que o repositório
 * está limpo, ou que as únicas alterações pendentes sejam os arquivos de bump de versão
 * previstos (package.json/version.json). Qualquer outra alteração (staged ou não) bloqueia
 * a release automatizada.
 */
export function assertRepoCleanForRelease(porcelainOutput, allowedPaths = ALLOWED_RELEASE_BUMP_PATHS) {
  const paths = parsePorcelainPaths(porcelainOutput);
  const unexpected = paths.filter((path) => !allowedPaths.has(path));
  if (unexpected.length) {
    throw new Error(
      `Repositório não está limpo para release automatizada. Arquivos inesperados: ${unexpected.join(', ')}`,
    );
  }
  return paths;
}

/**
 * Diferencia três estados do repositório antes de sugerir um bump, para nunca incrementar
 * a versão duas vezes numa retomada:
 *  - "clean": nada modificado — fluxo normal de bump a partir do HEAD.
 *  - "pending-bump": só os dois arquivos de bump previstos estão modificados E a
 *    versão/versionCode do working tree já difere do HEAD — uma tentativa anterior já
 *    bumpou mas não terminou (build/publish falhou). O chamador deve oferecer retomar
 *    exatamente essa versão pendente, nunca sugerir um novo next-patch em cima dela.
 *  - "blocked": há arquivo inesperado fora do bump previsto, OU os dois arquivos de bump
 *    foram tocados sem mudança real de versão/versionCode (estado ambíguo demais para
 *    decidir automaticamente).
 */
export function detectReleaseResumeState({
  porcelainOutput,
  headVersion,
  headVersionCode,
  workingVersion,
  workingVersionCode,
  allowedPaths = ALLOWED_RELEASE_BUMP_PATHS,
}) {
  const paths = parsePorcelainPaths(porcelainOutput);
  if (paths.length === 0) {
    return { state: 'clean' };
  }

  const unexpectedFiles = paths.filter((path) => !allowedPaths.has(path));
  if (unexpectedFiles.length) {
    return { state: 'blocked', unexpectedFiles };
  }

  const versionChanged = workingVersion !== headVersion || workingVersionCode !== headVersionCode;
  if (!versionChanged) {
    return {
      state: 'blocked',
      unexpectedFiles: paths,
      reason:
        'Arquivos de bump foram modificados, mas versão/versionCode não mudaram em relação ao HEAD.',
    };
  }

  return {
    state: 'pending-bump',
    baseVersion: headVersion,
    baseVersionCode: headVersionCode,
    pendingVersion: workingVersion,
    pendingVersionCode: workingVersionCode,
  };
}

const SDK_DIR_LINE_PATTERN = /^[ \t]*sdk\.dir[ \t]*=[ \t]*(.*)$/m;

export function normalizeSdkDirForProperties(sdkDir) {
  return String(sdkDir).replaceAll('\\', '\\\\');
}

/** Lê o valor de sdk.dir de um conteúdo de local.properties, já des-escapado (`\\` -> `\`). */
export function parseSdkDirFromLocalProperties(content) {
  const match = SDK_DIR_LINE_PATTERN.exec(content ?? '');
  if (!match) return null;
  return match[1].trim().replaceAll('\\\\', '\\');
}

function normalizePathForCompare(path) {
  return String(path ?? '')
    .trim()
    .replace(/[\\/]+$/, '')
    .toLowerCase();
}

/**
 * Compara o sdk.dir efetivo de local.properties com o androidSdkDir configurado.
 * `content` é `null`/`undefined` quando o arquivo não existe (nunca uma string vazia
 * ambígua) — o chamador decide isso a partir de um Test-Path antes de ler o arquivo.
 */
export function checkLocalPropertiesSdkDir(content, desiredSdkDir) {
  if (content === null || content === undefined) {
    return { status: 'missing', currentSdkDir: null };
  }
  const currentSdkDir = parseSdkDirFromLocalProperties(content);
  if (!currentSdkDir) {
    return { status: 'missing_key', currentSdkDir: null };
  }
  if (normalizePathForCompare(currentSdkDir) === normalizePathForCompare(desiredSdkDir)) {
    return { status: 'ok', currentSdkDir };
  }
  return { status: 'stale', currentSdkDir };
}

/**
 * Constrói o novo conteúdo de local.properties com sdk.dir apontando para desiredSdkDir,
 * preservando qualquer outra linha já presente (nunca sobrescreve o arquivo inteiro).
 * `existingContent` null/undefined significa "arquivo ainda não existe".
 */
export function buildLocalPropertiesContent(existingContent, desiredSdkDir) {
  const line = `sdk.dir=${normalizeSdkDirForProperties(desiredSdkDir)}`;
  if (existingContent === null || existingContent === undefined) {
    return `${line}\n`;
  }
  if (SDK_DIR_LINE_PATTERN.test(existingContent)) {
    return existingContent.replace(SDK_DIR_LINE_PATTERN, line);
  }
  const withTrailingNewline = existingContent.endsWith('\n') ? existingContent : `${existingContent}\n`;
  return `${withTrailingNewline}${line}\n`;
}

const command = process.argv[2];

function main() {
  if (command === 'next-patch') {
    console.log(computeNextPatchVersion(process.argv[3]));
  } else if (command === 'next-version-code') {
    console.log(computeNextVersionCode(Number(process.argv[3])));
  } else if (command === 'find-build-tools') {
    console.log(JSON.stringify(findCompleteBuildTools(process.argv[3])));
  } else if (command === 'init-config') {
    const configPath = process.argv[3];
    const defaults = JSON.parse(Buffer.from(process.argv[4], 'base64').toString('utf8'));
    console.log(JSON.stringify(loadOrInitReleaseConfig(configPath, defaults)));
  } else if (command === 'write-config') {
    const configPath = process.argv[3];
    const config = JSON.parse(Buffer.from(process.argv[4], 'base64').toString('utf8'));
    console.log(JSON.stringify(saveReleaseConfig(configPath, config)));
  } else if (command === 'assert-config-complete') {
    const configPath = process.argv[3];
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    assertConfigComplete(config);
    console.log('complete');
  } else if (command === 'check-clean') {
    const output = readFileSync(0, 'utf8');
    assertRepoCleanForRelease(output);
    console.log('clean');
  } else if (command === 'detect-resume-state') {
    const payload = JSON.parse(readFileSync(0, 'utf8'));
    console.log(JSON.stringify(detectReleaseResumeState(payload)));
  } else if (command === 'check-local-properties') {
    const desiredSdkDir = process.argv[3];
    const absent = process.argv.includes('--absent');
    const content = absent ? null : readFileSync(0, 'utf8');
    console.log(JSON.stringify(checkLocalPropertiesSdkDir(content, desiredSdkDir)));
  } else if (command === 'sync-local-properties') {
    const desiredSdkDir = process.argv[3];
    const absent = process.argv.includes('--absent');
    const content = absent ? null : readFileSync(0, 'utf8');
    const newContent = buildLocalPropertiesContent(content, desiredSdkDir);
    console.log(JSON.stringify({ content: newContent, changed: newContent !== (content ?? '') }));
  } else {
    throw new Error(
      'Uso: node scripts/android/release-helpers.mjs next-patch|next-version-code|find-build-tools|init-config|write-config|assert-config-complete|check-clean|detect-resume-state|check-local-properties|sync-local-properties',
    );
  }
}

if (command) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
