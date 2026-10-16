import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { ShipmentStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { goodsWhere } from '../goods/goods-query';
import { goodListInclude, toGoodView } from '../goods/goods.view';
import { buildDashboardSummary } from './dashboard-summary';
import type { DashboardQuery } from './dashboard.dto';
import { resolvePeriod } from './period';

const AT_OR_PAST_WAREHOUSE = [ShipmentStatus.CHINA_WAREHOUSE, ShipmentStatus.IN_TRANSIT, ShipmentStatus.ARRIVED, ShipmentStatus.DELIVERED];
const RECENT = 8;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One round of grouped queries. The WHERE clause comes from the same builder as GET /goods,
   * so every figure equals the total of the goods list opened by its drill-through link.
   */
  async summary(q: DashboardQuery) {
    const period = resolvePeriod(q.period, { from: q.from, to: q.to });
    const where = goodsWhere({ archived: 'exclude', orderedFrom: period.from ?? undefined, orderedTo: period.to ?? undefined });
    const sums = { quantity: true, totalCost: true, expectedRevenue: true, profit: true } as const;

    const [byStatus, byClient, missingByStatus, recent] = await Promise.all([
      this.prisma.good.groupBy({ by: ['status'], where, _count: { _all: true }, _sum: sums }),
      this.prisma.good.groupBy({ by: ['clientId'], where, _count: { _all: true }, _sum: sums }),
      this.prisma.good.groupBy({
        by: ['status'],
        where: { AND: [where, { chinaCheckedIn: false, status: { in: AT_OR_PAST_WAREHOUSE } }] },
        _count: { _all: true },
      }),
      this.prisma.good.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: RECENT, include: goodListInclude }),
    ]);

    // Split-sale buyers: attribute each buyer's share of shared lots (pro-rated
    // money by allocated units) so two clients buying one good both rank.
    const sharedLots = await this.prisma.good.findMany({
      where: { AND: [where, { allocations: { some: {} } }] },
      select: {
        id: true, clientId: true, status: true, quantity: true, totalCost: true, expectedRevenue: true, profit: true,
        allocations: { select: { clientId: true, quantity: true } },
      },
    });
    const allocationShares: { clientId: string; status: ShipmentStatus; quantity: number; totalCost: string; expectedRevenue: string; profit: string }[] = [];
    for (const lot of sharedLots) {
      if (lot.quantity <= 0) continue;
      for (const a of lot.allocations) {
        // Skip lots a buyer owns outright — already counted in byClient.
        if (a.clientId === lot.clientId) continue;
        const share = a.quantity / lot.quantity;
        const money = (v: { toString(): string }) => new Decimal(v.toString()).times(share).toFixed(2);
        allocationShares.push({
          clientId: a.clientId, status: lot.status, quantity: a.quantity,
          totalCost: money(lot.totalCost), expectedRevenue: money(lot.expectedRevenue), profit: money(lot.profit),
        });
      }
    }

    // Client names for the leading-clients panel, in the same round as the groups.
    const clientIds = [...new Set([...byClient.map((g) => g.clientId).filter((id): id is string => id != null), ...allocationShares.map((a) => a.clientId)])];
    const clients = clientIds.length
      ? await this.prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, code: true, name: true, isStock: true },
        })
      : [];

    return {
      ...buildDashboardSummary({ period, byStatus, byClient, missingByStatus, clients, allocationShares }),
      recent: recent.map(toGoodView),
    };
  }
}
