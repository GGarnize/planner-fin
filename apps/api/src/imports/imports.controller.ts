import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RateLimitService } from '../auth/rate-limit.service';
import type { AuthenticatedContext } from '../auth/auth.types';
import {
  ConfirmImportDto,
  CreateImportDto,
  ImportListQueryDto,
  MappingDto,
  PatchImportRowDto,
  VersionDto,
} from './dto';
import { type ImportUploadFile, IMPORT_MAX_BYTES } from './imports.helpers';
import { ImportsService } from './imports.service';

@Controller('imports')
@UseGuards(AuthGuard)
export class ImportsController {
  constructor(
    @Inject(ImportsService)
    private readonly imports: ImportsService,
    @Inject(RateLimitService)
    private readonly rate: RateLimitService,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: IMPORT_MAX_BYTES } }))
  create(
    @CurrentAuth() auth: AuthenticatedContext,
    @Body() dto: CreateImportDto,
    @UploadedFile() file: ImportUploadFile | undefined,
    @Req() req: Request,
  ) {
    this.rate.check(`import-upload:${auth.userId}:${req.ip}`, 5, 15 * 60_000);
    return this.imports.create(auth.userId, dto, file);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Query() query: ImportListQueryDto,
  ) {
    return this.imports.get(auth.userId, id, query.limit, query.offset, query.filter);
  }

  @Put(':id/mapping')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  mapping(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: MappingDto,
  ) {
    return this.imports.mapping(auth.userId, id, dto.draftVersion, dto.mapping);
  }

  @Patch(':id/rows/:rowId')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  patch(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @Body() dto: PatchImportRowDto,
  ) {
    return this.imports.patchRow(auth.userId, id, rowId, dto);
  }

  @Post(':id/preview')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  preview(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: VersionDto,
  ) {
    this.rate.check(`import-preview:${auth.userId}`, 20, 60_000);
    return this.imports.preview(auth.userId, id, dto.draftVersion);
  }

  @Post(':id/confirm')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  confirm(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: ConfirmImportDto,
  ) {
    this.rate.check(`import-confirm:${auth.userId}`, 5, 60_000);
    return this.imports.confirm(auth.userId, id, key ?? '', dto);
  }

  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  @UseGuards(CsrfGuard)
  @HttpCode(204)
  async cancel(
    @CurrentAuth() auth: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: VersionDto,
  ) {
    await this.imports.cancel(auth.userId, id, dto.draftVersion);
  }
}
