import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CardPurchasesModule } from '../card-purchases/card-purchases.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule, PrismaModule, CardPurchasesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
