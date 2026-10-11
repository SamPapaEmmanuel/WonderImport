import Decimal from 'decimal.js';
import { ShipmentStatus as S } from '../../generated/prisma/enums';
import { buildDashboardSummary } from './dashboard-summary';
import { resolvePeriod } from './period';

const group = (count: number, units: number, cost: string, revenue: string, profit: string) => ({
  _count: { _all: count },
  _sum: { quantity: units, totalCost: new Decimal(cost), expectedRevenue: new Decimal(revenue), profit: new Decimal(profit) },
});

const clients = [
  { id: 'stock', code: 'STOCK', name: 'Stock (unassigned)', isStock: true },
  { id: 'cons', code: 'CL-001', name: 'Cons', isStock: false },
  { id: 'lucy', code: 'CL-002', name: 'Lucy', isStock: false },
];

const input = {
  period: resolvePeriod('all'),
  byStatus: [
    { status: S.DELIVERED, ...group(3, 5, '100.00', '300.00', '200.00') },
    { status: S.IN_TRANSIT, ...group(2, 2, '50.10', '120.00', '69.90') },
    { status: S.CHINA_WAREHOUSE, ...group(1, 4, '20.00', '15.00', '-5.00') },
  ],
  byClient: [
    { clientId: 'stock', ...group(2, 6, '40.00', '60.00', '20.00') },
    { clientId: 'cons', ...group(3, 3, '110.10', '300.00', '189.90') },
    { clientId: 'lucy', ...group(1, 2, '20.00', '75.00', '55.00') },
  ],
  missingByStatus: [
    { status: S.CHINA_WAREHOUSE, _count: { _all: 1 } },
    { status: S.IN_TRANSIT, _count: { _all: 1 } },
  ],
  clients,
};

describe('buildDashboardSummary', () => {
  const s = buildDashboardSummary(input);

  it('lists all six stages in order, with zeros for empty ones', () => {
    expect(s.pipeline.map((p) => p.status)).toEqual(['ORDERED', 'AT_SUPPLIER', 'CHINA_WAREHOUSE', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED']);
    expect(s.pipeline[0]).toMatchObject({ goods: 0, landedCost: '0.00', margin: null });
  });

  it('totals equal the sum of the stages exactly', () => {
    expect(s.totals).toMatchObject({ goods: 6, units: 11, landedCost: '170.10', revenue: '435.00', profit: '264.90', margin: '60.90' });
  });

  it('totals reconcile with clients plus unassigned stock', () => {
    const named = s.leadingClients.revenue.reduce((d, c) => d.plus(c.revenue), new Decimal(0));
    expect(named.plus(s.unassigned!.revenue).toFixed(2)).toBe(s.totals.revenue);
  });

  it('reports in-transit figures and missing check-ins', () => {
    expect(s.totals.inTransit).toEqual({ goods: 2, units: 2, landedCost: '50.10' });
    expect(s.totals.checkInMissing).toBe(2);
    expect(s.pipeline.find((p) => p.status === 'CHINA_WAREHOUSE')!.checkInMissing).toBe(1);
  });

  it('keeps unassigned stock out of the client rankings', () => {
    expect(s.leadingClients.revenue.map((c) => c.name)).toEqual(['Cons', 'Lucy']);
    expect(s.leadingClients.items.map((c) => c.name)).toEqual(['Cons', 'Lucy']);
    expect(s.unassigned).toMatchObject({ goods: 2, revenue: '60.00', margin: '33.33' });
    expect(s.leadingClients.namedClients).toBe(2);
  });

  it('uses weighted margin per client', () => {
    expect(s.leadingClients.profit[0]).toMatchObject({ name: 'Cons', profit: '189.90', margin: '63.30' });
  });
});
