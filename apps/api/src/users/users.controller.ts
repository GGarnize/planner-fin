import { Body, Controller, Get, Patch, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthenticatedContext } from '../auth/auth.types';
import { UpdateUserPreferencesDto } from './preferences.dto';
import { UserPreferencesService } from './preferences.service';
import { UsersService } from './users.service';
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly preferences: UserPreferencesService,
  ) {}
  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentAuth() context: AuthenticatedContext) {
    return this.users.getPublic(context.userId);
  }

  @Get('me/preferences')
  @UseGuards(AuthGuard)
  preferencesMe(
    @CurrentAuth() context: AuthenticatedContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.preferences.get(context.userId);
  }

  @Patch('me/preferences')
  @UseGuards(AuthGuard)
  updatePreferences(
    @CurrentAuth() context: AuthenticatedContext,
    @Body() dto: UpdateUserPreferencesDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.preferences.patch(context.userId, dto);
  }
}
