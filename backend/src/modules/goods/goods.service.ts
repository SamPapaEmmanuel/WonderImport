import { Injectable } from '@nestjs/common';
import { AuditAction, Role, ShipmentStatus } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode, type FieldError } from '../../common/errors/error-codes';
import { checkTransition, indexOfStatus, SHIPMENT_FLOW, STATUS_DATE_FIELD, STATUS_LABEL } from '../../common/finance/shipment';
import { paginate, skipTake } from '../../common/pagination/pagination';
import { dateOnly } from '../../common/validation/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, changedFields } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { SettingsService } from '../settings/settings.service';
import type { ArchiveGoodDto, ChangeStatusDto, ChinaCheckInDto, CreateGoodDto, UpdateGoodDto } from './dto/good.dto';
import type { GoodsFilterQuery } from './dto/list-goods.query';
import { planFinancials, type FinancialPlan } from './goods-financials';
import { goodsOrderBy, goodsWhere } from './goods-query';
import { auditableGood, goodDetailInclude, goodInclude, toGoodDetailView, toGoodView, type GoodRow } from './goods.view';

type Tx = Prisma.TransactionClient;

const today = () => dateOnly(new Date().toISOString().slice(0, 10));

const STAGE_DATE_KEYS = ['supplierReceivedAt', 'warehouseReceivedAt', 'departedAt', 'arrivedAt', 'deliveredAt'] as const;

