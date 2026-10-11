import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import type { AuthedRequest, AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdatePricingDto } from './update-pricing.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('pricing')
  async pricing() {
    return { data: await this.settings.getPricing() };
  }

  @Roles(Role.ADMIN)
  @Patch('pricing')
  async updatePricing(@Body() dto: UpdatePricingDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return { data: await this.settings.updateExchangeRate(dto.defaultExchangeRate, user, req.id) };
  }
}
