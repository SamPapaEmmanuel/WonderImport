import { Injectable } from '@nestjs/common';
import { AuditAction } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { AppException } from '../../common/errors/app-exception';
import { archivedWhere, type ArchivedFilter } from '../../common/query/archived-filter';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, changedFields } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import type { SupplierDto, UpdateSupplierDto } from './supplier.dto';

const FIELDS = ['name', 'contactPerson', 'phone', 'email', 'country', 'notes'] as const;
type Row = Prisma.SupplierGetPayload<{ include: { _count: { select: { goods: { where: { archivedAt: null } } } } } }>;

const view = (s: Row) => ({
  id: s.id,
  name: s.name,
  contactPerson: s.contactPerson,
  phone: s.phone,
  email: s.email,
  country: s.country,
  notes: s.notes,
  archivedAt: s.archivedAt?.toISOString() ?? null,
  goodsCount: s._count.goods,
});

const pick = (s: Record<string, unknown>) => Object.fromEntries(FIELDS.map((k) => [k, s[k] ?? null]));

@Injectable()
export class SuppliersService {
  private readonly include = { _count: { select: { goods: { where: { archivedAt: null } } } } } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(archived: ArchivedFilter) {
    const rows = await this.prisma.supplier.findMany({ where: archivedWhere(archived), orderBy: { name: 'asc' }, include: this.include });
    return rows.map(view);
  }

  private async load(id: string) {
    const s = await this.prisma.supplier.findUnique({ where: { id }, include: this.include });
    if (!s) throw AppException.notFound('Supplier');
    return s;
  }

  async create(dto: SupplierDto, actor: AuthUser, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.supplier.create({ data: { ...dto, name: dto.name.trim(), country: dto.country ?? 'China' }, include: this.include });
      await this.audit.record({ entity: 'Supplier', entityId: s.id, action: AuditAction.CREATE, actorId: actor.id, after: pick(s), requestId }, tx);
      return view(s);
    });
  }

  async update(id: string, dto: UpdateSupplierDto, actor: AuthUser, requestId?: string) {
    const existing = await this.load(id);
    const data = { ...dto, ...(dto.name ? { name: dto.name.trim() } : {}) };
    const diff = changedFields(pick(existing), { ...pick(existing), ...data });
    if (!diff.changed.length) return view(existing);
    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({ where: { id }, data });
      await this.audit.record({ entity: 'Supplier', entityId: id, action: AuditAction.UPDATE, actorId: actor.id, before: diff.before, after: diff.after, requestId }, tx);
    });
    return view(await this.load(id));
  }

  async setArchived(id: string, archived: boolean, actor: AuthUser, requestId?: string) {
    const existing = await this.load(id);
    if (Boolean(existing.archivedAt) === archived) return view(existing);
    // Archiving hides the supplier from new goods; existing goods keep their link.
    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
      await this.audit.record({ entity: 'Supplier', entityId: id, action: archived ? AuditAction.ARCHIVE : AuditAction.RESTORE, actorId: actor.id, requestId }, tx);
    });
    return view(await this.load(id));
  }
}
