import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_CONFIG } from '../auth/auth.types';
import { AuthGuard } from '../auth/auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { RateLimitService } from '../auth/rate-limit.service';
import { TokenService } from '../auth/token.service';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { VersionDto } from './dto';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

const userId = '11111111-1111-4111-8111-111111111121';
const sessionId = '22222222-2222-4222-8222-222222222221';
const rowId = '33333333-3333-4333-8333-333333333321';
const accountId = '44444444-4444-4444-8444-444444444421';
const key = '55555555-5555-4555-8555-555555555521';

function okSession(extra: object = {}) {
  return {
    id: sessionId,
    accountId,
    format: 'CSV',
    status: 'READY_FOR_REVIEW',
    draftVersion: 1,
    displayFileName: 'extrato.csv',
    rowCount: 1,
    expiresAt: '2026-08-20T00:00:00.000Z',
    mapping: null,
    rows: [],
    page: { limit: 100, offset: 0, filteredCount: 0 },
    ...extra,
  };
}

describe('contrato HTTP de /api/imports', () => {
  let app: INestApplication;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let rate: { check: ReturnType<typeof vi.fn> };
  let tokenService: { verify: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = {
      create: vi.fn().mockResolvedValue(okSession({ status: 'MAPPING_REQUIRED' })),
      get: vi.fn().mockResolvedValue(okSession()),
      listOpen: vi.fn().mockResolvedValue([]),
      mapping: vi.fn().mockResolvedValue(okSession()),
      patchRow: vi.fn().mockResolvedValue(okSession()),
      preview: vi.fn().mockResolvedValue({
        previewToken: 'preview',
        previewHash: 'hash',
        draftVersion: 1,
        counts: { total: 1, selected: 1, blocked: 0, strong: 0, probable: 0, possible: 0 },
        totals: { income: '0.00', expense: '10.00' },
      }),
      confirm: vi.fn().mockResolvedValue({
        status: 'CONFIRMED',
        sessionId,
        transactionIds: ['66666666-6666-4666-8666-666666666621'],
        createdCount: 1,
      }),
      cancel: vi.fn().mockResolvedValue(undefined),
    };
    rate = { check: vi.fn() };
    tokenService = { verify: vi.fn().mockResolvedValue({ userId, sessionId: 'sessao' }) };
    const moduleRef = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        AuthGuard,
        CsrfGuard,
        { provide: ImportsService, useValue: service },
        { provide: RateLimitService, useValue: rate },
        { provide: TokenService, useValue: tokenService },
        {
          provide: API_CONFIG,
          useValue: {
            corsOrigins: ['https://localhost'],
            jwtSecret: 'x'.repeat(32),
            refreshHmacSecret: 'y'.repeat(32),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { headers: Record<string, string>; auth?: object };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          if (req.headers.authorization !== 'Bearer access') return false;
          req.auth = { userId, sessionId: 'sessao' };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors) =>
          new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'Dados invalidos.',
            details: errors.flatMap((error) =>
              Object.values(error.constraints ?? {}).map((message) => ({
                field: error.property,
                message,
              })),
            ),
          }),
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  function auth(req: request.Test) {
    return req.set('Authorization', 'Bearer access');
  }

  function csrf(req: request.Test) {
    return req
      .set('Origin', 'https://localhost')
      .set('X-CSRF-Token', 'csrf')
      .set('Cookie', ['planner_fin_csrf=csrf']);
  }

  it('bloqueia AuthGuard antes de expor sessao privada', async () => {
    const res = await request(app.getHttpServer()).get(`/api/imports/${sessionId}`).expect(403);
    expect(res.body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
    expect(service.get).not.toHaveBeenCalled();
  });

  it('exige CsrfGuard nas mutacoes', async () => {
    const res = await auth(request(app.getHttpServer()).post(`/api/imports/${sessionId}/preview`))
      .send({ draftVersion: 1 })
      .expect(403);
    expect(res.body).toMatchObject({ error: { code: 'CSRF_VALIDATION_FAILED' } });
    expect(service.preview).not.toHaveBeenCalled();
  });

  it('aplica Cache-Control no-store em leitura e mutacao', async () => {
    await auth(request(app.getHttpServer()).get('/api/imports?status=open'))
      .expect('Cache-Control', 'no-store')
      .expect(200);
    await auth(request(app.getHttpServer()).get(`/api/imports/${sessionId}`))
      .expect('Cache-Control', 'no-store')
      .expect(200);
    await csrf(auth(request(app.getHttpServer()).post(`/api/imports/${sessionId}/preview`)))
      .send({ draftVersion: 1 })
      .expect('Cache-Control', 'no-store')
      .expect(201);
  });

  it('valida whitelist de DTO com o pipe global usado pela API', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Dados invalidos.',
          details: errors.flatMap((error) =>
            Object.values(error.constraints ?? {}).map((message) => ({
              field: error.property,
              message,
            })),
          ),
        }),
    });
    await expect(
      pipe.transform(
        { draftVersion: 1, extra: true },
        { type: 'body', metatype: VersionDto, data: undefined },
      ),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('aciona rate limit em upload, preview e confirmacao', async () => {
    await csrf(auth(request(app.getHttpServer()).post('/api/imports')))
      .field('format', 'CSV')
      .field('accountId', accountId)
      .attach('file', Buffer.from('date,description,amount\n2026-08-13,Mercado,-10.00\n'), {
        filename: 'extrato.csv',
        contentType: 'text/csv',
      })
      .expect(201);
    await csrf(auth(request(app.getHttpServer()).post(`/api/imports/${sessionId}/preview`)))
      .send({ draftVersion: 1 })
      .expect(201);
    await csrf(auth(request(app.getHttpServer()).post(`/api/imports/${sessionId}/confirm`)))
      .set('Idempotency-Key', key)
      .send({ draftVersion: 1, previewToken: 'preview' })
      .expect(201);
    expect(rate.check.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        expect.stringContaining('import-upload:'),
        expect.stringContaining('import-preview:'),
        expect.stringContaining('import-confirm:'),
      ]),
    );
  });

  it('propaga envelopes canonicos para owner isolation, conflitos e preview stale', async () => {
    service.get.mockRejectedValueOnce(
      new BadRequestException({ code: 'IMPORT_NOT_FOUND', message: 'Importacao nao encontrada.' }),
    );
    await auth(request(app.getHttpServer()).get(`/api/imports/${sessionId}`))
      .expect(400)
      .expect((res) => expect(res.body.error.code).toBe('IMPORT_NOT_FOUND'));
    service.preview.mockRejectedValueOnce(
      new ConflictException({ code: 'IMPORT_DRAFT_STALE', message: 'Gere um preview atual.' }),
    );
    await csrf(auth(request(app.getHttpServer()).post(`/api/imports/${sessionId}/preview`)))
      .send({ draftVersion: 1 })
      .expect(409)
      .expect((res) => expect(res.body.error.code).toBe('IMPORT_DRAFT_STALE'));
    service.patchRow.mockRejectedValueOnce(
      new ConflictException({ code: 'IMPORT_VERSION_CONFLICT', message: 'O draft foi alterado.' }),
    );
    await csrf(auth(request(app.getHttpServer()).patch(`/api/imports/${sessionId}/rows/${rowId}`)))
      .send({ draftVersion: 1, selected: false })
      .expect(409)
      .expect((res) => expect(res.body.error.code).toBe('IMPORT_VERSION_CONFLICT'));
  });

  it('valida Idempotency-Key ausente/invalida e sessao terminal somente leitura', async () => {
    service.confirm.mockRejectedValueOnce(
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Idempotency-Key UUID e obrigatorio.',
      }),
    );
    await csrf(auth(request(app.getHttpServer()).post(`/api/imports/${sessionId}/confirm`)))
      .send({ draftVersion: 1, previewToken: 'preview' })
      .expect(400)
      .expect((res) => expect(res.body.error.code).toBe('VALIDATION_ERROR'));
    service.confirm.mockRejectedValueOnce(
      new ConflictException({ code: 'IMPORT_READ_ONLY', message: 'A sessao esta encerrada.' }),
    );
    await csrf(auth(request(app.getHttpServer()).post(`/api/imports/${sessionId}/confirm`)))
      .set('Idempotency-Key', key)
      .send({ draftVersion: 1, previewToken: 'preview' })
      .expect(409)
      .expect((res) => expect(res.body.error.code).toBe('IMPORT_READ_ONLY'));
  });
});
