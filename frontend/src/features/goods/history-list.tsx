'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { dateTime } from '@/lib/format';
import { STATUS_META } from '@/lib/status';
import type { AuditEntry, ShipmentStatus } from '@/lib/types';
import { useRequest } from '@/lib/use-request';
import { goodsApi } from './api';

const FIELD_LABEL: Record<string, string> = {
  itemName: 'Item name',
  trackingNumber: 'Tracking number',
  quantity: 'Quantity',
  quantitySold: 'Quantity sold',
  unitCost: 'Unit cost (¥)',
  exchangeRate: 'Rate',
  suggestedPrice: 'Suggested price',
  sellingPrice: 'Selling price',
  priceOverridden: 'Manual price',
  overrideReason: 'Price reason',
  retailPrice: 'Retail price',
  clientId: 'Client',
  supplierId: 'Supplier',
  categoryId: 'Category',
  notes: 'Notes',
  orderedAt: 'Ordered on',
  supplierReceivedAt: 'At supplier on',
  warehouseReceivedAt: 'At warehouse on',
  departedAt: 'Departed on',
  arrivedAt: 'Arrived on',
  deliveredAt: 'Delivered on',
};

const show = (v: unknown) => (v === null || v === undefined || v === '' ? 'empty' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));

function describe(e: AuditEntry): { title: string; lines: string[] } {
  const b = e.before ?? {};
  const a = e.after ?? {};
  switch (e.action) {
    case 'CREATE':
      return { title: 'Recorded', lines: [] };
    case 'DUPLICATE':
      return { title: 'Created as a copy of another good', lines: [] };
    case 'STATUS_CHANGE':
      return { title: `Moved to ${STATUS_META[a.status as ShipmentStatus]?.label ?? a.status}`, lines: [] };
    case 'STATUS_CORRECTION':
      return { title: `Status corrected from ${STATUS_META[b.status as ShipmentStatus]?.label} to ${STATUS_META[a.status as ShipmentStatus]?.label}`, lines: [] };
    case 'CHINA_CHECK_IN':
      return { title: a.chinaCheckedIn ? 'Checked in at the China warehouse' : 'China check-in removed', lines: [] };
    case 'PRICE_OVERRIDE':
      return a.priceOverridden === false
        ? { title: 'Returned to the suggested price', lines: [] }
        : { title: `Selling price set to GHS ${a.sellingPrice}`, lines: [] };
    case 'ARCHIVE':
      return { title: 'Archived', lines: [] };
    case 'RESTORE':
      return { title: 'Restored', lines: [] };
    case 'UPDATE':
      return {
        title: 'Edited',
        lines: Object.keys(a).map((k) =>
          k.endsWith('Id') ? `${FIELD_LABEL[k] ?? k} changed` : `${FIELD_LABEL[k] ?? k}: ${show(b[k])} to ${show(a[k])}`,
        ),
      };
    default:
      return { title: e.action, lines: [] };
  }
}

/** Every recorded change to a good, newest first. */
export function HistoryList({ goodId, version }: { goodId: string; version: string }) {
  const { data, error, loading, reload } = useRequest(() => goodsApi.history(goodId), [goodId, version]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data)
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );

  return (
    <ol className="flex flex-col">
      {data?.map((e) => {
        const d = describe(e);
        return (
          <li key={e.id} className="border-b border-line-soft py-2.5 text-[13px] last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{d.title}</p>
              <time className="text-xs whitespace-nowrap text-ink-3" dateTime={e.createdAt}>
                {dateTime(e.createdAt)}
              </time>
            </div>
            <p className="text-xs text-ink-3">{e.actor?.name ?? 'System'}</p>
            {d.lines.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-ink-2">
                {d.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            {e.note && <p className="mt-1 text-xs text-ink-2">“{e.note}”</p>}
          </li>
        );
      })}
    </ol>
  );
}
