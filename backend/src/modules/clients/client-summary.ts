import { ShipmentStatus } from '../../generated/prisma/enums';
import { addSums, emptySums, fromGroup, withMargin, type PrismaGoodGroup, type SumsWithMargin } from '../../common/finance/aggregate';

export interface ClientSummary extends SumsWithMargin {
  delivered: number;
  inProgress: number;
  byStatus: Record<ShipmentStatus, number>;
}

const zeroStatus = (): Record<ShipmentStatus, number> => ({
  ORDERED: 0,
  AT_SUPPLIER: 0,
  CHINA_WAREHOUSE: 0,
  IN_TRANSIT: 0,
  ARRIVED: 0,
  DELIVERED: 0,
});

export function emptyClientSummary(): ClientSummary {
  return { ...withMargin(emptySums()), delivered: 0, inProgress: 0, byStatus: zeroStatus() };
}

/** Folds rows grouped by (clientId, status) into one summary per client. */
export function summariseByClient(rows: (PrismaGoodGroup & { clientId: string; status: ShipmentStatus })[]): Map<string, ClientSummary> {
  const sums = new Map<string, ReturnType<typeof emptySums>>();
  const statuses = new Map<string, Record<ShipmentStatus, number>>();
  for (const r of rows) {
    sums.set(r.clientId, addSums(sums.get(r.clientId) ?? emptySums(), fromGroup(r)));
    const st = statuses.get(r.clientId) ?? zeroStatus();
    st[r.status] += r._count._all;
    statuses.set(r.clientId, st);
  }
  const out = new Map<string, ClientSummary>();
  for (const [id, s] of sums) {
    const byStatus = statuses.get(id)!;
    out.set(id, { ...withMargin(s), delivered: byStatus.DELIVERED, inProgress: s.goods - byStatus.DELIVERED, byStatus });
  }
  return out;
}
