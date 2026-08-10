import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { isCivilMonth } from '../budgets/budget-finance';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentAuth() auth: AuthenticatedContext, @Query() query: Record<string, unknown>) {
    if (Object.keys(query).length !== 1 || !isCivilMonth(query.month) || Array.isArray(query.month))
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Informe exatamente um mês civil válido.',
      });
    return this.dashboard.get(auth.userId, query.month);
  }
}
