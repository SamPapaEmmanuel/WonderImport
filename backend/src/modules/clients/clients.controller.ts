import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import type { AuthedRequest, AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClientsService } from './clients.service';
import { ArchiveDto, CreateClientDto, ListClientsQuery, UpdateClientDto } from './dto/client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@Query() q: ListClientsQuery) {
    return this.clients.list(q);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.clients.get(id) };
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Post()
  async create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.clients.create(dto, user, req.id) };
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.clients.update(id, dto, user, req.id) };
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Post(':id/archive')
  async archive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ArchiveDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.clients.setArchived(id, true, user, dto.reason, req.id) };
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Post(':id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.clients.setArchived(id, false, user, undefined, req.id) };
  }
}
