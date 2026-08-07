import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CardPurchasesController } from './card-purchases.controller';
import { CardPurchasesService } from './card-purchases.service';
@Module({
  imports: [AuthModule],
  controllers: [CardPurchasesController],
  providers: [CardPurchasesService],
})
export class CardPurchasesModule {}
