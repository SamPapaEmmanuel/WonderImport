import Decimal from 'decimal.js';
import { AuditAction } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { AuditService, changedFields, toAuditJson } from './audit.service';

describe('audit', () => {
  it('records an entry on the transaction client when one is given', async () => {
    const root = { auditLog: { create: jest.fn() } };
    const tx = { auditLog: { create: jest.fn().mockResolvedValue({ id: 'a1' }) } };
    const service = new AuditService(root as never);

    await service.record(
      { entity: 'Good', entityId: 'g1', action: AuditAction.PRICE_OVERRIDE, actorId: 'u1', before: { sellingPrice: new Decimal('11.32') }, after: { sellingPrice: new Decimal('15') }, note: 'Market price' },
      tx as never,
    );

    expect(root.auditLog.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: 'Good',
        entityId: 'g1',
        action: 'PRICE_OVERRIDE',
        actorId: 'u1',
        before: { sellingPrice: '11.32' },
        after: { sellingPrice: '15' },
        note: 'Market price',
      }),
    });
  });

  it('stores missing before/after as database NULL', () => {
    expect(toAuditJson(undefined)).toBe(Prisma.DbNull);
  });

  it('serialises dates as ISO strings', () => {
    expect(toAuditJson({ at: new Date('2026-06-02T00:00:00Z') })).toEqual({ at: '2026-06-02T00:00:00.000Z' });
  });

  it('keeps only changed fields', () => {
    const r = changedFields(
      { status: 'ORDERED', quantity: 2, sellingPrice: new Decimal('10.00'), updatedAt: 1 },
      { status: 'AT_SUPPLIER', quantity: 2, sellingPrice: new Decimal('10.00'), updatedAt: 2 },
    );
    expect(r).toEqual({ before: { status: 'ORDERED' }, after: { status: 'AT_SUPPLIER' }, changed: ['status'] });
  });
});
