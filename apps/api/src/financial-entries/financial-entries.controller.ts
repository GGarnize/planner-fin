import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { FinancialEntryListQuery } from '@planner-fin/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthenticatedContext } from '../auth/auth.types';
import { TRANSACTION_STATUSES, TRANSACTION_TYPES } from '../transactions/dto';
import { FinancialEntriesService } from './financial-entries.service';

@Controller('financial-entries')
@UseGuards(AuthGuard)
export class FinancialEntriesController {
  constructor(private readonly entries: FinancialEntriesService) {}
  @Get() list(@CurrentAuth() auth: AuthenticatedContext, @Query() query: Record<string, unknown>) {
    const allowed = [
      'accountId',
      'categoryId',
      'type',
      'status',
      'dueDateFrom',
      'dueDateTo',
      'paidAtFrom',
      'paidAtTo',
      'limit',
      'cursor',
    ];
    if (
      Object.keys(query).some((key) => !allowed.includes(key)) ||
      Object.values(query).some((value) => typeof value !== 'string') ||
      (query.type !== undefined && !TRANSACTION_TYPES.includes(query.type as never)) ||
      (query.status !== undefined && !TRANSACTION_STATUSES.includes(query.status as never)) ||
      ['accountId', 'categoryId'].some(
        (key) =>
          query[key] !== undefined &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            query[key] as string,
          ),
      )
    )
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Revise os dados informados.',
      });
    return this.entries.list(auth.userId, query as FinancialEntryListQuery);
  }
}
