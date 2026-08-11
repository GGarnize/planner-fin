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
import type { TransactionTemplateType } from '@planner-fin/shared';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { TRANSACTION_TYPES } from '../transactions/dto';
import { CreateTransactionTemplateDto, UpdateTransactionTemplateDto } from './dto';
import { TransactionTemplatesService } from './transaction-templates.service';
@Controller('transaction-templates')
@UseGuards(AuthGuard)
export class TransactionTemplatesController {
  constructor(private readonly templates: TransactionTemplatesService) {}
  @Post() create(
    @CurrentAuth() auth: AuthenticatedContext,
    @Body() dto: CreateTransactionTemplateDto,
  ) {
    return this.templates.create(auth.userId, dto);
  }
  @Get() list(@CurrentAuth() auth: AuthenticatedContext, @Query() query: Record<string, unknown>) {
    if (
      Object.keys(query).some((k) => !['includeArchived', 'type', 'q'].includes(k)) ||
      Object.values(query).some(Array.isArray) ||
      (query.includeArchived !== undefined &&
        !['true', 'false'].includes(query.includeArchived as string)) ||
      (query.type !== undefined && !TRANSACTION_TYPES.includes(query.type as never)) ||
      (query.q !== undefined &&
        (typeof query.q !== 'string' ||
          query.q.trim().length < 1 ||
          Array.from(query.q.trim()).length > 80))
    )
      throw this.invalid();
    return this.templates.list(
      auth.userId,
      query.includeArchived === 'true',
      query.type as TransactionTemplateType | undefined,
      typeof query.q === 'string' ? query.q.trim() : undefined,
    );
  }
  @Get(':id') get(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.noInput(req);
    return this.templates.get(auth.userId, id);
  }
  @Patch(':id') update(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionTemplateDto,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length) throw this.invalid();
    return this.templates.update(auth.userId, id, dto);
  }
  @Post(':id/archive') archive(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.noInput(req);
    return this.templates.archive(auth.userId, id);
  }
  @Post(':id/restore') restore(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.noInput(req);
    return this.templates.restore(auth.userId, id);
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
