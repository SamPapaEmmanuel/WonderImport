import Decimal from 'decimal.js';
import { Role, ShipmentStatus } from '../../generated/prisma/enums';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { GoodsService } from './goods.service';

const staff: AuthUser = { id: 'u-staff', authId: 'a1', email: 's@x.com', name: 'Staff', role: Role.STAFF };
const admin: AuthUser = { ...staff, id: 'u-admin', role: Role.ADMIN };

function fixture(over: Record<string, unknown> = {}) {
  const d = (v: string) => new Decimal(v);
  return {
    id: 'g1', itemName: 'Mini Fan', trackingNumber: 'YT1', quantity: 2, quantitySold: 0,
    unitCost: d('4'), exchangeRate: d('1.887'), priceMultiplier: d('3'), suggestedPrice: d('22.64'), sellingPrice: d('25'),
    priceOverridden: true, overrideReason: 'Market', overriddenAt: null, overriddenBy: null, overriddenById: null, retailPrice: null,
    totalCost: d('15.10'), expectedRevenue: d('50'), profit: d('34.90'), margin: d('69.80'),
    status: ShipmentStatus.CHINA_WAREHOUSE, chinaCheckedIn: false, chinaCheckedInAt: null, checkedInBy: null, chinaCheckedInById: null,
    orderedAt: new Date('2026-06-01'), supplierReceivedAt: null, warehouseReceivedAt: new Date('2026-06-10'), departedAt: null, arrivedAt: null, deliveredAt: null,
    notes: null, clientId: 'c1', supplierId: 's1', categoryId: 'k1',
    client: { id: 'c1', code: 'CL-001', name: 'Cons', isStock: false }, supplier: { id: 's1', name: '1688' }, category: { id: 'k1', name: 'Electronics' },
    archivedAt: null, createdAt: new Date(), createdBy: { id: 'u', name: 'U' }, createdById: 'u', updatedAt: new Date(), updatedBy: null, updatedById: null,
    statusHistory: [], snapshots: [], allocations: [],
    ...over,
  };
}

function setup(row = fixture()) {
  let current = { ...row };
  const allocations: { id: string; goodId: string; clientId: string; quantity: number; sellingPrice: string | null; note: string | null; client: unknown; createdBy: unknown; createdAt: Date }[] = [];
  const tx = {
    $queryRaw: jest.fn(async () => [{ id: current.id, quantity: current.quantity, quantitySold: current.quantitySold }]),
    good: {
      findUnique: jest.fn(async () => current),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        current = { ...current, ...data };
        return current;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...current, id: 'g-new', clientId: data.clientId })),
    },
    client: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'c-archived' ? { id: where.id, name: 'Old', archivedAt: new Date() } : { id: where.id, name: 'Buyer', archivedAt: null },
      ),
      findMany: jest.fn(async ({ where }: { where?: { id?: { in?: string[] } } }) => {
        const ids = where?.id?.in ?? [];
        return ids.map((id: string) => (id === 'c-archived' ? { id, name: 'Old', archivedAt: new Date() } : { id, name: 'Buyer', archivedAt: null }));
      }),
    },
    goodAllocation: {
      aggregate: jest.fn(async () => ({ _sum: { quantity: allocations.reduce((n, a) => n + a.quantity, 0) } })),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created = {
          id: 'a1', goodId: 'g1', clientId: data.clientId, quantity: data.quantity, sellingPrice: data.sellingPrice ?? null, note: data.note ?? null,
          client: { id: data.clientId, code: 'CL-002', name: 'Buyer', isStock: false }, createdBy: { id: 'u-staff', name: 'Staff' }, createdAt: new Date(),
        };
        allocations.push(created as never);
        return created;
      }),
      findMany: jest.fn(async () => allocations),
    },
    goodsStatusHistory: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    goodFinancialSnapshot: { create: jest.fn() },
  };
  const prisma = {
    ...tx,
    good: {
      ...tx.good,
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...fixture(), ...data, id: 'g-new' })),
      // Reads outside the transaction (the allocate return path) need the
      // full detail shape: toGoodDetailView maps statusHistory + snapshots.
      findUnique: jest.fn(async ({ include }: { include?: Record<string, unknown> }) =>
        include ? { ...current, allocations } : current,
      ),
    },
    client: {
      ...tx.client,
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'c-archived' ? { id: where.id, name: 'Old', archivedAt: new Date() } : { id: where.id, name: 'Buyer', archivedAt: null },
      ),
    },
    supplier: { findUnique: jest.fn(async () => ({ id: 's1', archivedAt: null })) },
    category: { findUnique: jest.fn(async () => ({ id: 'k1', archivedAt: null })) },
    goodAllocation: { ...tx.goodAllocation, findMany: jest.fn(async () => allocations) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const audit = new AuditService(prisma as never);
  const service = new GoodsService(prisma as never, audit, { getPricing: async () => ({ defaultExchangeRate: '1.887', priceMultiplier: '3' }) } as never);
  return { service, tx, current: () => current };
}

