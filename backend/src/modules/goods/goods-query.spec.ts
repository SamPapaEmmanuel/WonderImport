import { ShipmentStatus } from '../../generated/prisma/enums';
import { goodsOrderBy, goodsWhere } from './goods-query';

describe('goods query', () => {
  it('excludes archived goods by default', () => {
    expect(goodsWhere({ archived: 'exclude' })).toEqual({ AND: [{ archivedAt: null }] });
  });

  it('combines status, client and date filters', () => {
    const w = goodsWhere({ archived: 'exclude', status: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.ARRIVED], clientId: ['c1'], orderedFrom: '2026-06-01', orderedTo: '2026-06-30' });
    expect(w.AND).toEqual(
      expect.arrayContaining([
        { status: { in: ['IN_TRANSIT', 'ARRIVED'] } },
        { clientId: { in: ['c1'] } },
        { orderedAt: { gte: new Date('2026-06-01T00:00:00.000Z'), lte: new Date('2026-06-30T00:00:00.000Z') } },
      ]),
    );
  });

  it('"missing" check-in means not checked in although at or past the warehouse', () => {
    const w = goodsWhere({ archived: 'exclude', checkIn: 'missing' });
    expect(w.AND).toContainEqual({ chinaCheckedIn: false, status: { in: ['CHINA_WAREHOUSE', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'] } });
  });

  it('search covers item, tracking number, relations and status labels', () => {
    const w = goodsWhere({ archived: 'exclude', q: 'transit' });
    const or = (w.AND as Array<{ OR?: unknown[] }>).find((x) => x.OR)!.OR!;
    expect(or).toContainEqual({ itemName: { contains: 'transit', mode: 'insensitive' } });
    expect(or).toContainEqual({ client: { name: { contains: 'transit', mode: 'insensitive' } } });
    expect(or).toContainEqual({ status: { in: ['IN_TRANSIT'] } });
  });

  it('sorts with a stable tie-breaker and nulls last for margin', () => {
    expect(goodsOrderBy('margin:desc')).toEqual([{ margin: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }]);
    expect(goodsOrderBy('client:asc')).toEqual([{ client: { name: 'asc' } }, { id: 'asc' }]);
    expect(goodsOrderBy()).toEqual([{ updatedAt: 'desc' }, { id: 'asc' }]);
  });
});
