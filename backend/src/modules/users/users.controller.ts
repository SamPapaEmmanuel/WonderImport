import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import type { AuthedRequest, AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

/** People who can use WonderImport. Administrators only. */
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list() {
    return { data: await this.users.list() };
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.users.create(dto, actor, req.id) };
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.users.update(id, dto, actor, req.id) };
  }

  @Post(':id/invite')
  async invite(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.users.resendInvite(id) };
  }
}
