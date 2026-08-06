import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { ApiConfig } from '../config/env';
import { API_CONFIG } from './auth.types';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const cookie = request.cookies?.planner_fin_csrf as string | undefined;
    const header = request.header('X-CSRF-Token');
    const origin = request.header('Origin');
    const valid =
      cookie &&
      header &&
      origin === this.config.corsOrigin &&
      cookie.length === header.length &&
      timingSafeEqual(Buffer.from(cookie), Buffer.from(header));
    if (!valid)
      throw new ForbiddenException({
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Validação de segurança falhou.',
      });
    return true;
  }
}
