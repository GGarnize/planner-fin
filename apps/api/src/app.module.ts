import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { TransfersModule } from './transfers/transfers.module';
import { RecurrencesModule } from './recurrences/recurrences.module';
import { CardsModule } from './cards/cards.module';
import { CardPurchasesModule } from './card-purchases/card-purchases.module';
import { CardInvoicesModule } from './card-invoices/card-invoices.module';
import { DebtsModule } from './debts/debts.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    TransfersModule,
    RecurrencesModule,
    CardsModule,
    CardPurchasesModule,
    CardInvoicesModule,
    DebtsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
