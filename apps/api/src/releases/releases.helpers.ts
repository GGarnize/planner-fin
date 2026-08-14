export const RELEASES_PREFIX = 'android/releases/';
export const LATEST_KEY = 'android/latest.json';
export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
export const RELEASE_PRESIGN_TTL_SECONDS = 60;

export function isValidVersion(version: string): boolean {
  return VERSION_PATTERN.test(version);
}

export function releaseKeyFor(version: string): string {
  return `${RELEASES_PREFIX}${version}/planner-fin-${version}.apk`;
}

export function metadataKeyFor(version: string): string {
  return `${RELEASES_PREFIX}${version}/metadata.json`;
}

export interface ReleaseMetadata {
  version: string;
  versionCode: number;
  sha256: string;
  size: number;
  createdAt: string;
  gitCommit: string;
  applicationId: string;
  minSdk: number;
  targetSdk: number;
  apiBaseUrl: string;
}

export interface LatestPointer {
  version: string;
  versionCode: number;
  key: string;
  sha256: string;
  size: number;
  applicationId: string;
  createdAt: string;
}

export interface ReleaseSummary {
  version: string;
  versionCode: number;
  sha256: string;
  size: number;
  createdAt: string;
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

export function isValidMetadataShape(
  value: unknown,
  expectedVersion: string,
): value is ReleaseMetadata {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === expectedVersion &&
    Number.isInteger(v.versionCode) &&
    typeof v.sha256 === 'string' &&
    SHA256_PATTERN.test(v.sha256) &&
    Number.isInteger(v.size) &&
    typeof v.createdAt === 'string' &&
    typeof v.gitCommit === 'string' &&
    typeof v.applicationId === 'string' &&
    Number.isInteger(v.minSdk) &&
    Number.isInteger(v.targetSdk) &&
    typeof v.apiBaseUrl === 'string'
  );
}

export function isValidLatestPointerShape(value: unknown): value is LatestPointer {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.version === 'string' &&
    isValidVersion(v.version) &&
    Number.isInteger(v.versionCode) &&
    typeof v.key === 'string' &&
    v.key === releaseKeyFor(v.version) &&
    typeof v.sha256 === 'string' &&
    SHA256_PATTERN.test(v.sha256) &&
    Number.isInteger(v.size) &&
    typeof v.applicationId === 'string' &&
    typeof v.createdAt === 'string'
  );
}
