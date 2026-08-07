import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { CardInvoiceListQuery } from '@planner-fin/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthenticatedContext } from '../auth/auth.types';
import { CardInvoicesService } from './card-invoices.service';
import { PayCardInvoiceDto } from './dto';
@Controller('card-invoices')
@UseGuards(AuthGuard)
export class CardInvoicesController {
  constructor(private readonly invoices: CardInvoicesService) {}
  @Get() list(@CurrentAuth() a: AuthenticatedContext, @Query() q: CardInvoiceListQuery) {
    return this.invoices.list(a.userId, q);
  }
  @Get(':id') get(@CurrentAuth() a: AuthenticatedContext, @Param('id') id: string) {
    return this.invoices.get(a.userId, id);
  }
  @Post(':id/close') close(@CurrentAuth() a: AuthenticatedContext, @Param('id') id: string) {
    return this.invoices.close(a.userId, id);
  }
  @Post(':id/pay') pay(
    @CurrentAuth() a: AuthenticatedContext,
    @Param('id') id: string,
    @Body() d: PayCardInvoiceDto,
  ) {
    return this.invoices.pay(a.userId, id, d);
  }
}
