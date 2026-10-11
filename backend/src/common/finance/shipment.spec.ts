import { ShipmentStatus as S } from '../../generated/prisma/enums';
import { checkTransition, nextStatus } from './shipment';

describe('shipment state rules', () => {
  const ctx = { chinaCheckedIn: true };

  it('moves forward one stage at a time', () => {
    expect(checkTransition(S.ORDERED, S.AT_SUPPLIER, ctx)).toEqual({ ok: true, isCorrection: false, warnings: [] });
    expect(nextStatus(S.ARRIVED)).toBe(S.DELIVERED);
    expect(nextStatus(S.DELIVERED)).toBeNull();
  });

  it('rejects skipping stages', () => {
    const r = checkTransition(S.ORDERED, S.IN_TRANSIT, ctx);
    expect(r).toMatchObject({ ok: false, reason: 'SKIPS_STAGES' });
  });

  it('rejects a no-op', () => {
    expect(checkTransition(S.ARRIVED, S.ARRIVED, ctx)).toMatchObject({ ok: false, reason: 'SAME_STATUS' });
  });

  it('warns when leaving China warehouse without a check-in', () => {
    expect(checkTransition(S.CHINA_WAREHOUSE, S.IN_TRANSIT, { chinaCheckedIn: false })).toEqual({
      ok: true,
      isCorrection: false,
      warnings: ['CHINA_CHECK_IN_PENDING'],
    });
  });

  it('treats Delivered as terminal for staff', () => {
    expect(checkTransition(S.DELIVERED, S.ARRIVED, { ...ctx, isAdmin: false, reason: 'Wrong parcel' })).toMatchObject({
      ok: false,
      reason: 'CORRECTION_NEEDS_ADMIN',
    });
  });

  it('lets an admin reopen with a reason, marked as a correction', () => {
    expect(checkTransition(S.DELIVERED, S.ARRIVED, { ...ctx, isAdmin: true, reason: 'Client returned it' })).toEqual({
      ok: true,
      isCorrection: true,
      warnings: [],
    });
  });

  it('requires a reason for corrections', () => {
    expect(checkTransition(S.IN_TRANSIT, S.ORDERED, { ...ctx, isAdmin: true, reason: '' })).toMatchObject({
      ok: false,
      reason: 'CORRECTION_NEEDS_REASON',
    });
  });

  it('lets an admin jump forward as an explicit correction', () => {
    expect(checkTransition(S.ORDERED, S.ARRIVED, { ...ctx, isAdmin: true, correction: true, reason: 'Missed updates' })).toMatchObject({
      ok: true,
      isCorrection: true,
    });
  });
});
