import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { isCivilMonth } from './budget-finance';
import { BudgetsService } from './budgets.service';
import { CopyBudgetDto, CreateBudgetDto, UpdateBudgetDto } from './dto';

@Controller('budgets')
@UseGuards(AuthGuard)
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}
  private invalid() {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Revise os dados informados.',
    });
  }
  private id(value: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
      throw this.invalid();
  }
  @Post()
  create(@CurrentAuth() auth: AuthenticatedContext, @Body() dto: CreateBudgetDto) {
    return this.budgets.create(auth.userId, dto);
  }
  @Get()
  getMonth(@CurrentAuth() auth: AuthenticatedContext, @Query() query: Record<string, unknown>) {
    if (Object.keys(query).length !== 1 || !isCivilMonth(query.month) || Array.isArray(query.month))
      throw this.invalid();
    return this.budgets.getByMonth(auth.userId, query.month);
  }
  @Get(':id')
  get(@CurrentAuth() auth: AuthenticatedContext, @Param('id') id: string) {
    this.id(id);
    return this.budgets.getById(auth.userId, id);
  }
  @Patch(':id')
  update(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    this.id(id);
    return this.budgets.update(auth.userId, id, dto);
  }
  @Post(':id/copy')
  copy(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: CopyBudgetDto,
  ) {
    this.id(id);
    return this.budgets.copy(auth.userId, id, dto);
  }
}
