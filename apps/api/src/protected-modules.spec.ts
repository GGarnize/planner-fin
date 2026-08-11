import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthModule } from './auth/auth.module';
import { BudgetsModule } from './budgets/budgets.module';
import { BudgetsService } from './budgets/budgets.service';
import { ConfigModule } from './config/config.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DebtsModule } from './debts/debts.module';
import { DebtsService } from './debts/debts.service';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { TransactionsModule } from './transactions/transactions.module';
import { TransactionsService } from './transactions/transactions.service';
import { TransfersModule } from './transfers/transfers.module';
import { TransfersService } from './transfers/transfers.service';

const originalEnv = { ...process.env };

const prismaStub = {
  $connect: async () => undefined,
  $disconnect: async () => undefined,
};

describe('módulos protegidos', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      API_PORT: '3000',
      DATABASE_URL: 'postgresql://local:local@localhost:5432/local',
      API_CORS_ORIGINS: 'http://localhost:9000,https://localhost',
      JWT_SECRET: 'jwt-local-sintetico-ABCDEF-1234567890-xyz',
      REFRESH_HMAC_SECRET: 'hmac-local-sintetico-9876543210-ZYX-fed',
      JWT_ISSUER: 'planner-fin-api',
      JWT_AUDIENCE: 'planner-fin-web',
      COOKIE_SECURE: 'true',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it.each([
    ['budgets', BudgetsModule, BudgetsService],
    ['debts', DebtsModule, DebtsService],
    ['transactions', TransactionsModule, TransactionsService],
    ['transfers', TransfersModule, TransfersService],
  ])(
    'compila %s com AuthGuard e TokenService resolvidos pelo AuthModule',
    async (_name, module, service) => {
      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule, PrismaModule, AuthModule, module],
      })
        .overrideProvider(PrismaService)
        .useValue(prismaStub)
        .overrideProvider(service)
        .useValue({})
        .compile();

      expect(moduleRef).toBeDefined();
      await moduleRef.close();
    },
  );

  it('compila dashboard com AuthModule e mantém o relógio opcional do DashboardService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule, AuthModule, DashboardModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
