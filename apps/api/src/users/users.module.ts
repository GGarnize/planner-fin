import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UserPreferencesService } from './preferences.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, UserPreferencesService],
})
export class UsersModule {}
