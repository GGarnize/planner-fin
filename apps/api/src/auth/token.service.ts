import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ApiConfig } from '../config/env';
import { API_CONFIG, type AuthenticatedContext } from './auth.types';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}
  issue(context: AuthenticatedContext): Promise<string> {
    return this.jwt.signAsync(
      { sid: context.sessionId },
      {
        algorithm: 'HS256',
        secret: this.config.jwtSecret,
        subject: context.userId,
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience,
        expiresIn: this.config.accessTokenSeconds,
      },
    );
  }
  async verify(token: string): Promise<AuthenticatedContext> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(token, {
        algorithms: ['HS256'],
        secret: this.config.jwtSecret,
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience,
      });
      if (!payload.sub || !payload.sid) throw new Error('claims');
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Autenticação necessária.',
      });
    }
  }
}
