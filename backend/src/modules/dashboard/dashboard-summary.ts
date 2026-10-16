import { ShipmentStatus } from '../../generated/prisma/enums';
import { addSums, emptySums, fromGroup, sumAll, withMargin, type PrismaGoodGroup, type Sums, type SumsWithMargin } from '../../common/finance/aggregate';
import { SHIPMENT_FLOW } from '../../common/finance/shipment';
import type { Period } from './period';

export const LEADING_CLIENTS = 5;

export interface ClientRef {
  id: string;
  code: string;
  name: string;
  isStock: boolean;
}

export interface StageSummary extends SumsWithMargin {
  status: ShipmentStatus;
  /** Goods at or past China warehouse without a check-in */
  checkInMissing: number;
}

export interface ClientRank extends SumsWithMargin {
  id: string;
  code: string;
  name: string;
}

export interface AllocationShare {
  clientId: string;
  status: ShipmentStatus;
  quantity: number;
  totalCost: string;
  expectedRevenue: string;
  profit: string;
}

export interface DashboardInput {
  period: Period;
  byStatus: (PrismaGoodGroup & { status: ShipmentStatus })[];
  byClient: (PrismaGoodGroup & { clientId: string })[];
  missingByStatus: { status: ShipmentStatus; _count: { _all: number } }[];
  clients: ClientRef[];
  /** Pro-rated shares of shared lots per buyer (see dashboard.service). */
  allocationShares?: AllocationShare[];
}

export const PERIOD_DEFINITION = 'Goods ordered in this period, by order date. Archived goods are excluded. Margin is total profit ÷ total revenue.';

/** Turns grouped database totals into the dashboard summary. Pure, so the reconciliation rules are testable. */
export function buildDashboardSummary(input: DashboardInput) {
  const missing = new Map(input.missingByStatus.map((m) => [m.status, m._count._all]));
  const statusSums = new Map(input.byStatus.map((g) => [g.status, fromGroup(g)]));

  const pipeline: StageSummary[] = SHIPMENT_FLOW.map((status) => ({
    status,
    ...withMargin(statusSums.get(status) ?? emptySums()),
    checkInMissing: missing.get(status) ?? 0,
  }));

  const totals = withMargin(sumAll(pipeline));
  const inTransit = pipeline.find((p) => p.status === ShipmentStatus.IN_TRANSIT)!;

  const clientIndex = new Map(input.clients.map((c) => [c.id, c]));
  let unassigned: (Sums & { clientId: string }) | null = null;
  const ranked: ClientRank[] = [];
  const shareIndex = new Map<string, AllocationShare[]>();
  for (const s of input.allocationShares ?? []) {
    const list = shareIndex.get(s.clientId) ?? [];
    list.push(s);
    shareIndex.set(s.clientId, list);
  }
  const shareSums = (clientId: string): Sums => {
    let out = emptySums();
    for (const s of shareIndex.get(clientId) ?? []) {
      out = addSums(out, { goods: 1, units: s.quantity, landedCost: s.totalCost, revenue: s.expectedRevenue, profit: s.profit });
    }
    return out;
  };
  for (const g of input.byClient) {
    const c = clientIndex.get(g.clientId);
    if (!c) continue;
    const sums = addSums(fromGroup(g), shareSums(g.clientId));
    if (c.isStock) unassigned = unassigned ? { ...addSums(unassigned, sums), clientId: c.id } : { ...sums, clientId: c.id };
    else ranked.push({ id: c.id, code: c.code, name: c.name, ...withMargin(sums) });
  }
  // Buyers who only ever bought via split sales have no byClient row — add them.
  for (const [clientId, shares] of shareIndex) {
    if (input.byClient.some((g) => g.clientId === clientId)) continue;
    const c = clientIndex.get(clientId);
    if (!c || c.isStock) {
      if (c?.isStock) unassigned = unassigned ? { ...addSums(unassigned, shareSums(clientId)), clientId: c.id } : { ...shareSums(clientId), clientId: c.id };
      continue;
    }
    ranked.push({ id: c.id, code: c.code, name: c.name, ...withMargin(shareSums(clientId)) });
  }

  const top = (by: (r: ClientRank) => number) =>
    [...ranked].sort((a, b) => by(b) - by(a) || a.name.localeCompare(b.name)).slice(0, LEADING_CLIENTS);

  return {
    period: { ...input.period, definition: PERIOD_DEFINITION },
    totals: {
      ...totals,
      inTransit: { goods: inTransit.goods, units: inTransit.units, landedCost: inTransit.landedCost },
      checkInMissing: pipeline.reduce((n, p) => n + p.checkInMissing, 0),
    },
    pipeline,
    leadingClients: {
      revenue: top((r) => Number(r.revenue)),
      profit: top((r) => Number(r.profit)),
      items: top((r) => r.goods),
      namedClients: ranked.length,
    },
    unassigned: unassigned ? withMargin(unassigned) : null,
  };
}

export type DashboardSummary = ReturnType<typeof buildDashboardSummary>;
