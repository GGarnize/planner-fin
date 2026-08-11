import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { TokenService } from './token.service';
const config = {
  port: 3000,
  databaseUrl: 'postgresql://x',
  corsOrigins: ['http://localhost:9000'],
  jwtSecret: 'a'.repeat(32),
  refreshHmacSecret: 'b'.repeat(32),
  jwtIssuer: 'planner-fin-api',
  jwtAudience: 'planner-fin-web',
  accessTokenSeconds: 900 as const,
  refreshTokenSeconds: 2592000 as const,
  cookieSecure: false,
};
describe('TokenService', () => {
  it('emite e valida claims mínimas HS256', async () => {
    const service = new TokenService(new JwtService(), config);
    const token = await service.issue({ userId: 'u', sessionId: 's' });
    await expect(service.verify(token)).resolves.toEqual({ userId: 'u', sessionId: 's' });
    const decoded = new JwtService().decode(token) as Record<string, unknown>;
    expect(Object.keys(decoded).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sid', 'sub']);
  });
});
