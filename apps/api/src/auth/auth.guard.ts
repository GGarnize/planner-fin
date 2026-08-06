import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from './token.service';

export interface AuthRequest extends Request {
  auth: { userId: string; sessionId: string };
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      await this.tokens.verify('');
      return false;
    }
    request.auth = await this.tokens.verify(token);
    return true;
  }
}
