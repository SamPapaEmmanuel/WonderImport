import Decimal from 'decimal.js';
import { ShipmentStatus as S } from '../../generated/prisma/enums';
import { summariseByClient } from './client-summary';

const row = (clientId: string, status: S, count: number, cost: string, revenue: string, profit: string) => ({
  clientId,
  status,
  _count: { _all: count },
  _sum: { quantity: count, totalCost: new Decimal(cost), expectedRevenue: new Decimal(revenue), profit: new Decimal(profit) },
});

describe('summariseByClient', () => {
  it('adds up statuses into one profitability summary per client', () => {
    const m = summariseByClient([
      row('cons', S.DELIVERED, 3, '30.00', '90.00', '60.00'),
      row('cons', S.IN_TRANSIT, 2, '20.05', '50.00', '29.95'),
      row('lucy', S.ORDERED, 1, '10.00', '0.00', '-10.00'),
    ]);
    expect(m.get('cons')).toMatchObject({ goods: 5, landedCost: '50.05', revenue: '140.00', profit: '89.95', margin: '64.25', delivered: 3, inProgress: 2 });
    expect(m.get('cons')!.byStatus).toMatchObject({ DELIVERED: 3, IN_TRANSIT: 2, ORDERED: 0 });
    expect(m.get('lucy')).toMatchObject({ margin: null, delivered: 0, inProgress: 1 });
  });
});
