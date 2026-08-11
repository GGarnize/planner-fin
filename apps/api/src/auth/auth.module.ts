import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { RateLimitService } from './rate-limit.service';
import { TokenService } from './token.service';
@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, AuthGuard, CsrfGuard, RateLimitService],
  exports: [AuthGuard, TokenService],
})
export class AuthModule {}
