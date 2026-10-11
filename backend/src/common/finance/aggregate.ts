import Decimal from 'decimal.js';
import { marginOf } from './pricing';

/** Totals for a group of goods. Money is an exact 2-decimal string. */
export interface Sums {
  goods: number;
  units: number;
  landedCost: string;
  revenue: string;
  profit: string;
}

export interface SumsWithMargin extends Sums {
  margin: string | null;
}

/** Shape returned by prisma.good.groupBy with _count._all and _sum of the money columns. */
export interface PrismaGoodGroup {
  _count: { _all: number };
  _sum: {
    quantity: number | null;
    totalCost: { toString(): string } | null;
    expectedRevenue: { toString(): string } | null;
    profit: { toString(): string } | null;
  };
}

const ZERO = '0.00';
const money = (v: { toString(): string } | null | undefined) => new Decimal(v ? v.toString() : 0).toFixed(2);

export const emptySums = (): Sums => ({ goods: 0, units: 0, landedCost: ZERO, revenue: ZERO, profit: ZERO });

export function fromGroup(g: PrismaGoodGroup): Sums {
  return {
    goods: g._count._all,
    units: g._sum.quantity ?? 0,
    landedCost: money(g._sum.totalCost),
    revenue: money(g._sum.expectedRevenue),
    profit: money(g._sum.profit),
  };
}

export function addSums(a: Sums, b: Sums): Sums {
  return {
    goods: a.goods + b.goods,
    units: a.units + b.units,
    landedCost: new Decimal(a.landedCost).plus(b.landedCost).toFixed(2),
    revenue: new Decimal(a.revenue).plus(b.revenue).toFixed(2),
    profit: new Decimal(a.profit).plus(b.profit).toFixed(2),
  };
}

/** Margin of a group is total profit ÷ total revenue (weighted), never an average of item margins. */
export const withMargin = (s: Sums): SumsWithMargin => ({ ...s, margin: marginOf(s.revenue, s.profit) });

export const sumAll = (list: Sums[]) => list.reduce(addSums, emptySums());