@Injectable()
export class GoodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  // ───────────────────────── Reads ─────────────────────────

  async list(q: GoodsFilterQuery) {
    const where = goodsWhere(q);
    const [total, rows] = await Promise.all([
      this.prisma.good.count({ where }),
      this.prisma.good.findMany({ where, orderBy: goodsOrderBy(q.sort), include: goodInclude, ...skipTake(q) }),
    ]);
    const { page: _p, pageSize: _s, sort, ...filters } = q;
    return paginate(rows.map(toGoodView), total, q, filters, sort);
  }

  async get(id: string) {
    const g = await this.prisma.good.findUnique({ where: { id }, include: goodDetailInclude });
    if (!g) throw AppException.notFound('Good');
    return toGoodDetailView(g);
  }

  async history(id: string) {
    await this.load(id);
    const rows = await this.audit.history('Good', id);
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      before: r.before,
      after: r.after,
      note: r.note,
      actor: r.actor ? { id: r.actor.id, name: r.actor.name } : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async load(id: string, db: Tx | PrismaService = this.prisma): Promise<GoodRow> {
    const g = await db.good.findUnique({ where: { id }, include: goodInclude });
    if (!g) throw AppException.notFound('Good');
    return g;
  }

  // ───────────────────────── Create / update ─────────────────────────

  async create(dto: CreateGoodDto, actor: AuthUser, requestId?: string) {
    const pricing = await this.settings.getPricing();
    const plan = planFinancials(
      null,
      { quantity: dto.quantity, unitCost: dto.unitCost, exchangeRate: dto.exchangeRate, sellingPrice: dto.sellingPrice, overrideReason: dto.overrideReason },
      { exchangeRate: pricing.defaultExchangeRate, multiplier: pricing.priceMultiplier },
    );
    const errors = [...plan.errors, ...(await this.checkReferences(dto)), ...this.checkSold(dto.quantity, dto.quantitySold ?? 0)];
    if (errors.length) throw AppException.validation(errors);

    const status = dto.status ?? ShipmentStatus.ORDERED;
    const checkedIn = dto.chinaCheckedIn ?? false;
    const orderedAt = dto.orderedAt ? dateOnly(dto.orderedAt) : today();
    const now = new Date();
    const stageDate: Partial<Record<(typeof STATUS_DATE_FIELD)[ShipmentStatus], Date>> = {};
    if (status !== ShipmentStatus.ORDERED) stageDate[STATUS_DATE_FIELD[status]] = today();

    const id = await this.prisma.$transaction(async (tx) => {
      const g = await tx.good.create({
        data: {
          itemName: dto.itemName.trim(),
          trackingNumber: dto.trackingNumber ?? null,
          quantitySold: dto.quantitySold ?? 0,
          retailPrice: dto.retailPrice ?? null,
          notes: dto.notes ?? null,
          ...plan.columns,
          ...(plan.columns.priceOverridden ? { overriddenById: actor.id, overriddenAt: now } : {}),
          status,
          orderedAt,
          ...stageDate,
          chinaCheckedIn: checkedIn,
          chinaCheckedInAt: checkedIn ? now : null,
          chinaCheckedInById: checkedIn ? actor.id : null,
          clientId: dto.clientId,
          supplierId: dto.supplierId,
          categoryId: dto.categoryId,
          createdById: actor.id,
        },
        include: goodInclude,
      });

      await this.writeSnapshot(tx, g.id, plan, actor);
      await tx.goodsStatusHistory.create({ data: { goodId: g.id, fromStatus: null, toStatus: status, changedById: actor.id, note: 'Recorded' } });
      await this.audit.record({ entity: 'Good', entityId: g.id, action: AuditAction.CREATE, actorId: actor.id, after: { ...auditableGood(g), status, chinaCheckedIn: checkedIn }, requestId }, tx);
      if (plan.columns.priceOverridden) {
        await this.audit.record(
          { entity: 'Good', entityId: g.id, action: AuditAction.PRICE_OVERRIDE, actorId: actor.id, before: { suggestedPrice: plan.columns.suggestedPrice }, after: { sellingPrice: plan.columns.sellingPrice }, note: plan.columns.overrideReason, requestId },
          tx,
        );
      }
      return g.id;
    });
    return this.get(id);
  }

  async update(id: string, dto: UpdateGoodDto, actor: AuthUser, requestId?: string) {
    const existing = await this.load(id);
    if (existing.archivedAt) throw new AppException(ErrorCode.CONFLICT, 'This good is archived. Restore it before editing.');

    const pricing = await this.settings.getPricing();
    const plan = planFinancials(
      {
        quantity: existing.quantity,
        unitCost: existing.unitCost.toString(),
        exchangeRate: existing.exchangeRate.toString(),
        priceMultiplier: existing.priceMultiplier.toString(),
        sellingPrice: existing.sellingPrice.toFixed(2),
        priceOverridden: existing.priceOverridden,
        overrideReason: existing.overrideReason,
      },
      { quantity: dto.quantity, unitCost: dto.unitCost, exchangeRate: dto.exchangeRate, sellingPrice: dto.sellingPrice, overrideReason: dto.overrideReason },
      { exchangeRate: pricing.defaultExchangeRate },
    );

    const changedRefs = {
      clientId: dto.clientId && dto.clientId !== existing.clientId ? dto.clientId : undefined,
      supplierId: dto.supplierId && dto.supplierId !== existing.supplierId ? dto.supplierId : undefined,
      categoryId: dto.categoryId && dto.categoryId !== existing.categoryId ? dto.categoryId : undefined,
    };
    const errors = [
      ...plan.errors,
      ...(await this.checkReferences(changedRefs)),
      ...this.checkSold(dto.quantity ?? existing.quantity, dto.quantitySold ?? existing.quantitySold),
    ];
    if (errors.length) throw AppException.validation(errors);

    const data: Prisma.GoodUncheckedUpdateInput = { ...plan.columns, updatedById: actor.id };
    if (dto.itemName !== undefined) data.itemName = dto.itemName.trim();
    if (dto.trackingNumber !== undefined) data.trackingNumber = dto.trackingNumber;
    if (dto.quantitySold !== undefined) data.quantitySold = dto.quantitySold;
    if (dto.retailPrice !== undefined) data.retailPrice = dto.retailPrice;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (changedRefs.clientId) data.clientId = changedRefs.clientId;
    if (changedRefs.supplierId) data.supplierId = changedRefs.supplierId;
    if (changedRefs.categoryId) data.categoryId = changedRefs.categoryId;
    if (dto.orderedAt !== undefined) data.orderedAt = dto.orderedAt ? dateOnly(dto.orderedAt) : null;
    for (const key of STAGE_DATE_KEYS) {
      const v = dto[key];
      if (v !== undefined) data[key] = v ? dateOnly(v) : null;
    }
    if (plan.overrideEvent === 'set' || plan.overrideEvent === 'changed') {
      data.overriddenById = actor.id;
      data.overriddenAt = new Date();
    } else if (plan.overrideEvent === 'cleared') {
      data.overriddenById = null;
      data.overriddenAt = null;
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.good.update({ where: { id }, data, include: goodInclude });
      const diff = changedFields(auditableGood(existing), auditableGood(updated));
      if (diff.changed.length === 0) return;

      if (plan.financialsChanged) await this.writeSnapshot(tx, id, plan, actor);
      await this.audit.record({ entity: 'Good', entityId: id, action: AuditAction.UPDATE, actorId: actor.id, before: diff.before, after: diff.after, requestId }, tx);
      if (plan.overrideEvent !== 'none') {
        await this.audit.record(
          {
            entity: 'Good',
            entityId: id,
            action: AuditAction.PRICE_OVERRIDE,
            actorId: actor.id,
            before: { sellingPrice: existing.sellingPrice.toFixed(2), priceOverridden: existing.priceOverridden },
            after: { sellingPrice: plan.columns.sellingPrice, priceOverridden: plan.columns.priceOverridden },
            note: plan.overrideEvent === 'cleared' ? 'Returned to the suggested price' : plan.columns.overrideReason,
            requestId,
          },
          tx,
        );
      }
    });
    return this.get(id);
  }

  // ───────────────────────── Shipment ─────────────────────────

  async changeStatus(id: string, dto: ChangeStatusDto, actor: AuthUser, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const g = await this.load(id, tx);
      if (g.archivedAt) throw new AppException(ErrorCode.CONFLICT, 'This good is archived. Restore it before changing its status.');
      if (dto.expectedStatus && dto.expectedStatus !== g.status) {
        throw new AppException(ErrorCode.CONFLICT, `Someone else already moved this good to ${STATUS_LABEL[g.status]}. Refresh to see the latest status.`, undefined, {
          currentStatus: g.status,
        });
      }

      const result = checkTransition(g.status, dto.status, {
        chinaCheckedIn: g.chinaCheckedIn,
        correction: dto.correction,
        isAdmin: actor.role === Role.ADMIN,
        reason: dto.note,
      });
      if (!result.ok) {
        throw new AppException(ErrorCode.INVALID_STATUS_TRANSITION, result.message, undefined, { reason: result.reason, from: g.status, to: dto.status });
      }

      const data: Prisma.GoodUncheckedUpdateInput = { status: dto.status, updatedById: actor.id };
      const target = indexOfStatus(dto.status);
      const dateKey = STATUS_DATE_FIELD[dto.status];
      if (!g[dateKey]) data[dateKey] = today();
      if (target < indexOfStatus(g.status)) {
        // Moving back: later stages have not happened yet.
        for (const s of SHIPMENT_FLOW.slice(target + 1)) data[STATUS_DATE_FIELD[s]] = null;
      }

      await tx.good.update({ where: { id }, data });
      await tx.goodsStatusHistory.create({
        data: { goodId: id, fromStatus: g.status, toStatus: dto.status, isCorrection: result.isCorrection, note: dto.note ?? null, changedById: actor.id },
      });
      await this.audit.record(
        {
          entity: 'Good',
          entityId: id,
          action: result.isCorrection ? AuditAction.STATUS_CORRECTION : AuditAction.STATUS_CHANGE,
          actorId: actor.id,
          before: { status: g.status },
          after: { status: dto.status },
          note: dto.note ?? null,
          requestId,
        },
        tx,
      );
      return { data: toGoodView(await this.load(id, tx)), warnings: result.warnings };
    });
  }

  async setChinaCheckIn(id: string, dto: ChinaCheckInDto, actor: AuthUser, requestId?: string) {
    const g = await this.load(id);
    if (g.archivedAt) throw new AppException(ErrorCode.CONFLICT, 'This good is archived. Restore it before checking it in.');
    if (g.chinaCheckedIn === dto.checkedIn) return { data: toGoodView(g) };
    if (!dto.checkedIn && actor.role !== Role.ADMIN) {
      throw new AppException(ErrorCode.FORBIDDEN, 'Only an administrator can undo a China check-in');
    }

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.good.update({
        where: { id },
        data: {
          chinaCheckedIn: dto.checkedIn,
          chinaCheckedInAt: dto.checkedIn ? now : null,
          chinaCheckedInById: dto.checkedIn ? actor.id : null,
          ...(dto.checkedIn && !g.warehouseReceivedAt ? { warehouseReceivedAt: today() } : {}),
          updatedById: actor.id,
        },
      });
      await this.audit.record(
        { entity: 'Good', entityId: id, action: AuditAction.CHINA_CHECK_IN, actorId: actor.id, before: { chinaCheckedIn: g.chinaCheckedIn }, after: { chinaCheckedIn: dto.checkedIn }, note: dto.note ?? null, requestId },
        tx,
      );
    });
    return { data: toGoodView(await this.load(id)) };
  }

  // ───────────────────────── Archive / duplicate ─────────────────────────

  async setArchived(id: string, archived: boolean, dto: ArchiveGoodDto, actor: AuthUser, requestId?: string) {
    const g = await this.load(id);
    if (Boolean(g.archivedAt) === archived) return this.get(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.good.update({ where: { id }, data: { archivedAt: archived ? new Date() : null, updatedById: actor.id } });
      await this.audit.record({ entity: 'Good', entityId: id, action: archived ? AuditAction.ARCHIVE : AuditAction.RESTORE, actorId: actor.id, note: dto.reason ?? null, requestId }, tx);
    });
    return this.get(id);
  }

  /** Copies a good as a new order: same item, parcel, people and prices; status, check-in and stage dates start over. */
  async duplicate(id: string, actor: AuthUser, requestId?: string) {
    const src = await this.load(id);
    const pricing = await this.settings.getPricing();
    const plan = planFinancials(
      null,
      {
        quantity: src.quantity,
        unitCost: src.unitCost.toString(),
        exchangeRate: src.exchangeRate.toString(),
        sellingPrice: src.priceOverridden ? src.sellingPrice.toFixed(2) : undefined,
        overrideReason: src.overrideReason,
      },
      { exchangeRate: pricing.defaultExchangeRate, multiplier: src.priceMultiplier.toString() },
    );
    if (plan.errors.length) throw AppException.validation(plan.errors);
    const refErrors = await this.checkReferences({ clientId: src.clientId, supplierId: src.supplierId, categoryId: src.categoryId });
    if (refErrors.length) {
      throw new AppException(ErrorCode.CONFLICT, 'This good uses an archived client, supplier or category. Restore it, or create the good from scratch.', refErrors);
    }

    const newId = await this.prisma.$transaction(async (tx) => {
      const g = await tx.good.create({
        data: {
          itemName: src.itemName,
          trackingNumber: src.trackingNumber,
          retailPrice: src.retailPrice,
          notes: src.notes,
          ...plan.columns,
          ...(plan.columns.priceOverridden ? { overriddenById: actor.id, overriddenAt: new Date() } : {}),
          status: ShipmentStatus.ORDERED,
          orderedAt: today(),
          clientId: src.clientId,
          supplierId: src.supplierId,
          categoryId: src.categoryId,
          createdById: actor.id,
        },
      });
      await this.writeSnapshot(tx, g.id, plan, actor);
      await tx.goodsStatusHistory.create({ data: { goodId: g.id, toStatus: ShipmentStatus.ORDERED, changedById: actor.id, note: 'Duplicated' } });
      await this.audit.record({ entity: 'Good', entityId: g.id, action: AuditAction.DUPLICATE, actorId: actor.id, after: { sourceGoodId: id }, requestId }, tx);
      return g.id;
    });
    return this.get(newId);
  }

  // ───────────────────────── Helpers ─────────────────────────

  private async writeSnapshot(tx: Tx, goodId: string, plan: FinancialPlan, actor: AuthUser) {
    const c = plan.columns;
    await tx.goodFinancialSnapshot.create({
      data: {
        goodId,
        quantity: c.quantity,
        unitCost: c.unitCost,
        exchangeRate: c.exchangeRate,
        priceMultiplier: c.priceMultiplier,
        suggestedPrice: c.suggestedPrice,
        sellingPrice: c.sellingPrice,
        priceOverridden: c.priceOverridden,
        overrideReason: c.overrideReason,
        createdById: actor.id,
      },
    });
  }

  /** Each referenced client, supplier and category must exist and not be archived. */
  private async checkReferences(refs: { clientId?: string; supplierId?: string; categoryId?: string }): Promise<FieldError[]> {
    const select = { id: true, archivedAt: true } as const;
    const [client, supplier, category] = await Promise.all([
      refs.clientId ? this.prisma.client.findUnique({ where: { id: refs.clientId }, select }) : undefined,
      refs.supplierId ? this.prisma.supplier.findUnique({ where: { id: refs.supplierId }, select }) : undefined,
      refs.categoryId ? this.prisma.category.findUnique({ where: { id: refs.categoryId }, select }) : undefined,
    ]);
    const errors: FieldError[] = [];
    const check = (field: string, label: string, given: string | undefined, row: { archivedAt: Date | null } | null | undefined) => {
      if (!given) return;
      if (!row) errors.push({ field, code: 'not_found', message: `That ${label} no longer exists` });
      else if (row.archivedAt) errors.push({ field, code: 'archived', message: `That ${label} is archived` });
    };
    check('clientId', 'client', refs.clientId, client);
    check('supplierId', 'supplier', refs.supplierId, supplier);
    check('categoryId', 'category', refs.categoryId, category);
    return errors;
  }

  private checkSold(quantity: number, sold: number): FieldError[] {
    return sold > quantity ? [{ field: 'quantitySold', code: 'max', message: `quantitySold cannot be more than the quantity (${quantity})` }] : [];
  }
}
