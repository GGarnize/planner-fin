import { Module } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrap } from './main';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';

@Module({ imports: [ConfigModule, PrismaModule] })
class ShutdownTestModule {}

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('bootstrap', () => {
  it('inicia na porta/host configurados e encerra graciosamente (Prisma desconectado)', async () => {
    delete process.env.NODE_ENV;
    process.env.API_PORT = '34567';
    process.env.API_HOST = '127.0.0.1';
    process.env.DATABASE_URL = 'postgresql://local:local@localhost:5432/local';
    process.env.API_CORS_ORIGINS = 'http://localhost:9000';
    process.env.JWT_SECRET = 'jwt-local-sintetico-ABCDEF-1234567890-xyz';
    process.env.REFRESH_HMAC_SECRET = 'hmac-local-sintetico-9876543210-ZYX-fed';

    const app = await bootstrap(ShutdownTestModule);
    try {
      const prisma = app.get(PrismaService);
      const disconnectSpy = vi.spyOn(prisma, '$disconnect').mockResolvedValue(undefined);

      const address = app.getHttpServer().address();
      expect(address).toMatchObject({ address: '127.0.0.1', port: 34567 });

      await app.close();
      expect(disconnectSpy).toHaveBeenCalled();
    } finally {
      await app.close().catch(() => undefined);
    }
  }, 15000);
});
