import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthenticatedContext } from '../auth/auth.types';
import { CreateDebtDto, PayDebtInstallmentDto, UpdateDebtDto } from './dto';
import { DebtsService } from './debts.service';
@Controller()
@UseGuards(AuthGuard)
export class DebtsController {
  constructor(private readonly debts: DebtsService) {}
  @Post('debts') create(@CurrentAuth() a: AuthenticatedContext, @Body() d: CreateDebtDto) {
    return this.debts.create(a.userId, d);
  }
  @Get('debts') list(@CurrentAuth() a: AuthenticatedContext, @Query() q: Record<string, string>) {
    const allowed = ['status', 'type', 'archived', 'due', 'limit', 'cursor'];
    if (
      Object.keys(q).some((k) => !allowed.includes(k)) ||
      (q.status && !['ACTIVE', 'PAID_OFF'].includes(q.status)) ||
      (q.type && !['LOAN', 'FINANCING', 'NEGOTIATED_DEBT', 'OTHER'].includes(q.type)) ||
      (q.archived && !['false', 'true', 'all'].includes(q.archived)) ||
      (q.due && !['overdue', 'upcoming', 'all'].includes(q.due))
    )
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Filtro inválido.' });
    return this.debts.list(a.userId, q);
  }
  @Get('debts/:id') get(@CurrentAuth() a: AuthenticatedContext, @Param('id') id: string) {
    return this.debts.get(a.userId, id);
  }
  @Patch('debts/:id') update(
    @CurrentAuth() a: AuthenticatedContext,
    @Param('id') id: string,
    @Body() d: UpdateDebtDto,
  ) {
    return this.debts.update(a.userId, id, d);
  }
  @Post('debts/:id/archive') archive(
    @CurrentAuth() a: AuthenticatedContext,
    @Param('id') id: string,
  ) {
    return this.debts.archive(a.userId, id);
  }
  @Post('debts/:id/restore') restore(
    @CurrentAuth() a: AuthenticatedContext,
    @Param('id') id: string,
  ) {
    return this.debts.restore(a.userId, id);
  }
  @Post('debt-installments/:id/pay') async pay(
    @CurrentAuth() a: AuthenticatedContext,
    @Param('id') id: string,
    @Body() d: PayDebtInstallmentDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.debts.pay(a.userId, id, d);
    res.status(result.created ? 201 : 200);
    return result;
  }
}
