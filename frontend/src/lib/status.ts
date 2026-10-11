import type { ShipmentStatus } from './types';

export const SHIPMENT_FLOW: ShipmentStatus[] = ['ORDERED', 'AT_SUPPLIER', 'CHINA_WAREHOUSE', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'];

export const STATUS_META: Record<ShipmentStatus, { label: string; color: string }> = {
  ORDERED: { label: 'Ordered', color: 'var(--st-ordered)' },
  AT_SUPPLIER: { label: 'At supplier', color: 'var(--st-supplier)' },
  CHINA_WAREHOUSE: { label: 'China warehouse', color: 'var(--st-china)' },
  IN_TRANSIT: { label: 'In transit', color: 'var(--st-transit)' },
  ARRIVED: { label: 'Arrived', color: 'var(--st-arrived)' },
  DELIVERED: { label: 'Delivered', color: 'var(--st-delivered)' },
};

export function nextStatus(s: ShipmentStatus): ShipmentStatus | null {
  const i = SHIPMENT_FLOW.indexOf(s);
  return i < SHIPMENT_FLOW.length - 1 ? SHIPMENT_FLOW[i + 1] : null;
}

/** Stages at which the China warehouse check-in should already have happened. */
export const CHECK_IN_EXPECTED: ShipmentStatus[] = ['CHINA_WAREHOUSE', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'];

export const STAGE_DATE_KEY = {
  ORDERED: 'orderedAt',
  AT_SUPPLIER: 'supplierReceivedAt',
  CHINA_WAREHOUSE: 'warehouseReceivedAt',
  IN_TRANSIT: 'departedAt',
  ARRIVED: 'arrivedAt',
  DELIVERED: 'deliveredAt',
} as const satisfies Record<ShipmentStatus, string>;
