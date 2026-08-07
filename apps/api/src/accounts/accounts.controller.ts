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
import type { AuthenticatedContext } from '../auth/auth.types';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto';

@Controller('accounts')
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}
  @Post() create(@CurrentAuth() auth: AuthenticatedContext, @Body() dto: CreateAccountDto) {
    return this.accounts.create(auth.userId, dto);
  }
  @Get() list(@CurrentAuth() auth: AuthenticatedContext, @Query() query: Record<string, string>) {
    const keys = Object.keys(query);
    if (keys.length > 1 || (keys.length === 1 && query.includeArchived !== 'true'))
      throw this.invalid();
    return this.accounts.list(auth.userId, query.includeArchived === 'true');
  }
  @Get(':id') get(@CurrentAuth() auth: AuthenticatedContext, @Param('id') id: string) {
    return this.accounts.get(auth.userId, id);
  }
  @Patch(':id') update(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accounts.update(auth.userId, id, dto);
  }
  @Post(':id/archive') archive(@CurrentAuth() auth: AuthenticatedContext, @Param('id') id: string) {
    return this.accounts.archive(auth.userId, id);
  }
  @Post(':id/restore') restore(@CurrentAuth() auth: AuthenticatedContext, @Param('id') id: string) {
    return this.accounts.restore(auth.userId, id);
  }
  private invalid() {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Revise os dados informados.',
    });
  }
}
