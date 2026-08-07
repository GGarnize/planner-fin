import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { CardPurchaseListQuery } from '@planner-fin/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthenticatedContext } from '../auth/auth.types';
import { CardPurchasesService } from './card-purchases.service';
import { CreateCardPurchaseDto, UpdateCardPurchaseDto } from './dto';
@Controller('card-purchases')
@UseGuards(AuthGuard)
export class CardPurchasesController {
  constructor(private readonly purchases: CardPurchasesService) {}
  @Post() create(@CurrentAuth() a: AuthenticatedContext, @Body() d: CreateCardPurchaseDto) {
    return this.purchases.create(a.userId, d);
  }
  @Get() list(@CurrentAuth() a: AuthenticatedContext, @Query() q: CardPurchaseListQuery) {
    return this.purchases.list(a.userId, q);
  }
  @Get(':id') get(@CurrentAuth() a: AuthenticatedContext, @Param('id') id: string) {
    return this.purchases.get(a.userId, id);
  }
  @Patch(':id') update(
    @CurrentAuth() a: AuthenticatedContext,
    @Param('id') id: string,
    @Body() d: UpdateCardPurchaseDto,
  ) {
    return this.purchases.update(a.userId, id, d);
  }
}
