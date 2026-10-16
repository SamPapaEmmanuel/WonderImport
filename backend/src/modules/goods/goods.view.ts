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

/**
 * Slim include for list/table views: only what GoodsTable and
 * CompactGoodsTable render (names + check-in tooltip name). Drops 3 user
 * joins per row vs goodInclude; detail drawer fetches the full shape.
 */
export const goodListInclude = {
  client: { select: { id: true, code: true, name: true, isStock: true } },
  supplier: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  checkedInBy: person,
  allocations: { select: { id: true, quantity: true, clientId: true, client: { select: { id: true, code: true, name: true, isStock: true } } } },
} satisfies Prisma.GoodInclude;

export const goodDetailInclude = {
  ...goodInclude,
  statusHistory: { orderBy: { changedAt: 'asc' }, include: { changedBy: person } },
  snapshots: { orderBy: { createdAt: 'desc' }, take: 10, include: { createdBy: person } },
  allocations: {
    orderBy: { createdAt: 'asc' },
    include: { client: { select: { id: true, code: true, name: true, isStock: true } }, createdBy: person },
  },
} satisfies Prisma.GoodInclude;

export type GoodRow = Prisma.GoodGetPayload<{ include: typeof goodInclude }>;
export type GoodDetailRow = Prisma.GoodGetPayload<{ include: typeof goodDetailInclude }>;
export type GoodListRow = Prisma.GoodGetPayload<{ include: typeof goodListInclude }>;

const money = (d: Prisma.Decimal) => d.toFixed(2);
const iso = (d: Date | null) => d?.toISOString() ?? null;

/** API shape for a good. Decimals are strings; dates are YYYY-MM-DD (stage dates) or ISO timestamps. */
export function toGoodView(g: GoodRow | GoodListRow) {
  // List rows skip 3 user joins; the wire shape stays identical (nulls).
  const overriddenBy = 'overriddenBy' in g ? g.overriddenBy : null;
  const createdBy = 'createdBy' in g ? g.createdBy : null;
  const updatedBy = 'updatedBy' in g ? g.updatedBy : null;
  const allocations = ('allocations' in g && Array.isArray(g.allocations) ? g.allocations : []).map((a) => ({
    id: a.id,
    quantity: a.quantity,
    sellingPrice: 'sellingPrice' in a && a.sellingPrice != null ? a.sellingPrice.toString() : null,
    note: 'note' in a ? (a.note as string | null) : null,
    client: a.client,
    createdBy: 'createdBy' in a ? (a.createdBy as { id: string; name: string } | null) : null,
    createdAt: 'createdAt' in a && a.createdAt instanceof Date ? (a.createdAt as Date).toISOString() : null,
  }));
  const allocatedQty = allocations.reduce((n, a) => n + a.quantity, 0);
  return {
    id: g.id,
    itemName: g.itemName,
    trackingNumber: g.trackingNumber,
    quantity: g.quantity,
    quantitySold: g.quantitySold,
    allocated: allocatedQty,
    itemsLeft: Math.max(0, g.quantity - g.quantitySold - allocatedQty),
    allocations,
    buyers: allocations.map((a) => a.client),
    unitCost: g.unitCost.toString(),
    exchangeRate: g.exchangeRate.toString(),
    priceMultiplier: g.priceMultiplier.toString(),
    suggestedPrice: money(g.suggestedPrice),
    sellingPrice: money(g.sellingPrice),
    priceOverridden: g.priceOverridden,
    overrideReason: g.overrideReason,
    overriddenAt: iso(g.overriddenAt),
    overriddenBy,
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
    createdBy,
    updatedAt: g.updatedAt.toISOString(),
    updatedBy,
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
