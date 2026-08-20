import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinancialEntriesController } from './financial-entries.controller';
import { FinancialEntriesService } from './financial-entries.service';
@Module({
  imports: [AuthModule],
  controllers: [FinancialEntriesController],
  providers: [FinancialEntriesService],
})
export class FinancialEntriesModule {}
