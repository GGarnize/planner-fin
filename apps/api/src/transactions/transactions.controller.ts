import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { TransactionListQuery } from '@planner-fin/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthenticatedContext } from '../auth/auth.types';
import {
  CreateTransactionDto,
  PayTransactionDto,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  UpdateTransactionDto,
} from './dto';
import { TransactionsService } from './transactions.service';
@Controller('transactions')
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}
  @Post() create(
    @CurrentAuth() auth: AuthenticatedContext,
    @Body() dto: CreateTransactionDto,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length) throw this.invalid();
    return this.transactions.create(auth.userId, dto);
  }
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
      throw this.invalid();
    return this.transactions.list(auth.userId, query as TransactionListQuery);
  }
  @Get(':id') get(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.noInput(req);
    return this.transactions.get(auth.userId, id);
  }
  @Patch(':id') update(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length) throw this.invalid();
    return this.transactions.update(auth.userId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentAuth() auth: AuthenticatedContext, @Param('id') id: string, @Req() req: Request) {
    this.noInput(req);
    return this.transactions.remove(auth.userId, id);
  }
  @Post(':id/pay') pay(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: PayTransactionDto,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length) throw this.invalid();
    return this.transactions.pay(auth.userId, id, dto);
  }
  @Post(':id/reopen') reopen(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.noInput(req);
    return this.transactions.reopen(auth.userId, id);
  }
  private noInput(req: Request) {
    if (Object.keys(req.query).length || (req.body && Object.keys(req.body as object).length))
      throw this.invalid();
  }
  private invalid() {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Revise os dados informados.',
    });
  }
}
