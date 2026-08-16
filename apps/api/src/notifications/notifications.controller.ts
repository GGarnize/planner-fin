import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RateLimitService } from '../auth/rate-limit.service';
import type { AuthenticatedContext } from '../auth/auth.types';
import type { CapturedNotificationListQuery } from '@planner-fin/shared';
import {
  BindNotificationDeviceDto,
  ConfirmCapturedNotificationDto,
  IngestCapturedNotificationsDto,
  UpdateNotificationDevicePreferencesDto,
} from './dto';
import { NotificationsService } from './notifications.service';

@Controller()
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(RateLimitService) private readonly rate: RateLimitService,
  ) {}

  @Post('notification-devices/bind')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  bind(
    @CurrentAuth() auth: AuthenticatedContext,
    @Body() dto: BindNotificationDeviceDto,
    @Req() req: Request,
  ) {
    this.rate.check(`notification-device-bind:${auth.userId}:${req.ip}`, 20, 60_000);
    return this.notifications.bind(auth.userId, dto);
  }

  @Get('notification-devices')
  @Header('Cache-Control', 'no-store')
  list(@CurrentAuth() auth: AuthenticatedContext) {
    return this.notifications.list(auth.userId);
  }

  @Patch('notification-devices/:id')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  updatePreferences(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationDevicePreferencesDto,
  ) {
    return this.notifications.updatePreferences(auth.userId, id, dto);
  }

  @Delete('notification-devices/:id')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard)
  async revoke(@CurrentAuth() auth: AuthenticatedContext, @Param('id') id: string) {
    await this.notifications.revoke(auth.userId, id);
  }

  @Post('notifications/ingest')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  ingest(
    @CurrentAuth() auth: AuthenticatedContext,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @Body() dto: IngestCapturedNotificationsDto,
    @Req() req: Request,
  ) {
    this.rate.check(`notification-ingest:${auth.userId}:${req.ip}`, 30, 60_000);
    return this.notifications.ingest(auth.userId, idempotencyKey ?? '', dto);
  }

  @Post('notifications/purge-expired')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  purgeExpired(@CurrentAuth() auth: AuthenticatedContext) {
    return this.notifications.purgeExpired(auth.userId);
  }

  @Delete('notifications')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  deleteAllHistory(@CurrentAuth() auth: AuthenticatedContext) {
    return this.notifications.purgeAllHistory(auth.userId);
  }

  @Get('notifications')
  @Header('Cache-Control', 'no-store')
  listCaptured(
    @CurrentAuth() auth: AuthenticatedContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.notifications.listCaptured(auth.userId, query as CapturedNotificationListQuery);
  }

  @Get('notifications/:id')
  @Header('Cache-Control', 'no-store')
  getCaptured(@CurrentAuth() auth: AuthenticatedContext, @Param('id') id: string) {
    return this.notifications.getCaptured(auth.userId, id);
  }

  @Post('notifications/:id/confirm')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  confirm(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: ConfirmCapturedNotificationDto,
  ) {
    return this.notifications.confirm(auth.userId, id, dto);
  }

  @Post('notifications/:id/dismiss')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  dismiss(@CurrentAuth() auth: AuthenticatedContext, @Param('id') id: string) {
    return this.notifications.dismiss(auth.userId, id);
  }

  @Post('notifications/:id/mark-non-financial')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  markNonFinancial(@CurrentAuth() auth: AuthenticatedContext, @Param('id') id: string) {
    return this.notifications.markNonFinancial(auth.userId, id);
  }
}
