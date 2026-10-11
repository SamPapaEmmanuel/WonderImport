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
    ...over,
  };
}

function setup(row = fixture()) {
  let current = { ...row };
  const tx = {
    good: {
      findUnique: jest.fn(async () => current),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        current = { ...current, ...data };
        return current;
      }),
    },
    goodsStatusHistory: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = { ...tx, $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
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
