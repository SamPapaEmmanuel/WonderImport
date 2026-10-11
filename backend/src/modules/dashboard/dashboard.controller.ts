import { Controller, Get, Query } from '@nestjs/common';
import { DashboardQuery } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Key figures, shipping route, leading clients and recently updated goods for a period. */
  @Get('summary')
  async summary(@Query() q: DashboardQuery) {
    return { data: await this.dashboard.summary(q) };
  }
}
