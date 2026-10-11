import { Injectable } from '@nestjs/common';
import { AuditAction } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { AppException } from '../../common/errors/app-exception';
import { archivedWhere, type ArchivedFilter } from '../../common/query/archived-filter';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, changedFields } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import type { CategoryDto, UpdateCategoryDto } from './category.dto';

type Row = Prisma.CategoryGetPayload<{ include: { _count: { select: { goods: { where: { archivedAt: null } } } } } }>;

const view = (c: Row) => ({
  id: c.id,
  name: c.name,
  description: c.description,
  archivedAt: c.archivedAt?.toISOString() ?? null,
  goodsCount: c._count.goods,
});

const pick = (c: { name: string; description: string | null }) => ({ name: c.name, description: c.description });

@Injectable()
export class CategoriesService {
  private readonly include = { _count: { select: { goods: { where: { archivedAt: null } } } } } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(archived: ArchivedFilter) {
    const rows = await this.prisma.category.findMany({ where: archivedWhere(archived), orderBy: { name: 'asc' }, include: this.include });
    return rows.map(view);
  }

  private async load(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id }, include: this.include });
    if (!c) throw AppException.notFound('Category');
    return c;
  }

  async create(dto: CategoryDto, actor: AuthUser, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.category.create({ data: { name: dto.name.trim(), description: dto.description ?? null }, include: this.include });
      await this.audit.record({ entity: 'Category', entityId: c.id, action: AuditAction.CREATE, actorId: actor.id, after: pick(c), requestId }, tx);
      return view(c);
    });
  }

  async update(id: string, dto: UpdateCategoryDto, actor: AuthUser, requestId?: string) {
    const existing = await this.load(id);
    const next = { ...pick(existing), ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.description !== undefined ? { description: dto.description } : {}) };
    const diff = changedFields(pick(existing), next);
    if (!diff.changed.length) return view(existing);
    await this.prisma.$transaction(async (tx) => {
      await tx.category.update({ where: { id }, data: next });
      await this.audit.record({ entity: 'Category', entityId: id, action: AuditAction.UPDATE, actorId: actor.id, before: diff.before, after: diff.after, requestId }, tx);
    });
    return view(await this.load(id));
  }

  async setArchived(id: string, archived: boolean, actor: AuthUser, requestId?: string) {
    const existing = await this.load(id);
    if (Boolean(existing.archivedAt) === archived) return view(existing);
    await this.prisma.$transaction(async (tx) => {
      await tx.category.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
      await this.audit.record({ entity: 'Category', entityId: id, action: archived ? AuditAction.ARCHIVE : AuditAction.RESTORE, actorId: actor.id, requestId }, tx);
    });
    return view(await this.load(id));
  }
}
