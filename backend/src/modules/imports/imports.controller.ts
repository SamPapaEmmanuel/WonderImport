import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Role } from '../../generated/prisma/enums';
import { PaginationQuery } from '../../common/pagination/pagination';
import type { AuthedRequest, AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CommitImportDto, RollbackImportDto, TemplateQuery, UploadImportDto } from './dto';
import { MAX_FILE_BYTES } from './import-file';
import { ImportsService } from './imports.service';

export function sendFile(res: Response, file: { buffer: Buffer; fileName: string; type?: string }) {
  res.set({
    'Content-Type': file.type ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${file.fileName.replace(/["\\\r\n]/g, '')}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    'Cache-Control': 'no-store',
  });
  return new StreamableFile(file.buffer);
}

@Roles(Role.ADMIN, Role.STAFF)
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  /** The spreadsheet template (xlsx with dropdowns and a field guide, or a CSV header row). */
  @Get('template')
  async template(@Query() q: TemplateQuery, @Res({ passthrough: true }) res: Response) {
    return sendFile(res, await this.imports.template(q.format));
  }

  @Get()
  list(@Query() q: PaginationQuery) {
    return this.imports.list(q);
  }

  /** Reads and validates a file; returns every row with its messages. Nothing is created until commit. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
  async upload(@UploadedFile() file: Express.Multer.File | undefined, @Body() dto: UploadImportDto, @CurrentUser() user: AuthUser) {
    return { data: await this.imports.upload(file, dto, user) };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.imports.get(id) };
  }

  /** Creates goods for the selected rows. Returns the batch and any rows that stopped being valid since upload. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/commit')
  commit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CommitImportDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return this.imports.commit(id, dto, user, req.id);
  }

  /** Administrators only: archive every good this import created (the undo for a mistaken import). */
  @Roles(Role.ADMIN)
  @Post(':id/archive-goods')
  async archiveGoods(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RollbackImportDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.imports.archiveImportedGoods(id, dto.reason.trim(), user, req.id) };
  }

  @Post(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.imports.cancel(id) };
  }

  /** The rows that need fixing, in template layout with a "What to fix" column, ready to correct and upload again. */
  @Get(':id/errors')
  async errors(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    return sendFile(res, await this.imports.errorReport(id));
  }
}
