import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CardInvoicesController } from './card-invoices.controller';
import { CardInvoicesService } from './card-invoices.service';
@Module({
  imports: [AuthModule],
  controllers: [CardInvoicesController],
  providers: [CardInvoicesService],
})
export class CardInvoicesModule {}
