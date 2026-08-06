import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthRequest } from './auth.guard';
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthRequest>().auth,
);
