import { Injectable } from '@nestjs/common';
import { AuditAction } from '../../generated/prisma/enums';
import type { Client as ClientRow, Prisma } from '../../generated/prisma/client';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { paginate } from '../../common/pagination/pagination';
import { archivedWhere } from '../../common/query/archived-filter';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, changedFields } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { emptyClientSummary, summariseByClient, type ClientSummary } from './client-summary';
import type { CreateClientDto, ListClientsQuery, UpdateClientDto } from './dto/client.dto';

export function toClientView(c: ClientRow, summary: ClientSummary = emptyClientSummary()) {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    notes: c.notes,
    isStock: c.isStock,
    archivedAt: c.archivedAt?.toISOString() ?? null,
    goodsCount: summary.goods,
    summary,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

type ClientView = ReturnType<typeof toClientView>;

const EDITABLE = ['name', 'phone', 'email', 'address', 'notes'] as const;
const pick = (c: Record<string, unknown>) => Object.fromEntries(EDITABLE.map((k) => [k, c[k] ?? null]));

/** In-memory comparators. Client lists are small (hundreds), so sorting by computed totals in memory is cheap and exact. */
const SORTERS: Record<string, (a: ClientView, b: ClientView) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  code: (a, b) => a.code.localeCompare(b.code),
  goods: (a, b) => a.summary.goods - b.summary.goods,
  revenue: (a, b) => Number(a.summary.revenue) - Number(b.summary.revenue),
  profit: (a, b) => Number(a.summary.profit) - Number(b.summary.profit),
  margin: (a, b) => (a.summary.margin === null ? -Infinity : Number(a.summary.margin)) - (b.summary.margin === null ? -Infinity : Number(b.summary.margin)),
  createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
};

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Profitability per client across all their active (non-archived) goods. */
  private async summaries(clientIds: string[]) {
    if (!clientIds.length) return new Map<string, ClientSummary>();
    const rows = await this.prisma.good.groupBy({
      by: ['clientId', 'status'],
      where: { clientId: { in: clientIds }, archivedAt: null },
      _count: { _all: true },
      _sum: { quantity: true, totalCost: true, expectedRevenue: true, profit: true },
    });
    return summariseByClient(rows);
  }

  /** Every matching client with its totals, sorted. Shared by the list and the Excel export. */
  async allSorted(q: Pick<ListClientsQuery, 'q' | 'archived' | 'sort'>) {
    const where: Prisma.ClientWhereInput = { ...archivedWhere(q.archived) };
    if (q.q?.trim()) {
      const term = q.q.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.client.findMany({ where });
    const sums = await this.summaries(rows.map((r) => r.id));
    const views = rows.map((r) => toClientView(r, sums.get(r.id)));

    const [field, dir] = q.sort.split(':') as [string, 'asc' | 'desc'];
    const cmp = SORTERS[field] ?? SORTERS.name;
    views.sort((a, b) => (dir === 'desc' ? -cmp(a, b) : cmp(a, b)) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return views;
  }

  async list(q: ListClientsQuery) {
    const views = await this.allSorted(q);
    const start = (q.page - 1) * q.pageSize;
    return paginate(views.slice(start, start + q.pageSize), views.length, q, { q: q.q ?? null, archived: q.archived }, q.sort);
  }

  async get(id: string) {
    const c = await this.prisma.client.findUnique({ where: { id } });
    if (!c) throw AppException.notFound('Client');
    const sums = await this.summaries([id]);
    return toClientView(c, sums.get(id));
  }

  private async nextCode(db: Prisma.TransactionClient) {
    const last = await db.client.findFirst({ where: { code: { startsWith: 'CL-' } }, orderBy: { code: 'desc' }, select: { code: true } });
    const n = last ? Number.parseInt(last.code.slice(3), 10) || 0 : 0;
    return `CL-${String(n + 1).padStart(3, '0')}`;
  }

  async create(dto: CreateClientDto, actor: AuthUser, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const code = dto.code ?? (await this.nextCode(tx));
      const created = await tx.client.create({
        data: { code, name: dto.name.trim(), phone: dto.phone ?? null, email: dto.email?.toLowerCase() ?? null, address: dto.address ?? null, notes: dto.notes ?? null },
      });
      await this.audit.record({ entity: 'Client', entityId: created.id, action: AuditAction.CREATE, actorId: actor.id, after: { code, ...pick(created) }, requestId }, tx);
      return toClientView(created);
    });
  }

  async update(id: string, dto: UpdateClientDto, actor: AuthUser, requestId?: string) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) throw AppException.notFound('Client');
    if (existing.archivedAt) throw new AppException(ErrorCode.CONFLICT, 'This client is archived. Restore it before editing.');

    const data: Prisma.ClientUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    for (const k of ['phone', 'address', 'notes'] as const) if (dto[k] !== undefined) data[k] = dto[k];
    if (dto.email !== undefined) data.email = dto.email?.toLowerCase() ?? null;

    const diff = changedFields(pick(existing), { ...pick(existing), ...data });
    if (diff.changed.length === 0) return this.get(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id }, data });
      await this.audit.record({ entity: 'Client', entityId: id, action: AuditAction.UPDATE, actorId: actor.id, before: diff.before, after: diff.after, requestId }, tx);
    });
    return this.get(id);
  }

  async setArchived(id: string, archived: boolean, actor: AuthUser, reason?: string, requestId?: string) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) throw AppException.notFound('Client');
    if (existing.isStock && archived) throw new AppException(ErrorCode.CONFLICT, 'The stock client holds unassigned goods and cannot be archived.');
    if (Boolean(existing.archivedAt) === archived) return this.get(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
      await this.audit.record(
        { entity: 'Client', entityId: id, action: archived ? AuditAction.ARCHIVE : AuditAction.RESTORE, actorId: actor.id, note: reason ?? null, requestId },
        tx,
      );
    });
    return this.get(id);
  }
}
