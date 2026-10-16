import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import type { AuthedRequest, AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AllocateGoodDto, ArchiveGoodDto, ChangeStatusDto, ChinaCheckInDto, CreateGoodDto, UpdateGoodDto } from './dto/good.dto';
import { GoodsFilterQuery } from './dto/list-goods.query';
import { GoodsService } from './goods.service';

const WRITERS = [Role.ADMIN, Role.STAFF];

@Controller('goods')
export class GoodsController {
  constructor(private readonly goods: GoodsService) {}

  /** Paginated, filtered, sorted list. See GoodsFilterQuery for the filter contract. */
  @Get()
  list(@Query() q: GoodsFilterQuery) {
    return this.goods.list(q);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.goods.get(id) };
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Get(':id/history')
  async history(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.goods.history(id) };
  }

  @Roles(...WRITERS)
  @Post()
  async create(@Body() dto: CreateGoodDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.goods.create(dto, user, req.id) };
  }

  @Roles(...WRITERS)
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGoodDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.goods.update(id, dto, user, req.id) };
  }

  /** Returns { data, warnings } — e.g. CHINA_CHECK_IN_PENDING when leaving the warehouse without a check-in. */
  @Roles(...WRITERS)
  @Patch(':id/status')
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeStatusDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return this.goods.changeStatus(id, dto, user, req.id);
  }

  @Roles(...WRITERS)
  @Patch(':id/china-check-in')
  checkIn(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChinaCheckInDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return this.goods.setChinaCheckIn(id, dto, user, req.id);
  }

  @Roles(...WRITERS)
  @Post(':id/duplicate')
  async duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.goods.duplicate(id, user, req.id) };
  }

  /**
   * Sells units of one stock lot to a client. Repeat for each buyer — two or
   * more clients can purchase the same good at the same time until itemsLeft
   * hits zero. Oversell attempts get 409 CONFLICT with the fresh itemsLeft.
   */
  @Roles(...WRITERS)
  @Post(':id/allocations')
  async allocate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AllocateGoodDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return this.goods.allocate(id, dto, user, req.id);
  }

  /** Every buyer holding units of this good, plus the remaining count. */
  @Get(':id/allocations')
  async allocations(@Param('id', ParseUUIDPipe) id: string) {
    return this.goods.allocations(id);
  }

  @Roles(...WRITERS)
  @Post(':id/archive')
  async archive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ArchiveGoodDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.goods.setArchived(id, true, dto, user, req.id) };
  }

  @Roles(...WRITERS)
  @Post(':id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.goods.setArchived(id, false, {}, user, req.id) };
  }
}
