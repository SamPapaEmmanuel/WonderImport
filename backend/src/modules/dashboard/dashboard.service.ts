import { Injectable } from '@nestjs/common';
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

    // Client names for the leading-clients panel, in the same round as the groups.
    const clientIds = [...new Set(byClient.map((g) => g.clientId).filter((id): id is string => id != null))];
    const clients = clientIds.length
      ? await this.prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, code: true, name: true, isStock: true },
        })
      : [];

    return {
      ...buildDashboardSummary({ period, byStatus, byClient, missingByStatus, clients }),
      recent: recent.map(toGoodView),
    };
  }
}
