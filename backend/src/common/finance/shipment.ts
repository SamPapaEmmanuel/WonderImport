import { ShipmentStatus } from '../../generated/prisma/enums';

/** The shipping pipeline, in order. */
export const SHIPMENT_FLOW: readonly ShipmentStatus[] = [
  ShipmentStatus.ORDERED,
  ShipmentStatus.AT_SUPPLIER,
  ShipmentStatus.CHINA_WAREHOUSE,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ARRIVED,
  ShipmentStatus.DELIVERED,
];

export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  ORDERED: 'Ordered',
  AT_SUPPLIER: 'At supplier',
  CHINA_WAREHOUSE: 'China warehouse',
  IN_TRANSIT: 'In transit',
  ARRIVED: 'Arrived',
  DELIVERED: 'Delivered',
};

/** Which stage-date column a status sets when a good reaches it. */
export const STATUS_DATE_FIELD = {
  ORDERED: 'orderedAt',
  AT_SUPPLIER: 'supplierReceivedAt',
  CHINA_WAREHOUSE: 'warehouseReceivedAt',
  IN_TRANSIT: 'departedAt',
  ARRIVED: 'arrivedAt',
  DELIVERED: 'deliveredAt',
} as const satisfies Record<ShipmentStatus, string>;

export const indexOfStatus = (s: ShipmentStatus) => SHIPMENT_FLOW.indexOf(s);

export function nextStatus(s: ShipmentStatus): ShipmentStatus | null {
  const i = indexOfStatus(s);
  return i < SHIPMENT_FLOW.length - 1 ? SHIPMENT_FLOW[i + 1] : null;
}

export type TransitionWarning = 'CHINA_CHECK_IN_PENDING';
export type TransitionRejection = 'SAME_STATUS' | 'SKIPS_STAGES' | 'BACKWARD_NEEDS_CORRECTION' | 'CORRECTION_NEEDS_ADMIN' | 'CORRECTION_NEEDS_REASON';

export type TransitionResult =
  | { ok: true; isCorrection: boolean; warnings: TransitionWarning[] }
  | { ok: false; reason: TransitionRejection; message: string };

export interface TransitionContext {
  chinaCheckedIn: boolean;
  /** Caller asked to correct/reopen an earlier stage. */
  correction?: boolean;
  isAdmin?: boolean;
  reason?: string | null;
}

/**
 * Shipment state rules (docs §4 of the build plan):
 * - forward moves are one stage at a time;
 * - moving backwards (including reopening Delivered) is an admin correction with a reason;
 * - leaving China warehouse without a check-in is allowed but warned.
 */
export function checkTransition(from: ShipmentStatus, to: ShipmentStatus, ctx: TransitionContext): TransitionResult {
  const a = indexOfStatus(from);
  const b = indexOfStatus(to);

  if (a === b) return { ok: false, reason: 'SAME_STATUS', message: `The good is already ${STATUS_LABEL[to]}` };

  if (b < a || ctx.correction) {
    if (!ctx.isAdmin) return { ok: false, reason: 'CORRECTION_NEEDS_ADMIN', message: 'Only an administrator can correct an earlier shipment stage' };
    if (!ctx.reason || ctx.reason.trim().length < 3) return { ok: false, reason: 'CORRECTION_NEEDS_REASON', message: 'Give a reason for the correction' };
    if (b > a && b - a > 1) {
      // Corrections may also jump forward (e.g. fixing a missed update) — allowed for admins.
      return { ok: true, isCorrection: true, warnings: [] };
    }
    if (b < a) return { ok: true, isCorrection: true, warnings: [] };
  }

  if (b - a > 1) {
    return {
      ok: false,
      reason: 'SKIPS_STAGES',
      message: `${STATUS_LABEL[from]} can only move to ${STATUS_LABEL[SHIPMENT_FLOW[a + 1]]}`,
    };
  }

  const warnings: TransitionWarning[] = [];
  if (from === ShipmentStatus.CHINA_WAREHOUSE && !ctx.chinaCheckedIn) warnings.push('CHINA_CHECK_IN_PENDING');
  return { ok: true, isCorrection: false, warnings };
}
