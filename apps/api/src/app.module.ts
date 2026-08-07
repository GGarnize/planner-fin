import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, UsersModule, AccountsModule, CategoriesModule],
  controllers: [HealthController],
})
export class AppModule {}
