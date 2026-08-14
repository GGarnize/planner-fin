import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface ReleaseObjectInfo {
  exists: boolean;
  size?: number;
  etag?: string;
}

export interface ReleaseStorage {
  headObject(key: string): Promise<ReleaseObjectInfo>;
  /**
   * Falha com ReleaseObjectAlreadyExistsError se um HEAD anterior ao PUT encontrar o objeto.
   * Railway Bucket não suporta object-lock/versionamento nativo, então a imutabilidade é
   * garantida pela aplicação (check-then-put), não pelo backend de storage.
   */
  putObjectIfAbsent(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  listKeys(prefix: string): Promise<string[]>;
  presignGetObject(key: string, expiresInSeconds: number): Promise<string>;
}

export class ReleaseObjectAlreadyExistsError extends Error {
  constructor(key: string) {
    super(`Objeto já existe e não pode ser sobrescrito: ${key}`);
    this.name = 'ReleaseObjectAlreadyExistsError';
  }
}

export class ReleaseObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`Objeto não encontrado: ${key}`);
    this.name = 'ReleaseObjectNotFoundError';
  }
}

export interface S3ReleaseStorageConfig {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function createS3ReleaseStorage(config: S3ReleaseStorageConfig): ReleaseStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  const bucket = config.bucket;

  async function headObject(key: string): Promise<ReleaseObjectInfo> {
    try {
      const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { exists: true, size: result.ContentLength, etag: result.ETag };
    } catch (error) {
      if (isNotFoundError(error)) return { exists: false };
      throw error;
    }
  }

  return {
    headObject,
    async putObjectIfAbsent(key, body, contentType) {
      const existing = await headObject(key);
      if (existing.exists) throw new ReleaseObjectAlreadyExistsError(key);
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },
    async getObject(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const body = await result.Body?.transformToByteArray();
        if (!body) throw new ReleaseObjectNotFoundError(key);
        return Buffer.from(body);
      } catch (error) {
        if (isNotFoundError(error)) throw new ReleaseObjectNotFoundError(key);
        throw error;
      }
    },
    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async listKeys(prefix) {
      const keys: string[] = [];
      let continuationToken: string | undefined;
      do {
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        );
        for (const object of result.Contents ?? []) {
          if (object.Key) keys.push(object.Key);
        }
        continuationToken = result.NextContinuationToken;
      } while (continuationToken);
      return keys;
    },
    async presignGetObject(key, expiresInSeconds) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: expiresInSeconds,
      });
    },
  };
}

function isNotFoundError(error: unknown): boolean {
  const name = (error as { name?: string } | undefined)?.name;
  const statusCode = (error as { $metadata?: { httpStatusCode?: number } } | undefined)?.$metadata
    ?.httpStatusCode;
  return name === 'NotFound' || name === 'NoSuchKey' || statusCode === 404;
}

interface InMemoryObject {
  body: Buffer;
  contentType: string;
}

/** Storage em memória para testes. Nunca deve ser usado fora de suites de teste. */
export function createInMemoryReleaseStorage(): ReleaseStorage & {
  dump(): ReadonlyMap<string, InMemoryObject>;
} {
  const store = new Map<string, InMemoryObject>();

  return {
    async headObject(key) {
      const object = store.get(key);
      if (!object) return { exists: false };
      return { exists: true, size: object.body.byteLength, etag: `"${object.body.byteLength}"` };
    },
    async putObjectIfAbsent(key, body, contentType) {
      if (store.has(key)) throw new ReleaseObjectAlreadyExistsError(key);
      store.set(key, { body, contentType });
    },
    async getObject(key) {
      const object = store.get(key);
      if (!object) throw new ReleaseObjectNotFoundError(key);
      return object.body;
    },
    async deleteObject(key) {
      store.delete(key);
    },
    async listKeys(prefix) {
      return [...store.keys()].filter((key) => key.startsWith(prefix));
    },
    async presignGetObject(key, expiresInSeconds) {
      if (!store.has(key)) throw new ReleaseObjectNotFoundError(key);
      return `https://fake-storage.test/${key}?X-Fake-Expires=${expiresInSeconds}`;
    },
    dump() {
      return store;
    },
  };
}
