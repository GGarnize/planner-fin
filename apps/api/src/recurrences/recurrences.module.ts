import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RecurrencesController } from './recurrences.controller';
import { RecurrencesService } from './recurrences.service';
@Module({
  imports: [AuthModule],
  controllers: [RecurrencesController],
  providers: [RecurrencesService],
  exports: [RecurrencesService],
})
export class RecurrencesModule {}
