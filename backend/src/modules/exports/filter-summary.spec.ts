import { ShipmentStatus } from '../../generated/prisma/enums';
import { describeGoodsFilters } from './filter-summary';

const names = { clients: new Map([['c1', 'Cons']]), suppliers: new Map(), categories: new Map([['k1', 'Bags']]) };

describe('describeGoodsFilters', () => {
  it('describes each active filter in plain language', () => {
    expect(
      describeGoodsFilters(
        { archived: 'exclude', q: 'perfume', status: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.ARRIVED], checkIn: 'missing', clientId: ['c1'], categoryId: ['k1'], orderedFrom: '2026-06-01', priceOverridden: true },
        names,
      ),
    ).toEqual([
      'Search: "perfume"',
      'Status: In transit, Arrived',
      'China check-in: missing (past the warehouse)',
      'Client: Cons',
      'Category: Bags',
      'Ordered: 2026-06-01 to today',
      'Selling price: set manually',
    ]);
  });

  it('says when there are no filters', () => {
    expect(describeGoodsFilters({ archived: 'exclude' }, names)).toEqual(['All active goods (no filters)']);
  });
});
