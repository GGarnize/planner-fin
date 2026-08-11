import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
@Module({ imports: [AuthModule], controllers: [DebtsController], providers: [DebtsService] })
export class DebtsModule {}
