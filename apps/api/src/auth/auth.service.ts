import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthResponse } from '@planner-fin/shared';
import type { ApiConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicUser } from '../users/users.service';
import { API_CONFIG } from './auth.types';
import {
  digestToken,
  hashPassword,
  normalizeEmail,
  randomToken,
  verifyPassword,
} from './auth.utils';
import type { LoginDto, RegisterDto } from './dto';
import { TokenService } from './token.service';

export interface IssuedAuth {
  response: AuthResponse;
  refreshToken: string;
  csrfToken: string;
}
const INVALID = { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' };

@Injectable()
export class AuthService {
  private sentinelHash?: Promise<string>;
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(TokenService)
    private readonly tokens: TokenService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}
  private async response(
    user: { id: string; name: string; email: string; createdAt: Date },
    sessionId: string,
    refreshToken: string,
  ): Promise<IssuedAuth> {
    const csrfToken = randomToken();
    return {
      response: {
        accessToken: await this.tokens.issue({ userId: user.id, sessionId }),
        csrfToken,
        expiresIn: 900,
        user: toPublicUser(user),
      },
      refreshToken,
      csrfToken,
    };
  }
  async register(dto: RegisterDto): Promise<IssuedAuth> {
    const email = normalizeEmail(dto.email);
    const passwordHash = await hashPassword(dto.password);
    const sessionId = crypto.randomUUID();
    const refreshToken = `${sessionId}.${randomToken()}`;
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { name: dto.name.trim(), email, normalizedEmail: email, passwordHash },
        });
        await tx.session.create({
          data: {
            id: sessionId,
            userId: created.id,
            refreshTokenDigest: digestToken(refreshToken, this.config.refreshHmacSecret),
            expiresAt: new Date(Date.now() + this.config.refreshTokenSeconds * 1000),
          },
        });
        await tx.userInitialSetup.create({ data: { userId: created.id } });
        return created;
      });
      return this.response(user, sessionId, refreshToken);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException({
          code: 'EMAIL_ALREADY_IN_USE',
          message: 'Este e-mail já está em uso.',
        });
      throw error;
    }
  }
  async login(dto: LoginDto): Promise<IssuedAuth> {
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail: normalizeEmail(dto.email) },
    });
    this.sentinelHash ??= hashPassword('Sentinela123456789');
    const valid = await verifyPassword(
      user?.passwordHash ?? (await this.sentinelHash),
      dto.password,
    );
    if (!user || !valid) throw new UnauthorizedException(INVALID);
    const sessionId = crypto.randomUUID();
    const refreshToken = `${sessionId}.${randomToken()}`;
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenDigest: digestToken(refreshToken, this.config.refreshHmacSecret),
        expiresAt: new Date(Date.now() + this.config.refreshTokenSeconds * 1000),
      },
    });
    return this.response(user, sessionId, refreshToken);
  }
  async refresh(refreshToken: string): Promise<IssuedAuth> {
    const [sessionId, secret, extra] = refreshToken.split('.');
    if (!sessionId || !secret || extra)
      throw new UnauthorizedException({ code: 'INVALID_SESSION', message: 'Sessão inválida.' });
    const oldDigest = digestToken(refreshToken, this.config.refreshHmacSecret);
    const nextToken = `${sessionId}.${randomToken()}`;
    const nextDigest = digestToken(nextToken, this.config.refreshHmacSecret);
    const session = await this.prisma.$transaction(async (tx) => {
      const current = await tx.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
      });
      if (!current || current.revokedAt || current.expiresAt <= new Date()) return null;
      const changed = await tx.session.updateMany({
        where: {
          id: sessionId,
          refreshTokenDigest: oldDigest,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          refreshTokenDigest: nextDigest,
          expiresAt: new Date(Date.now() + this.config.refreshTokenSeconds * 1000),
        },
      });
      if (changed.count !== 1) {
        await tx.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
        return null;
      }
      return current;
    });
    if (!session)
      throw new UnauthorizedException({ code: 'INVALID_SESSION', message: 'Sessão inválida.' });
    return this.response(session.user, session.id, nextToken);
  }
  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
