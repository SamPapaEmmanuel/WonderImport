import { IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ShipmentStatus } from '../../../generated/prisma/enums';
import { PaginationQuery } from '../../../common/pagination/pagination';
import { ARCHIVED_FILTERS, type ArchivedFilter } from '../../../common/query/archived-filter';
import { IsDateOnly, ToArray, ToBoolean } from '../../../common/validation/decorators';

export const GOODS_SORT_FIELDS = ['orderedAt', 'status', 'totalCost', 'expectedRevenue', 'profit', 'margin', 'client', 'updatedAt', 'createdAt', 'itemName', 'quantity'] as const;
export type GoodsSortField = (typeof GOODS_SORT_FIELDS)[number];
export const DEFAULT_GOODS_SORT = 'updatedAt:desc';

const SORT_PATTERN = new RegExp(`^(${GOODS_SORT_FIELDS.join('|')}):(asc|desc)$`);

export const CHECK_IN_FILTERS = ['yes', 'no', 'missing'] as const;
export type CheckInFilter = (typeof CHECK_IN_FILTERS)[number];

/**
 * The goods filter contract. The Goods list and the Excel export (Phase 4) both accept exactly this,
 * so an export always matches what is on screen.
 */
export class GoodsFilterQuery extends PaginationQuery {
  /** Item, tracking number, client, supplier, category or status label */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @ToArray()
  @IsEnum(ShipmentStatus, { each: true })
  status?: ShipmentStatus[];

  /** yes = checked in, no = not checked in, missing = not checked in although past China warehouse */
  @IsOptional()
  @IsIn(CHECK_IN_FILTERS)
  checkIn?: CheckInFilter;

  @IsOptional()
  @ToArray()
  @IsUUID('all', { each: true })
  clientId?: string[];

  @IsOptional()
  @ToArray()
  @IsUUID('all', { each: true })
  supplierId?: string[];

  @IsOptional()
  @ToArray()
  @IsUUID('all', { each: true })
  categoryId?: string[];

  @IsOptional()
  @IsDateOnly()
  orderedFrom?: string;

  @IsOptional()
  @IsDateOnly()
  orderedTo?: string;

  @IsOptional()
  @ToBoolean()
  @IsIn([true, false])
  priceOverridden?: boolean;

  @IsOptional()
  @IsIn(ARCHIVED_FILTERS)
  archived: ArchivedFilter = 'exclude';

  @IsOptional()
  @Matches(SORT_PATTERN, { message: `sort must be field:asc|desc where field is one of ${GOODS_SORT_FIELDS.join(', ')}` })
  sort: string = DEFAULT_GOODS_SORT;
}
