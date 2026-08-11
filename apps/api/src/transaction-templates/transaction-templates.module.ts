import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TransactionTemplatesController } from './transaction-templates.controller';
import { TransactionTemplatesService } from './transaction-templates.service';
@Module({
  imports: [AuthModule],
  controllers: [TransactionTemplatesController],
  providers: [TransactionTemplatesService],
})
export class TransactionTemplatesModule {}
