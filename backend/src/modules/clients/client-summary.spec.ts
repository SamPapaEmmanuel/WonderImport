import Decimal from 'decimal.js';
import { ShipmentStatus as S } from '../../generated/prisma/enums';
import { addAllocationShare, emptyClientSummary, summariseByClient } from './client-summary';

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

  it('pro-rates a shared lot across two buyers', () => {
    // Lot of 10: cost 100, revenue 300, profit 200. Ama takes 6, Kojo takes 4.
    const lot = { status: S.DELIVERED, totalCost: new Decimal('100.00'), expectedRevenue: new Decimal('300.00'), profit: new Decimal('200.00') };
    const ama = addAllocationShare(emptyClientSummary(), lot, 6, 0.6);
    const kojo = addAllocationShare(undefined, lot, 4, 0.4);
    expect(ama).toMatchObject({ goods: 1, units: 6, landedCost: '60.00', revenue: '180.00', profit: '120.00', margin: '66.67', delivered: 1 });
    expect(kojo).toMatchObject({ goods: 1, units: 4, landedCost: '40.00', revenue: '120.00', profit: '80.00', delivered: 1 });
    // Together they own the whole lot exactly once — no double counting.
    expect(new Decimal(ama.landedCost).plus(kojo.landedCost).toFixed(2)).toBe('100.00');
  });
});
