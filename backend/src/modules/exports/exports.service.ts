import { Injectable } from '@nestjs/common';
import { AuditAction } from '../../generated/prisma/enums';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { ClientsService } from '../clients/clients.service';
import type { ListClientsQuery } from '../clients/dto/client.dto';
import type { GoodsFilterQuery } from '../goods/dto/list-goods.query';
import { goodsOrderBy, goodsWhere } from '../goods/goods-query';
import { goodInclude, toGoodView } from '../goods/goods.view';
import { describeGoodsFilters } from './filter-summary';
import { buildClientsWorkbook, buildGoodsWorkbook } from './workbooks';

export const MAX_EXPORT_ROWS = 50_000;

const SORT_LABEL: Record<string, string> = {
  orderedAt: 'order date', status: 'status', totalCost: 'landed cost', expectedRevenue: 'revenue', profit: 'profit', margin: 'margin',
  client: 'client', updatedAt: 'last update', createdAt: 'date recorded', itemName: 'item name', quantity: 'quantity',
};

const stamp = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clients: ClientsService,
  ) {}

  /** The Goods list's exact result set (same filters and order), without paging. */
  async goods(q: GoodsFilterQuery, actor: AuthUser, requestId?: string) {
    const { page: _p, pageSize: _s, sort, ...filters } = q;
    const where = goodsWhere(filters);
    const total = await this.prisma.good.count({ where });
    if (total > MAX_EXPORT_ROWS) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, `This view has ${total.toLocaleString('en')} goods. Narrow the filters to ${MAX_EXPORT_ROWS.toLocaleString('en')} or fewer to export.`);
    }
    const rows = (await this.prisma.good.findMany({ where, orderBy: goodsOrderBy(sort), include: goodInclude })).map(toGoodView);

    const [clients, suppliers, categories] = await Promise.all([
      this.prisma.client.findMany({ where: { id: { in: filters.clientId ?? [] } }, select: { id: true, name: true } }),
      this.prisma.supplier.findMany({ where: { id: { in: filters.supplierId ?? [] } }, select: { id: true, name: true } }),
      this.prisma.category.findMany({ where: { id: { in: filters.categoryId ?? [] } }, select: { id: true, name: true } }),
    ]);
    const toMap = (l: { id: string; name: string }[]) => new Map(l.map((x) => [x.id, x.name]));
    const filterLines = describeGoodsFilters(filters, { clients: toMap(clients), suppliers: toMap(suppliers), categories: toMap(categories) });
    const [field, dir] = sort.split(':');

    const buffer = await buildGoodsWorkbook(rows, {
      exportedBy: actor.name,
      exportedAt: new Date(),
      filters: filterLines,
      sort: `${SORT_LABEL[field] ?? field}, ${dir === 'asc' ? 'ascending' : 'descending'}`,
    });

    await this.audit.record({ entity: 'Export', entityId: 'goods', action: AuditAction.EXPORT, actorId: actor.id, after: { rows: rows.length, filters: filterLines, sort }, requestId });
    return { buffer, fileName: `wonderimport-goods-${stamp()}.xlsx` };
  }

  async clientsWorkbook(q: Pick<ListClientsQuery, 'q' | 'archived' | 'sort'>, actor: AuthUser, requestId?: string) {
    const rows = await this.clients.allSorted(q);
    const description = [
      q.archived === 'only' ? 'Archived clients' : q.archived === 'include' ? 'All clients, including archived' : 'Active clients',
      q.q?.trim() ? `matching "${q.q.trim()}"` : null,
    ]
      .filter(Boolean)
      .join(' ');
    const buffer = await buildClientsWorkbook(rows, { exportedBy: actor.name, exportedAt: new Date(), description });
    await this.audit.record({ entity: 'Export', entityId: 'clients', action: AuditAction.EXPORT, actorId: actor.id, after: { rows: rows.length, description, sort: q.sort }, requestId });
    return { buffer, fileName: `wonderimport-clients-${stamp()}.xlsx` };
  }
}