describe('GoodsService shipment operations', () => {
  it('advances one stage, stamps the stage date, writes history and audit, and warns about a missing check-in', async () => {
    const { service, tx, current } = setup();
    const res = await service.changeStatus('g1', { status: ShipmentStatus.IN_TRANSIT, expectedStatus: ShipmentStatus.CHINA_WAREHOUSE }, staff, 'r1');

    expect(res.warnings).toEqual(['CHINA_CHECK_IN_PENDING']);
    expect(res.data.status).toBe('IN_TRANSIT');
    expect(current().departedAt).toBeInstanceOf(Date);
    expect(tx.goodsStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fromStatus: 'CHINA_WAREHOUSE', toStatus: 'IN_TRANSIT', isCorrection: false, changedById: 'u-staff' }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'STATUS_CHANGE', requestId: 'r1' }) });
  });

  it('rejects a stale update instead of advancing twice', async () => {
    const { service, tx } = setup();
    await expect(service.changeStatus('g1', { status: ShipmentStatus.ARRIVED, expectedStatus: ShipmentStatus.IN_TRANSIT }, staff)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(tx.good.update).not.toHaveBeenCalled();
  });

  it('blocks staff from moving backwards', async () => {
    const { service } = setup();
    await expect(service.changeStatus('g1', { status: ShipmentStatus.ORDERED, note: 'Wrong parcel' }, staff)).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });

  it('lets an admin correct backwards, clearing later stage dates', async () => {
    const { service, tx, current } = setup(fixture({ status: ShipmentStatus.ARRIVED, departedAt: new Date(), arrivedAt: new Date() }));
    await service.changeStatus('g1', { status: ShipmentStatus.CHINA_WAREHOUSE, note: 'Parcel never left' }, admin);
    expect(current()).toMatchObject({ status: 'CHINA_WAREHOUSE', departedAt: null, arrivedAt: null, deliveredAt: null });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'STATUS_CORRECTION', note: 'Parcel never left' }) });
  });

  it('records a China check-in with actor and time', async () => {
    const { service, tx, current } = setup();
    await service.setChinaCheckIn('g1', { checkedIn: true }, staff);
    expect(current()).toMatchObject({ chinaCheckedIn: true, chinaCheckedInById: 'u-staff' });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'CHINA_CHECK_IN' }) });
  });

  it('only lets an admin undo a check-in', async () => {
    const { service } = setup(fixture({ chinaCheckedIn: true }));
    await expect(service.setChinaCheckIn('g1', { checkedIn: false }, staff)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('GoodsService split sales (multi-client purchase)', () => {
  it('sells units to a second buyer while keeping the first, and reports itemsLeft', async () => {
    const { service, tx } = setup(fixture({ quantity: 10, quantitySold: 0 }));
    const first = await service.allocate('g1', { clientId: 'c-ama', quantity: 6 }, staff, 'r1');
    expect(first.itemsLeft).toBe(4);
    expect(first.allocation).toMatchObject({ quantity: 6, priceInherited: true });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ note: 'Sold 6 to Buyer', requestId: 'r1' }) });

    const second = await service.allocate('g1', { clientId: 'c-kojo', quantity: 4 }, staff, 'r2');
    expect(second.itemsLeft).toBe(0);
    expect(tx.goodAllocation.create).toHaveBeenCalledTimes(2);
  });

  it('rejects an oversell with CONFLICT and the fresh itemsLeft', async () => {
    const { service } = setup(fixture({ quantity: 10, quantitySold: 0 }));
    await service.allocate('g1', { clientId: 'c-ama', quantity: 8 }, staff);
    const err = await service.allocate('g1', { clientId: 'c-kojo', quantity: 5 }, staff).catch((e) => e);
    expect(err.code).toBe('CONFLICT');
    expect(err.details).toEqual({ itemsLeft: 2 });
  });

  it('rejects an archived buyer', async () => {
    const { service } = setup();
    await expect(service.allocate('g1', { clientId: 'c-archived', quantity: 1 }, staff)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('lists every buyer with the remaining count', async () => {
    const { service } = setup(fixture({ quantity: 10, quantitySold: 0 }));
    await service.allocate('g1', { clientId: 'c-ama', quantity: 6 }, staff);
    await service.allocate('g1', { clientId: 'c-kojo', quantity: 3 }, staff);
    const res = await service.allocations('g1');
    expect(res.meta).toEqual({ quantity: 10, legacySold: 0, allocated: 9, itemsLeft: 1 });
    expect(res.data.map((a) => a.quantity)).toEqual([6, 3]);
  });
});

describe('GoodsService create with one-step allocations', () => {
  it('creates one lot under Stock and gives each buyer their share', async () => {
    const { service, tx } = setup(fixture({ quantity: 10, quantitySold: 0, clientId: 'c-stock' }));
    const dto = {
      itemName: 'Mini Fan',
      trackingNumber: 'YT1',
      quantity: 10,
      quantitySold: 0,
      unitCost: '4',
      exchangeRate: '1.887',
      clientId: 'c-stock',
      supplierId: 's1',
      categoryId: 'k1',
      allocations: [
        { clientId: 'c-ama', quantity: 6 },
        { clientId: 'c-kojo', quantity: 4 },
      ],
    };
    const res = await service.create(dto, staff, 'r1');
    expect(tx.good.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientId: 'c-stock' }) }),
    );
    expect(tx.goodAllocation.create).toHaveBeenCalledTimes(2);
    expect(tx.goodAllocation.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ clientId: 'c-ama', quantity: 6 }) }),
    );
    expect(tx.goodAllocation.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ clientId: 'c-kojo', quantity: 4 }) }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ note: 'Sold 6 to Buyer at recording', requestId: 'r1' }) }),
    );
    expect(res.allocated).toBe(10);
    expect(res.itemsLeft).toBe(0);
    expect(res.buyers.map((b) => b.name)).toEqual(expect.arrayContaining(['Buyer', 'Buyer']));
  });

  it('rejects duplicate buyers in allocations', async () => {
    const { service } = setup(fixture({ quantity: 10 }));
    const dto = {
      itemName: 'X',
      quantity: 10,
      quantitySold: 0,
      unitCost: '4',
      exchangeRate: '1.887',
      clientId: 'c-stock',
      supplierId: 's1',
      categoryId: 'k1',
      allocations: [
        { clientId: 'c-ama', quantity: 4 },
        { clientId: 'c-ama', quantity: 4 },
      ],
    };
    await expect(service.create(dto, staff)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('rejects allocations that exceed quantity', async () => {
    const { service } = setup(fixture({ quantity: 10 }));
    const dto = {
      itemName: 'X',
      quantity: 10,
      quantitySold: 0,
      unitCost: '4',
      exchangeRate: '1.887',
      clientId: 'c-stock',
      supplierId: 's1',
      categoryId: 'k1',
      allocations: [
        { clientId: 'c-ama', quantity: 6 },
        { clientId: 'c-kojo', quantity: 5 },
      ],
    };
    await expect(service.create(dto, staff)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('rejects an archived buyer in allocations', async () => {
    const { service } = setup(fixture({ quantity: 10 }));
    const dto = {
      itemName: 'X',
      quantity: 10,
      quantitySold: 0,
      unitCost: '4',
      exchangeRate: '1.887',
      clientId: 'c-stock',
      supplierId: 's1',
      categoryId: 'k1',
      allocations: [{ clientId: 'c-archived', quantity: 6 }],
    };
    await expect(service.create(dto, staff)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
