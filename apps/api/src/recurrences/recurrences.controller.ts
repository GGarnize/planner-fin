import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthenticatedContext } from '../auth/auth.types';
import { CreateRecurrenceDto, RecurrenceListDto, UpdateRecurrenceDto } from './dto';
import { RecurrencesService } from './recurrences.service';
@Controller('recurrences')
@UseGuards(AuthGuard)
export class RecurrencesController {
  constructor(private readonly service: RecurrencesService) {}
  @Post() create(@CurrentAuth() a: AuthenticatedContext, @Body() d: CreateRecurrenceDto) {
    return this.service.create(a.userId, d);
  }
  @Get() list(@CurrentAuth() a: AuthenticatedContext, @Query() q: RecurrenceListDto) {
    return this.service.list(a.userId, q);
  }
  @Get(':id') get(@CurrentAuth() a: AuthenticatedContext, @Param('id') id: string) {
    return this.service.get(a.userId, id);
  }
  @Patch(':id') update(
    @CurrentAuth() a: AuthenticatedContext,
    @Param('id') id: string,
    @Body() d: UpdateRecurrenceDto,
  ) {
    return this.service.update(a.userId, id, d);
  }
  @Post(':id/pause') pause(@CurrentAuth() a: AuthenticatedContext, @Param('id') id: string) {
    return this.service.pause(a.userId, id);
  }
  @Post(':id/resume') resume(@CurrentAuth() a: AuthenticatedContext, @Param('id') id: string) {
    return this.service.resume(a.userId, id);
  }
  @Post(':id/archive') archive(@CurrentAuth() a: AuthenticatedContext, @Param('id') id: string) {
    return this.service.archive(a.userId, id);
  }
  @Post(':id/generate') generate(@CurrentAuth() a: AuthenticatedContext, @Param('id') id: string) {
    return this.service.generate(a.userId, id);
  }
}
