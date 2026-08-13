import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Patch, Post, Put, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthenticatedContext } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { UpdateUserPreferencesDto } from './preferences.dto';
import { UserPreferencesService } from './preferences.service';
import { InitialSetupPreviewDto, SaveInitialSetupDraftDto } from './setup.dto';
import { InitialSetupService } from './setup.service';
import { UsersService } from './users.service';
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly preferences: UserPreferencesService,
    private readonly setup: InitialSetupService,
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

  @Get('me/setup')
  @UseGuards(AuthGuard)
  setupMe(
    @CurrentAuth() context: AuthenticatedContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.setup.get(context.userId);
  }

  @Put('me/setup/draft')
  @UseGuards(AuthGuard, CsrfGuard)
  saveSetupDraft(
    @CurrentAuth() context: AuthenticatedContext,
    @Body() dto: SaveInitialSetupDraftDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.setup.saveDraft(context.userId, dto.expectedDraftVersion, dto.draft);
  }

  @Post('me/setup/skip')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, CsrfGuard)
  skipSetup(
    @CurrentAuth() context: AuthenticatedContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.setup.skip(context.userId);
  }

  @Post('me/setup/preview')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, CsrfGuard)
  previewSetup(
    @CurrentAuth() context: AuthenticatedContext,
    @Body() dto: InitialSetupPreviewDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.setup.preview(context.userId, dto.draftVersion);
  }

  @Post('me/setup/confirm')
  @UseGuards(AuthGuard, CsrfGuard)
  async confirmSetup(
    @CurrentAuth() context: AuthenticatedContext,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @Body() body: { previewToken?: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const result = await this.setup.confirm(
      context.userId,
      body.previewToken ?? '',
      idempotencyKey ?? '',
    );
    response.status(result.statusCode);
    return result.body;
  }
}
