import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import type { ApiConfig } from '../config/env';
import { CurrentAuth } from './current-auth.decorator';
import { AuthGuard } from './auth.guard';
import { AuthService, type IssuedAuth } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { EmptyDto, LoginDto, RegisterDto } from './dto';
import { RateLimitService } from './rate-limit.service';
import { API_CONFIG, type AuthenticatedContext } from './auth.types';
import { randomToken } from './auth.utils';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly auth: AuthService,
    @Inject(RateLimitService)
    private readonly limits: RateLimitService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  private cookiePolicy(req: Request) {
    const origin = req.header('Origin');
    const crossSite =
      !!origin &&
      this.config.crossSiteOrigins.includes(origin) &&
      this.config.corsOrigins.includes(origin);
    return {
      sameSite: crossSite ? ('none' as const) : ('lax' as const),
      secure: crossSite || this.config.cookieSecure,
    };
  }

  private deliver(req: Request, res: Response, issued: IssuedAuth): void {
    const common = {
      ...this.cookiePolicy(req),
      path: '/api/auth',
      maxAge: this.config.refreshTokenSeconds * 1000,
    };
    res.cookie('planner_fin_refresh', issued.refreshToken, { ...common, httpOnly: true });
    res.cookie('planner_fin_csrf', issued.csrfToken, { ...common, path: '/', httpOnly: false });
  }

  private clear(req: Request, res: Response): void {
    const options = { ...this.cookiePolicy(req), path: '/api/auth' };
    res.clearCookie('planner_fin_refresh', options);
    res.clearCookie('planner_fin_csrf', { ...options, path: '/' });
  }

  @Get('csrf')
  csrf(@Ip() ip: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.limits.check(`csrf:${ip}`, 60, 900000);
    const origin = req.header('Origin');
    if (origin && !this.config.corsOrigins.includes(origin))
      throw new ForbiddenException({
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'Origem não permitida.',
      });
    const csrfToken = randomToken();
    res.setHeader('Cache-Control', 'no-store');
    res.cookie('planner_fin_csrf', csrfToken, {
      ...this.cookiePolicy(req),
      path: '/',
      httpOnly: false,
    });
    return { csrfToken };
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.limits.check(`register:${ip}`, 10, 3600000);
    const issued = await this.auth.register(dto);
    this.deliver(req, res, issued);
    return issued.response;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const emailDigest = createHash('sha256').update(dto.email).digest('hex');
    const key = `login:${ip}:${emailDigest}`;
    this.limits.check(key, 5, 900000);
    this.limits.check(`login-ip:${ip}`, 30, 900000);
    const issued = await this.auth.login(dto);
    this.limits.clear(key);
    this.deliver(req, res, issued);
    return issued.response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  async refresh(
    @Body() _dto: EmptyDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = String(req.cookies?.planner_fin_refresh ?? '').split('.')[0];
    this.limits.check(`refresh:${ip}:${sessionId || 'unknown'}`, 30, 900000);
    try {
      const issued = await this.auth.refresh(req.cookies?.planner_fin_refresh ?? '');
      this.deliver(req, res, issued);
      return issued.response;
    } catch (error) {
      this.clear(req, res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, CsrfGuard)
  async logout(
    @Body() _dto: EmptyDto,
    @CurrentAuth() context: AuthenticatedContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(context.sessionId);
    this.clear(req, res);
  }
}
