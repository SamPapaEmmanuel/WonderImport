import { ShipmentStatus } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { archivedWhere } from '../../common/query/archived-filter';
import { STATUS_LABEL } from '../../common/finance/shipment';
import { dateOnly } from '../../common/validation/decorators';
import { DEFAULT_GOODS_SORT, type GoodsFilterQuery, type GoodsSortField } from './dto/list-goods.query';

const AT_OR_PAST_WAREHOUSE: ShipmentStatus[] = [ShipmentStatus.CHINA_WAREHOUSE, ShipmentStatus.IN_TRANSIT, ShipmentStatus.ARRIVED, ShipmentStatus.DELIVERED];

export type GoodsFilters = Omit<GoodsFilterQuery, 'page' | 'pageSize' | 'sort'>;

/** Builds the WHERE clause for the goods filter contract. */
export function goodsWhere(f: GoodsFilters): Prisma.GoodWhereInput {
  const and: Prisma.GoodWhereInput[] = [archivedWhere(f.archived)];

  if (f.status?.length) and.push({ status: { in: f.status } });

  if (f.checkIn === 'yes') and.push({ chinaCheckedIn: true });
  if (f.checkIn === 'no') and.push({ chinaCheckedIn: false });
  if (f.checkIn === 'missing') and.push({ chinaCheckedIn: false, status: { in: AT_OR_PAST_WAREHOUSE } });

  if (f.clientId?.length) and.push({ OR: [{ clientId: { in: f.clientId } }, { allocations: { some: { clientId: { in: f.clientId } } } }] });
  if (f.supplierId?.length) and.push({ supplierId: { in: f.supplierId } });
  if (f.categoryId?.length) and.push({ categoryId: { in: f.categoryId } });

  if (f.orderedFrom || f.orderedTo) {
    and.push({
      orderedAt: {
        ...(f.orderedFrom ? { gte: dateOnly(f.orderedFrom) } : {}),
        ...(f.orderedTo ? { lte: dateOnly(f.orderedTo) } : {}),
      },
    });
  }

  if (f.priceOverridden !== undefined) and.push({ priceOverridden: f.priceOverridden });

  const term = f.q?.trim();
  if (term) {
    const contains = { contains: term, mode: 'insensitive' as const };
    const statusMatches = (Object.keys(STATUS_LABEL) as ShipmentStatus[]).filter((s) => STATUS_LABEL[s].toLowerCase().includes(term.toLowerCase()));
    and.push({
      OR: [
        { itemName: contains },
        { trackingNumber: contains },
        { client: { name: contains } },
        { client: { code: contains } },
        { supplier: { name: contains } },
        { category: { name: contains } },
        ...(statusMatches.length ? [{ status: { in: statusMatches } }] : []),
      ],
    });
  }

  return { AND: and };
}

/** Translates `field:dir` into a stable ORDER BY (id breaks ties so paging never repeats rows). */
export function goodsOrderBy(sort: string = DEFAULT_GOODS_SORT): Prisma.GoodOrderByWithRelationInput[] {
  const [field, rawDir] = sort.split(':') as [GoodsSortField, string];
  const dir: Prisma.SortOrder = rawDir === 'asc' ? 'asc' : 'desc';
  const nullsLast = { sort: dir, nulls: 'last' as const };

  let primary: Prisma.GoodOrderByWithRelationInput;
  switch (field) {
    case 'client':
      primary = { client: { name: dir } };
      break;
    case 'orderedAt':
      primary = { orderedAt: nullsLast };
      break;
    case 'margin':
      primary = { margin: nullsLast };
      break;
    case 'status':
    case 'totalCost':
    case 'expectedRevenue':
    case 'profit':
    case 'updatedAt':
    case 'createdAt':
    case 'itemName':
    case 'quantity':
      primary = { [field]: dir } as Prisma.GoodOrderByWithRelationInput;
      break;
    default:
      primary = { updatedAt: 'desc' };
  }
  return [primary, { id: 'asc' }];
}
