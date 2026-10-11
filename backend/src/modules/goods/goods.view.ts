import type { Prisma } from '../../generated/prisma/client';
import { toDateOnlyString } from '../../common/validation/decorators';

const person = { select: { id: true, name: true } } as const;

export const goodInclude = {
  client: { select: { id: true, code: true, name: true, isStock: true } },
  supplier: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  overriddenBy: person,
  checkedInBy: person,
  createdBy: person,
  updatedBy: person,
} satisfies Prisma.GoodInclude;

export const goodDetailInclude = {
  ...goodInclude,
  statusHistory: { orderBy: { changedAt: 'asc' }, include: { changedBy: person } },
  snapshots: { orderBy: { createdAt: 'desc' }, take: 10, include: { createdBy: person } },
} satisfies Prisma.GoodInclude;

export type GoodRow = Prisma.GoodGetPayload<{ include: typeof goodInclude }>;
export type GoodDetailRow = Prisma.GoodGetPayload<{ include: typeof goodDetailInclude }>;

const money = (d: Prisma.Decimal) => d.toFixed(2);
const iso = (d: Date | null) => d?.toISOString() ?? null;

/** API shape for a good. Decimals are strings; dates are YYYY-MM-DD (stage dates) or ISO timestamps. */
export function toGoodView(g: GoodRow) {
  return {
    id: g.id,
    itemName: g.itemName,
    trackingNumber: g.trackingNumber,
    quantity: g.quantity,
    quantitySold: g.quantitySold,
    itemsLeft: g.quantity - g.quantitySold,
    unitCost: g.unitCost.toString(),
    exchangeRate: g.exchangeRate.toString(),
    priceMultiplier: g.priceMultiplier.toString(),
    suggestedPrice: money(g.suggestedPrice),
    sellingPrice: money(g.sellingPrice),
    priceOverridden: g.priceOverridden,
    overrideReason: g.overrideReason,
    overriddenAt: iso(g.overriddenAt),
    overriddenBy: g.overriddenBy,
    retailPrice: g.retailPrice ? money(g.retailPrice) : null,
    totalCost: money(g.totalCost),
    expectedRevenue: money(g.expectedRevenue),
    profit: money(g.profit),
    margin: g.margin ? g.margin.toFixed(2) : null,
    status: g.status,
    chinaCheckedIn: g.chinaCheckedIn,
    chinaCheckedInAt: iso(g.chinaCheckedInAt),
    checkedInBy: g.checkedInBy,
    dates: {
      orderedAt: toDateOnlyString(g.orderedAt),
      supplierReceivedAt: toDateOnlyString(g.supplierReceivedAt),
      warehouseReceivedAt: toDateOnlyString(g.warehouseReceivedAt),
      departedAt: toDateOnlyString(g.departedAt),
      arrivedAt: toDateOnlyString(g.arrivedAt),
      deliveredAt: toDateOnlyString(g.deliveredAt),
    },
    notes: g.notes,
    client: g.client,
    supplier: g.supplier,
    category: g.category,
    archivedAt: iso(g.archivedAt),
    createdAt: g.createdAt.toISOString(),
    createdBy: g.createdBy,
    updatedAt: g.updatedAt.toISOString(),
    updatedBy: g.updatedBy,
  };
}

export function toGoodDetailView(g: GoodDetailRow) {
  return {
    ...toGoodView(g),
    statusHistory: g.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      isCorrection: h.isCorrection,
      note: h.note,
      changedAt: h.changedAt.toISOString(),
      changedBy: h.changedBy,
    })),
    snapshots: g.snapshots.map((s) => ({
      id: s.id,
      quantity: s.quantity,
      unitCost: s.unitCost.toString(),
      exchangeRate: s.exchangeRate.toString(),
      priceMultiplier: s.priceMultiplier.toString(),
      suggestedPrice: money(s.suggestedPrice),
      sellingPrice: money(s.sellingPrice),
      priceOverridden: s.priceOverridden,
      overrideReason: s.overrideReason,
      createdAt: s.createdAt.toISOString(),
      createdBy: s.createdBy,
    })),
  };
}

export type GoodView = ReturnType<typeof toGoodView>;

/** Fields compared for UPDATE audit entries. */
export function auditableGood(g: GoodRow) {
  const v = toGoodView(g);
  return {
    itemName: v.itemName,
    trackingNumber: v.trackingNumber,
    quantity: v.quantity,
    quantitySold: v.quantitySold,
    unitCost: v.unitCost,
    exchangeRate: v.exchangeRate,
    suggestedPrice: v.suggestedPrice,
    sellingPrice: v.sellingPrice,
    priceOverridden: v.priceOverridden,
    overrideReason: v.overrideReason,
    retailPrice: v.retailPrice,
    clientId: g.clientId,
    supplierId: g.supplierId,
    categoryId: g.categoryId,
    notes: v.notes,
    ...v.dates,
  };
}
