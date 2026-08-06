import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { PublicUser } from '@planner-fin/shared';
import { PrismaService } from '../prisma/prisma.service';

export const toPublicUser = (
  user: Pick<User, 'id' | 'name' | 'email' | 'createdAt'>,
): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt.toISOString(),
});

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  async getPublic(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' });
    return toPublicUser(user);
  }
}
