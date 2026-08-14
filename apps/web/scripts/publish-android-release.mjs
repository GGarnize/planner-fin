import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createS3ReleaseStorage } from '@planner-fin/storage';
import { computeSha256 } from './build-android-release.mjs';

export const LATEST_KEY = 'android/latest.json';

export function releaseKeyFor(version) {
  return `android/releases/${version}/planner-fin-${version}.apk`;
}
export function sha256KeyFor(version) {
  return `${releaseKeyFor(version)}.sha256`;
}
export function metadataKeyFor(version) {
  return `android/releases/${version}/metadata.json`;
}

export function assertValidVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
    throw new Error('Versão deve ser SemVer 0.x.y (ex: 0.1.0).');
  }
}

export function assertMetadataMatchesArtifacts(metadata, { version, sha256, size }) {
  if (metadata.version !== version) {
    throw new Error('metadata.json.version não corresponde à versão sendo publicada.');
  }
  if (metadata.sha256 !== sha256) {
    throw new Error('metadata.json.sha256 não corresponde ao checksum local do APK.');
  }
  if (metadata.size !== size) {
    throw new Error('metadata.json.size não corresponde ao tamanho do APK local.');
  }
}

export function parseArgs(argv) {
  const args = { version: undefined, yes: false };
  for (const arg of argv) {
    if (arg === '--yes') args.yes = true;
    else if (arg.startsWith('--version=')) args.version = arg.slice('--version='.length);
  }
  return args;
}

export function readLocalArtifacts(dir, version) {
  const apkName = `planner-fin-${version}.apk`;
  const apkPath = join(dir, apkName);
  const sha256Path = `${apkPath}.sha256`;
  const metadataPath = join(dir, 'metadata.json');
  if (!existsSync(apkPath)) {
    throw new Error(
      `Artefato local não encontrado: ${apkPath}. Rode "pnpm android:release:build" antes de publicar.`,
    );
  }
  const apkBuffer = readFileSync(apkPath);
  const sha256 = readFileSync(sha256Path, 'utf8').trim().split(/\s+/)[0];
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  const computed = computeSha256(apkBuffer);
  if (computed !== sha256) {
    throw new Error('Checksum local não confere com o arquivo .sha256 — build local pode estar corrompido.');
  }
  return { apkBuffer, sha256, metadata };
}

export async function readCurrentLatest(storage) {
  const info = await storage.headObject(LATEST_KEY);
  if (!info.exists) return null;
  const raw = await storage.getObject(LATEST_KEY);
  return JSON.parse(raw.toString('utf8'));
}

/**
 * Publica uma release de forma imutável: falha se a versão já existir, verifica o objeto
 * remoto após o upload e só então atualiza o ponteiro latest.json (única exceção que pode
 * ser sobrescrita, pois é apenas metadado — nunca o APK).
 */
export async function publishRelease({ storage, version, apkBuffer, sha256, metadata, confirm, log = () => {} }) {
  assertValidVersion(version);
  if (!confirm) throw new Error('Publicação requer confirmação explícita (--yes).');
  assertMetadataMatchesArtifacts(metadata, { version, sha256, size: apkBuffer.byteLength });

  const apkKey = releaseKeyFor(version);
  const existing = await storage.headObject(apkKey);
  if (existing.exists) {
    throw new Error(
      `Release ${version} já existe no bucket — publicação é imutável e não pode ser sobrescrita.`,
    );
  }

  const currentLatest = await readCurrentLatest(storage);
  if (currentLatest && metadata.versionCode <= currentLatest.versionCode) {
    throw new Error(
      `versionCode ${metadata.versionCode} não é maior que o latest publicado (${currentLatest.versionCode}).`,
    );
  }

  await storage.putObjectIfAbsent(apkKey, apkBuffer, 'application/vnd.android.package-archive');
  log(`Upload concluído: ${apkKey} (${apkBuffer.byteLength} bytes)`);

  try {
    await storage.putObjectIfAbsent(
      sha256KeyFor(version),
      Buffer.from(`${sha256}  planner-fin-${version}.apk\n`),
      'text/plain',
    );
    await storage.putObjectIfAbsent(
      metadataKeyFor(version),
      Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`),
      'application/json',
    );

    const remoteBuffer = await storage.getObject(apkKey);
    const remoteSha256 = computeSha256(remoteBuffer);
    if (remoteSha256 !== sha256) {
      throw new Error('Verificação remota falhou: sha256 do objeto enviado não confere com o local.');
    }
    log('Verificação remota do APK publicado: OK.');
  } catch (error) {
    log('Falha na verificação pós-upload — revertendo objetos recém-publicados.');
    await storage.deleteObject(apkKey).catch(() => {});
    await storage.deleteObject(sha256KeyFor(version)).catch(() => {});
    await storage.deleteObject(metadataKeyFor(version)).catch(() => {});
    throw error;
  }

  const latestPointer = {
    version,
    versionCode: metadata.versionCode,
    key: apkKey,
    sha256,
    size: apkBuffer.byteLength,
    applicationId: metadata.applicationId,
    createdAt: metadata.createdAt,
  };
  await storage.deleteObject(LATEST_KEY).catch(() => {});
  await storage.putObjectIfAbsent(
    LATEST_KEY,
    Buffer.from(`${JSON.stringify(latestPointer, null, 2)}\n`),
    'application/json',
  );
  log(`latest.json atualizado para ${version} (versionCode ${metadata.versionCode}).`);
  return latestPointer;
}

function requiredEnvFrom(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(
      `Publicação exige a variável de bucket ${name} (ver docs/runbooks/ANDROID-RELEASE-BUCKET.md).`,
    );
  }
  return value;
}

export function loadBucketConfigFromEnv(env) {
  return {
    bucket: requiredEnvFrom(env, 'BUCKET'),
    endpoint: requiredEnvFrom(env, 'ENDPOINT'),
    region: requiredEnvFrom(env, 'REGION'),
    accessKeyId: requiredEnvFrom(env, 'ACCESS_KEY_ID'),
    secretAccessKey: requiredEnvFrom(env, 'SECRET_ACCESS_KEY'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = args.version ?? JSON.parse(readFileSync('package.json', 'utf8')).version;
  assertValidVersion(version);

  const artifactsDir = join('..', '..', 'artifacts', 'android-releases', version);
  const { apkBuffer, sha256, metadata } = readLocalArtifacts(artifactsDir, version);

  if (!args.yes) {
    console.log(
      `Plano de publicação (dry-run): version=${version} versionCode=${metadata.versionCode} sha256=${sha256} size=${apkBuffer.byteLength}`,
    );
    console.log('Nenhuma alteração remota foi feita. Rode novamente com --yes para confirmar a publicação.');
    process.exitCode = 1;
    return;
  }

  const bucketConfig = loadBucketConfigFromEnv(process.env);
  const storage = createS3ReleaseStorage(bucketConfig);
  const latestPointer = await publishRelease({
    storage,
    version,
    apkBuffer,
    sha256,
    metadata,
    confirm: true,
    log: console.log,
  });
  console.log(
    `Publicação concluída: ${latestPointer.version} é agora a release latest (versionCode ${latestPointer.versionCode}).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Erro desconhecido.');
    process.exitCode = 1;
  });
}
