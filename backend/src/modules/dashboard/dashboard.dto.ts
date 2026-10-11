import { IsIn, IsOptional } from 'class-validator';
import { IsDateOnly } from '../../common/validation/decorators';
import { PERIOD_KEYS, type PeriodKey } from './period';

export class DashboardQuery {
  @IsOptional()
  @IsIn(PERIOD_KEYS)
  period: Exclude<PeriodKey, 'custom'> = 'all';

  /** Custom range on the order date (overrides `period`). */
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @IsOptional()
  @IsDateOnly()
  to?: string;
}
