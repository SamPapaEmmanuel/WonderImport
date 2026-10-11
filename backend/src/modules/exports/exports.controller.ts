import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Role } from '../../generated/prisma/enums';
import type { AuthedRequest, AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ListClientsQuery } from '../clients/dto/client.dto';
import { GoodsFilterQuery } from '../goods/dto/list-goods.query';
import { sendFile } from '../imports/imports.controller';
import { ExportsService } from './exports.service';

/** Excel exports. Restricted to staff and administrators; every export is recorded in the audit log. */
@Roles(Role.ADMIN, Role.STAFF)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  /** Accepts exactly the GET /goods filter contract; paging parameters are ignored. */
  @Get('goods')
  async goods(@Query() q: GoodsFilterQuery, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    return sendFile(res, await this.exports.goods(q, user, req.id));
  }

  @Get('clients')
  async clients(@Query() q: ListClientsQuery, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    return sendFile(res, await this.exports.clientsWorkbook(q, user, req.id));
  }
}
