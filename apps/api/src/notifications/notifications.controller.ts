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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RateLimitService } from '../auth/rate-limit.service';
import type { AuthenticatedContext } from '../auth/auth.types';
import {
  BindNotificationDeviceDto,
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
}
