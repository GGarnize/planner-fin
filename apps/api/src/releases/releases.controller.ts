import { Controller, Get, Header, Inject, Param, Redirect, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimitService } from '../auth/rate-limit.service';
import { ReleasesService } from './releases.service';

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;

@Controller('releases/android')
export class ReleasesController {
  constructor(
    @Inject(ReleasesService) private readonly releases: ReleasesService,
    @Inject(RateLimitService) private readonly rate: RateLimitService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list() {
    return this.releases.list();
  }

  @Get('latest')
  @Header('Cache-Control', 'no-store')
  @Redirect()
  async latest(@Req() req: Request) {
    this.rate.check(`releases-android-latest:${req.ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    const { url } = await this.releases.resolveLatestDownload();
    return { url, statusCode: 302 };
  }

  @Get(':version/metadata')
  @Header('Cache-Control', 'no-store')
  metadata(@Param('version') version: string) {
    return this.releases.getMetadata(version);
  }

  @Get(':version')
  @Header('Cache-Control', 'no-store')
  @Redirect()
  async version(@Param('version') version: string, @Req() req: Request) {
    this.rate.check(`releases-android-version:${req.ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    const { url } = await this.releases.resolveVersionDownload(version);
    return { url, statusCode: 302 };
  }
}
