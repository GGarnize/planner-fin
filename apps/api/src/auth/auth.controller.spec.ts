import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';
import type { AuthService, IssuedAuth } from './auth.service';
import type { RateLimitService } from './rate-limit.service';
import type { ApiConfig } from '../config/env';
import type { Request, Response } from 'express';

const issued: IssuedAuth = {
  response: {
    accessToken: 'access',
    expiresIn: 900,
    user: {
      id: 'u',
      name: 'Pessoa',
      email: 'pessoa@example.test',
      createdAt: '2026-08-10T00:00:00.000Z',
    },
  },
  refreshToken: 'session.refresh',
  csrfToken: 'csrf',
};
const config: ApiConfig = {
  port: 3000,
  databaseUrl: 'postgresql://test',
  corsOrigins: ['https://web.example.test', 'https://localhost'],
  jwtSecret: 'x'.repeat(32),
  refreshHmacSecret: 'y'.repeat(32),
  jwtIssuer: 'issuer',
  jwtAudience: 'audience',
  accessTokenSeconds: 900,
  refreshTokenSeconds: 2592000,
  cookieSecure: true,
};
function setup(origin: string) {
  const auth = {
    login: vi.fn().mockResolvedValue(issued),
    register: vi.fn().mockResolvedValue(issued),
  } as unknown as AuthService;
  const limits = { check: vi.fn(), clear: vi.fn() } as unknown as RateLimitService;
  const controller = new AuthController(auth, limits, config);
  const req = { header: (name: string) => (name === 'Origin' ? origin : undefined) } as Request;
  const res = { cookie: vi.fn(), clearCookie: vi.fn(), setHeader: vi.fn() } as unknown as Response;
  return { controller, req, res };
}
describe('cookies e bootstrap CSRF', () => {
  it.each([
    ['https://web.example.test', 'lax'],
    ['https://localhost', 'none'],
  ])('aplica política contextual para %s', async (origin, sameSite) => {
    const { controller, req, res } = setup(origin);
    await controller.login(
      { email: 'pessoa@example.test', password: 'senha123456' },
      '127.0.0.1',
      req,
      res,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'planner_fin_refresh',
      issued.refreshToken,
      expect.objectContaining({ httpOnly: true, sameSite, secure: true, path: '/api/auth' }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'planner_fin_csrf',
      issued.csrfToken,
      expect.objectContaining({ httpOnly: false, sameSite, path: '/' }),
    );
  });
  it('bootstrap é no-store e não cria sessão', () => {
    const { controller, req, res } = setup('https://localhost');
    const result = controller.csrf('127.0.0.1', req, res);
    expect(result.csrfToken).toBeTruthy();
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.cookie).toHaveBeenCalledWith(
      'planner_fin_csrf',
      result.csrfToken,
      expect.objectContaining({ sameSite: 'none', secure: true, httpOnly: false, path: '/' }),
    );
  });
  it('bootstrap rejeita origem desconhecida', () => {
    const { controller, req, res } = setup('https://unknown.example.test');
    expect(() => controller.csrf('127.0.0.1', req, res)).toThrow('Origem não permitida');
  });
});
