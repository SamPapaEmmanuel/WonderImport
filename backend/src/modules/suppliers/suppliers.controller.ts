import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import type { AuthedRequest, AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MasterListQuery, SupplierDto, UpdateSupplierDto } from './supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  async list(@Query() q: MasterListQuery) {
    return { data: await this.suppliers.list(q.archived) };
  }

  @Roles(Role.ADMIN)
  @Post()
  async create(@Body() dto: SupplierDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.suppliers.create(dto, user, req.id) };
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSupplierDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.suppliers.update(id, dto, user, req.id) };
  }

  @Roles(Role.ADMIN)
  @Post(':id/archive')
  async archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.suppliers.setArchived(id, true, user, req.id) };
  }

  @Roles(Role.ADMIN)
  @Post(':id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.suppliers.setArchived(id, false, user, req.id) };
  }
}
