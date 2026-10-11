import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import type { AuthedRequest, AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MasterListQuery } from '../suppliers/supplier.dto';
import { CategoriesService } from './categories.service';
import { CategoryDto, UpdateCategoryDto } from './category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  async list(@Query() q: MasterListQuery) {
    return { data: await this.categories.list(q.archived) };
  }

  @Roles(Role.ADMIN)
  @Post()
  async create(@Body() dto: CategoryDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.categories.create(dto, user, req.id) };
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.categories.update(id, dto, user, req.id) };
  }

  @Roles(Role.ADMIN)
  @Post(':id/archive')
  async archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.categories.setArchived(id, true, user, req.id) };
  }

  @Roles(Role.ADMIN)
  @Post(':id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.categories.setArchived(id, false, user, req.id) };
  }
}
