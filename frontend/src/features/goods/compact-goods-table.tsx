'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { CheckInBadge, StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { cny, count, ghs } from '@/lib/format';
import type { Good } from '@/lib/types';

/** Read-only goods table in the spreadsheet's column order. Rows open the good in the Goods workspace. */
export function CompactGoodsTable({ rows, loading, empty, showClient = true }: { rows: Good[]; loading?: boolean; empty?: ReactNode; showClient?: boolean }) {
  const router = useRouter();
  const columns: Column<Good>[] = [
    {
      key: 'item',
      header: 'Product and delivery ID',
      cell: (g) => (
        <div className="max-w-[230px]">
          <p className="truncate font-medium" title={g.itemName}>
            {g.itemName}
          </p>
          <p className="truncate text-xs text-ink-3">
            <span className="font-mono text-[11.5px]">{g.trackingNumber ?? 'No tracking number'}</span>
            {showClient && <span className="ml-2">{g.client.isStock ? 'Stock' : g.client.name}</span>}
          </p>
        </div>
      ),
    },
    { key: 'qty', header: 'Qty', align: 'right', cell: (g) => <span title={`${count(g.itemsLeft)} left`}>{count(g.quantity)}{g.itemsLeft < g.quantity && <span className="text-ink-3"> / {count(g.itemsLeft)} left</span>}</span> },
    { key: 'unit', header: 'Unit cost', align: 'right', cell: (g) => cny(g.unitCost) },
    { key: 'landed', header: 'Landed', align: 'right', cell: (g) => ghs(g.totalCost, { symbol: false }) },
    {
      key: 'price',
      header: 'Price / unit',
      align: 'right',
      cell: (g) => (
        <>
          {ghs(g.sellingPrice, { symbol: false })}
          {g.priceOverridden && <span className="ml-1 rounded bg-glacier px-1 text-[10.5px] font-semibold text-tide" title="Set manually">M</span>}
        </>
      ),
    },
    {
      key: 'profit',
      header: 'Profit',
      align: 'right',
      cell: (g) => <span className={Number(g.profit) < 0 ? 'text-rose' : 'text-mint'}>{ghs(g.profit, { symbol: false })}</span>,
    },
    { key: 'status', header: 'Status', cell: (g) => <StatusBadge status={g.status} /> },
    { key: 'checkin', header: 'Check-in', cell: (g) => <CheckInBadge checkedIn={g.chinaCheckedIn} status={g.status} /> },
  ];
  return (
    <DataTable
      caption="Goods"
      columns={columns}
      rows={rows}
      rowKey={(g) => g.id}
      loading={loading}
      skeletonRows={6}
      onRowClick={() => router.push('/goods')}
      empty={empty}
    />
  );
}
