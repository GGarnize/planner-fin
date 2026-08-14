import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ReleaseStorage } from '@planner-fin/storage';
import {
  isValidLatestPointerShape,
  isValidMetadataShape,
  isValidVersion,
  LATEST_KEY,
  metadataKeyFor,
  RELEASE_PRESIGN_TTL_SECONDS,
  RELEASES_PREFIX,
  releaseKeyFor,
  type LatestPointer,
  type ReleaseMetadata,
  type ReleaseSummary,
} from './releases.helpers';
import { RELEASE_STORAGE } from './releases.tokens';

@Injectable()
export class ReleasesService {
  constructor(@Inject(RELEASE_STORAGE) private readonly storage: ReleaseStorage | null) {}

  async resolveLatestDownload(): Promise<{ url: string }> {
    const storage = this.requireStorage();
    const latest = await this.requireLatestPointer(storage);
    const url = await storage.presignGetObject(latest.key, RELEASE_PRESIGN_TTL_SECONDS);
    return { url };
  }

  async resolveVersionDownload(version: string): Promise<{ url: string }> {
    this.assertValidVersion(version);
    const storage = this.requireStorage();
    const key = releaseKeyFor(version);
    const info = await storage.headObject(key);
    if (!info.exists) throw releaseNotFound();
    const url = await storage.presignGetObject(key, RELEASE_PRESIGN_TTL_SECONDS);
    return { url };
  }

  async getMetadata(version: string): Promise<ReleaseMetadata> {
    this.assertValidVersion(version);
    const storage = this.requireStorage();
    return this.readMetadata(storage, version);
  }

  async list(): Promise<{ latest: LatestPointer | null; versions: ReleaseSummary[] }> {
    const storage = this.requireStorage();
    const latest = await this.tryReadLatestPointer(storage);
    const keys = await storage.listKeys(RELEASES_PREFIX);
    const versions = [...new Set(keys.map((key) => key.slice(RELEASES_PREFIX.length).split('/')[0]))]
      .filter((version): version is string => Boolean(version) && isValidVersion(version));

    const summaries = await Promise.all(
      versions.map(async (version): Promise<ReleaseSummary | null> => {
        try {
          const metadata = await this.readMetadata(storage, version);
          return {
            version: metadata.version,
            versionCode: metadata.versionCode,
            sha256: metadata.sha256,
            size: metadata.size,
            createdAt: metadata.createdAt,
          };
        } catch {
          return null;
        }
      }),
    );

    return {
      latest,
      versions: summaries
        .filter((summary): summary is ReleaseSummary => summary !== null)
        .sort((a, b) => b.versionCode - a.versionCode),
    };
  }

  private assertValidVersion(version: string): void {
    if (!isValidVersion(version)) {
      throw new BadRequestException({ code: 'INVALID_VERSION', message: 'Versão inválida.' });
    }
  }

  private requireStorage(): ReleaseStorage {
    if (!this.storage) {
      throw new ServiceUnavailableException({
        code: 'RELEASES_NOT_CONFIGURED',
        message: 'Distribuição de releases Android ainda não está configurada.',
      });
    }
    return this.storage;
  }

  private async requireLatestPointer(storage: ReleaseStorage): Promise<LatestPointer> {
    const pointer = await this.tryReadLatestPointer(storage);
    if (!pointer) {
      throw new NotFoundException({
        code: 'RELEASE_LATEST_NOT_FOUND',
        message: 'Nenhuma release publicada ainda.',
      });
    }
    return pointer;
  }

  private async tryReadLatestPointer(storage: ReleaseStorage): Promise<LatestPointer | null> {
    const info = await storage.headObject(LATEST_KEY);
    if (!info.exists) return null;
    const raw = await storage.getObject(LATEST_KEY);
    const parsed: unknown = safeJsonParse(raw.toString('utf8'));
    if (!isValidLatestPointerShape(parsed)) {
      throw new ServiceUnavailableException({
        code: 'RELEASE_LATEST_CORRUPTED',
        message: 'Metadado de release latest inválido.',
      });
    }
    return parsed;
  }

  private async readMetadata(storage: ReleaseStorage, version: string): Promise<ReleaseMetadata> {
    const key = metadataKeyFor(version);
    const info = await storage.headObject(key);
    if (!info.exists) throw releaseNotFound();
    const raw = await storage.getObject(key);
    const parsed: unknown = safeJsonParse(raw.toString('utf8'));
    if (!isValidMetadataShape(parsed, version)) {
      throw new ServiceUnavailableException({
        code: 'RELEASE_METADATA_CORRUPTED',
        message: 'Metadado de release inválido.',
      });
    }
    return parsed;
  }
}

function releaseNotFound() {
  return new NotFoundException({ code: 'RELEASE_NOT_FOUND', message: 'Release não encontrada.' });
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
