import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, type UserPreferences } from '@prisma/client';
import type {
  UpdateUserPreferencesRequest,
  UserPreferencesResponse,
} from '@planner-fin/shared';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULTS = { appearance: 'SYSTEM' as const, accent: 'BLUE' as const };

export function toPublicPreferences(
  preferences: Pick<UserPreferences, 'appearance' | 'accent' | 'updatedAt'>,
): UserPreferencesResponse {
  return {
    appearance: preferences.appearance,
    accent: preferences.accent,
    updatedAt: preferences.updatedAt.toISOString(),
  };
}

@Injectable()
export class UserPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<UserPreferencesResponse> {
    return toPublicPreferences(await this.materialize(userId));
  }

  async patch(
    userId: string,
    dto: UpdateUserPreferencesRequest,
  ): Promise<UserPreferencesResponse> {
    const keys = Object.keys(dto);
    if (keys.length === 0)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Dados invalidos.',
        details: [{ field: 'body', message: 'Informe ao menos uma preferencia.' }],
      });

    return toPublicPreferences(
      await this.prisma.$transaction(async (tx) => {
        const current = await this.materialize(userId, tx);
        const data = {
          appearance: dto.appearance ?? current.appearance,
          accent: dto.accent ?? current.accent,
        };
        if (data.appearance === current.appearance && data.accent === current.accent) return current;
        return tx.userPreferences.update({ where: { userId }, data });
      }),
    );
  }

  private async materialize(
    userId: string,
    client: Pick<PrismaService, 'userPreferences'> | Prisma.TransactionClient = this.prisma,
  ): Promise<UserPreferences> {
    const existing = await client.userPreferences.findUnique({ where: { userId } });
    if (existing) return existing;
    try {
      return await client.userPreferences.create({ data: { userId, ...DEFAULTS } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        return client.userPreferences.findUniqueOrThrow({ where: { userId } });
      throw error;
    }
  }
}
