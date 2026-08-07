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
import type { FinancialCategoryType } from '@planner-fin/shared';
import type { AuthenticatedContext } from '../auth/auth.types';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { CategoriesService } from './categories.service';
import { CATEGORY_TYPES, CreateCategoryDto, UpdateCategoryDto } from './dto';
@Controller('categories')
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}
  @Post() create(@CurrentAuth() auth: AuthenticatedContext, @Body() dto: CreateCategoryDto) {
    return this.categories.create(auth.userId, dto);
  }
  @Get() list(@CurrentAuth() auth: AuthenticatedContext, @Query() query: Record<string, unknown>) {
    const keys = Object.keys(query);
    if (
      keys.some((key) => !['includeArchived', 'type'].includes(key)) ||
      Array.isArray(query.includeArchived) ||
      Array.isArray(query.type) ||
      (query.includeArchived !== undefined && query.includeArchived !== 'true') ||
      (query.type !== undefined && !CATEGORY_TYPES.includes(query.type as never))
    )
      throw this.invalid();
    return this.categories.list(
      auth.userId,
      query.includeArchived === 'true',
      query.type as FinancialCategoryType | undefined,
    );
  }
  @Get(':id') get(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.noInput(req);
    return this.categories.get(auth.userId, id);
  }
  @Patch(':id') update(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length) throw this.invalid();
    return this.categories.update(auth.userId, id, dto);
  }
  @Post(':id/archive') archive(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.noInput(req);
    return this.categories.archive(auth.userId, id);
  }
  @Post(':id/restore') restore(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.noInput(req);
    return this.categories.restore(auth.userId, id);
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
