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
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthenticatedContext } from '../auth/auth.types';
import { CardsService } from './cards.service';
import { CreateCardDto, UpdateCardDto } from './dto';
@Controller('cards')
@UseGuards(AuthGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}
  @Post() create(@CurrentAuth() a: AuthenticatedContext, @Body() d: CreateCardDto) {
    return this.cards.create(a.userId, d);
  }
  @Get() list(@CurrentAuth() a: AuthenticatedContext, @Query() q: Record<string, string>) {
    if (Object.keys(q).some((k) => k !== 'archived') || (q.archived && q.archived !== 'true'))
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Filtro inválido.' });
    return this.cards.list(a.userId, q.archived === 'true');
  }
  @Get(':id') get(@CurrentAuth() a: AuthenticatedContext, @Param('id') id: string) {
    return this.cards.get(a.userId, id);
  }
  @Patch(':id') update(
    @CurrentAuth() a: AuthenticatedContext,
    @Param('id') id: string,
    @Body() d: UpdateCardDto,
  ) {
    return this.cards.update(a.userId, id, d);
  }
  @Post(':id/archive') archive(@CurrentAuth() a: AuthenticatedContext, @Param('id') id: string) {
    return this.cards.archive(a.userId, id);
  }
  @Post(':id/restore') restore(@CurrentAuth() a: AuthenticatedContext, @Param('id') id: string) {
    return this.cards.restore(a.userId, id);
  }
}
