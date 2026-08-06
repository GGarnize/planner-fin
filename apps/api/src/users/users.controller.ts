import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthenticatedContext } from '../auth/auth.types';
import { UsersService } from './users.service';
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentAuth() context: AuthenticatedContext) {
    return this.users.getPublic(context.userId);
  }
}
