import 'reflect-metadata';
import { HttpException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createInMemoryReleaseStorage, type ReleaseStorage } from '@planner-fin/storage';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimitService } from '../auth/rate-limit.service';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { ReleasesController } from './releases.controller';
import { ReleasesService } from './releases.service';
import { RELEASE_STORAGE } from './releases.tokens';

const VALID_METADATA = {
  version: '0.1.0',
  versionCode: 1,
  sha256: 'a'.repeat(64),
  size: 4,
  createdAt: '2026-08-14T00:00:00.000Z',
  gitCommit: 'abc123',
  applicationId: 'com.plannerfin.app',
  minSdk: 24,
  targetSdk: 36,
  apiBaseUrl: 'https://api.example.test/api',
};

async function seedRelease(storage: ReleaseStorage, version: string, metadata = VALID_METADATA) {
  await storage.putObjectIfAbsent(
    `android/releases/${version}/planner-fin-${version}.apk`,
    Buffer.from('apk!'),
    'application/vnd.android.package-archive',
  );
  await storage.putObjectIfAbsent(
    `android/releases/${version}/metadata.json`,
    Buffer.from(JSON.stringify({ ...metadata, version })),
    'application/json',
  );
}

async function publishLatest(storage: ReleaseStorage, version: string, metadata = VALID_METADATA) {
  await storage.putObjectIfAbsent(
    'android/latest.json',
    Buffer.from(
      JSON.stringify({
        version,
        versionCode: metadata.versionCode,
        key: `android/releases/${version}/planner-fin-${version}.apk`,
        sha256: metadata.sha256,
        size: metadata.size,
        applicationId: metadata.applicationId,
        createdAt: metadata.createdAt,
      }),
    ),
    'application/json',
  );
}

describe('contrato HTTP de /api/releases/android', () => {
  let app: INestApplication;
  let storage: ReleaseStorage;
  let rate: { check: ReturnType<typeof vi.fn> };

  async function buildApp(storageOverride: ReleaseStorage | null) {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReleasesController],
      providers: [
        ReleasesService,
        { provide: RELEASE_STORAGE, useValue: storageOverride },
        { provide: RateLimitService, useValue: rate },
      ],
    }).compile();
    const nestApp = moduleRef.createNestApplication();
    nestApp.setGlobalPrefix('api');
    nestApp.useGlobalFilters(new HttpExceptionFilter());
    await nestApp.init();
    return nestApp;
  }

  beforeEach(() => {
    storage = createInMemoryReleaseStorage();
    rate = { check: vi.fn() };
  });

  afterEach(async () => {
    await app?.close();
  });

  it('responde RELEASES_NOT_CONFIGURED (503) quando o bucket ainda não foi provisionado', async () => {
    app = await buildApp(null);
    const res = await request(app.getHttpServer()).get('/api/releases/android/latest').expect(503);
    expect(res.body).toMatchObject({ error: { code: 'RELEASES_NOT_CONFIGURED' } });
  });

  it('latest redireciona (302) para URL presignada de curta duração com Cache-Control no-store', async () => {
    await seedRelease(storage, '0.1.0');
    await publishLatest(storage, '0.1.0');
    app = await buildApp(storage);
    const res = await request(app.getHttpServer())
      .get('/api/releases/android/latest')
      .expect('Cache-Control', 'no-store')
      .expect(302);
    expect(res.headers.location).toContain('android/releases/0.1.0/planner-fin-0.1.0.apk');
    expect(res.headers.location).toContain('60');
    expect(rate.check).toHaveBeenCalledWith(expect.stringContaining('releases-android-latest:'), 30, 300_000);
  });

  it('latest responde 404 sanitizado quando nenhuma release foi publicada', async () => {
    app = await buildApp(storage);
    const res = await request(app.getHttpServer()).get('/api/releases/android/latest').expect(404);
    expect(res.body).toMatchObject({ error: { code: 'RELEASE_LATEST_NOT_FOUND' } });
  });

  it('latest responde 503 sanitizado quando latest.json está corrompido', async () => {
    await storage.putObjectIfAbsent('android/latest.json', Buffer.from('{ nao é json'), 'application/json');
    app = await buildApp(storage);
    const res = await request(app.getHttpServer()).get('/api/releases/android/latest').expect(503);
    expect(res.body).toMatchObject({ error: { code: 'RELEASE_LATEST_CORRUPTED' } });
  });

  it('baixa uma versão específica existente via redirect', async () => {
    await seedRelease(storage, '0.1.0');
    app = await buildApp(storage);
    const res = await request(app.getHttpServer()).get('/api/releases/android/0.1.0').expect(302);
    expect(res.headers.location).toContain('planner-fin-0.1.0.apk');
  });

  it('responde 404 sanitizado para versão inexistente', async () => {
    app = await buildApp(storage);
    const res = await request(app.getHttpServer()).get('/api/releases/android/9.9.9').expect(404);
    expect(res.body).toMatchObject({ error: { code: 'RELEASE_NOT_FOUND' } });
  });

  it('rejeita formatos de versão inválidos e tentativas de path traversal antes de tocar o storage', async () => {
    app = await buildApp(storage);
    const headSpy = vi.spyOn(storage, 'headObject');
    for (const invalid of ['latestx', '0.1', 'v0.1.0', '..%2f..%2fetc%2fpasswd', '0.1.0-beta']) {
      const res = await request(app.getHttpServer())
        .get(`/api/releases/android/${invalid}`)
        .expect(400);
      expect(res.body).toMatchObject({ error: { code: 'INVALID_VERSION' } });
    }
    expect(headSpy).not.toHaveBeenCalled();
  });

  it('retorna metadata.json quando a versão existe e 404 sanitizado quando não existe', async () => {
    await seedRelease(storage, '0.1.0');
    app = await buildApp(storage);
    const ok = await request(app.getHttpServer())
      .get('/api/releases/android/0.1.0/metadata')
      .expect('Cache-Control', 'no-store')
      .expect(200);
    expect(ok.body).toMatchObject({ version: '0.1.0', versionCode: 1, applicationId: 'com.plannerfin.app' });

    const missing = await request(app.getHttpServer())
      .get('/api/releases/android/0.2.0/metadata')
      .expect(404);
    expect(missing.body).toMatchObject({ error: { code: 'RELEASE_NOT_FOUND' } });
  });

  it('lista latest e histórico ordenado por versionCode desc', async () => {
    await seedRelease(storage, '0.1.0', { ...VALID_METADATA, versionCode: 1 });
    await seedRelease(storage, '0.1.1', { ...VALID_METADATA, versionCode: 2, sha256: 'b'.repeat(64) });
    await publishLatest(storage, '0.1.1', { ...VALID_METADATA, versionCode: 2, sha256: 'b'.repeat(64) });
    app = await buildApp(storage);
    const res = await request(app.getHttpServer()).get('/api/releases/android').expect(200);
    expect(res.body.latest).toMatchObject({ version: '0.1.1', versionCode: 2 });
    expect(res.body.versions.map((v: { version: string }) => v.version)).toStrictEqual(['0.1.1', '0.1.0']);
  });

  it('propaga limite de taxa (429) quando RateLimitService aciona', async () => {
    rate.check = vi.fn(() => {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.', retryAfter: 5 },
        429,
      );
    });
    await seedRelease(storage, '0.1.0');
    await publishLatest(storage, '0.1.0');
    app = await buildApp(storage);
    const res = await request(app.getHttpServer()).get('/api/releases/android/latest').expect(429);
    expect(res.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect(res.headers['retry-after']).toBe('5');
  });
});
