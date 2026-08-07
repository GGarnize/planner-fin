import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { TransferListQuery } from '@planner-fin/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthenticatedContext } from '../auth/auth.types';
import {
  CreateTransferDto,
  CompleteTransferDto,
  TRANSFER_STATUSES,
  UpdateTransferDto,
} from './dto';
import { TransfersService } from './transfers.service';
@Controller('transfers')
@UseGuards(AuthGuard)
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}
  @Post() create(
    @CurrentAuth() auth: AuthenticatedContext,
    @Body() dto: CreateTransferDto,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length) throw this.invalid();
    return this.transfers.create(auth.userId, dto);
  }
  @Get() list(@CurrentAuth() auth: AuthenticatedContext, @Query() query: Record<string, unknown>) {
    const allowed = [
      'sourceAccountId',
      'destinationAccountId',
      'accountId',
      'status',
      'dueDateFrom',
      'dueDateTo',
      'completedAtFrom',
      'completedAtTo',
      'limit',
      'cursor',
    ];
    if (
      Object.keys(query).some((key) => !allowed.includes(key)) ||
      Object.values(query).some((value) => typeof value !== 'string') ||
      (query.status !== undefined && !TRANSFER_STATUSES.includes(query.status as never)) ||
      ['sourceAccountId', 'destinationAccountId', 'accountId'].some(
        (key) =>
          query[key] !== undefined &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            query[key] as string,
          ),
      )
    )
      throw this.invalid();
    return this.transfers.list(auth.userId, query as TransferListQuery);
  }
  @Get(':id') get(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.noInput(req);
    return this.transfers.get(auth.userId, id);
  }
  @Patch(':id') update(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: UpdateTransferDto,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length) throw this.invalid();
    return this.transfers.update(auth.userId, id, dto);
  }
  @Post(':id/complete') complete(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: CompleteTransferDto,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length) throw this.invalid();
    return this.transfers.complete(auth.userId, id, dto);
  }
  @Post(':id/reopen') reopen(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.noInput(req);
    return this.transfers.reopen(auth.userId, id);
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
