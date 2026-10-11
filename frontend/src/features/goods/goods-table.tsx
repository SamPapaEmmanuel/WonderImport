'use client';

import type { ReactNode } from 'react';
import { DataTable, type Column, type SortState } from '@/components/ui/data-table';
import { cn } from '@/lib/cn';
import { cny, count, date, ghs, percent } from '@/lib/format';
import type { Good } from '@/lib/types';
import { CheckInCell } from './check-in-cell';
import { RowActions } from './row-actions';
import { StatusCell } from './status-cell';

interface GoodsTableProps {
  rows: Good[];
  loading: boolean;
  editable: boolean;
  sort: SortState;
  onSortChange: (s: SortState) => void;
  onOpen: (g: Good) => void;
  onEdit: (g: Good) => void;
  onAdvance: (g: Good) => void;
  onCheckIn: (g: Good) => void;
  onDuplicate: (g: Good) => void;
  onArchive: (g: Good) => void;
  onRestore: (g: Good) => void;
  empty: ReactNode;
}

const signed = (v: string) => (Number(v) < 0 ? 'text-rose' : Number(v) > 0 ? 'text-mint' : 'text-ink-2');

export function GoodsTable(p: GoodsTableProps) {
  const columns: Column<Good>[] = [
    {
      key: 'item',
      header: 'Product',
      sortKey: 'itemName',
      cell: (g) => (
        <div className="max-w-[260px] min-w-[180px]">
          <p className="truncate font-medium" title={g.itemName}>
            {g.itemName}
          </p>
          <p className="truncate text-xs text-ink-3">
            {g.trackingNumber ? <span className="font-mono text-[11.5px]">{g.trackingNumber}</span> : 'No tracking number'}
            <span className="ml-2">{g.category.name}</span>
          </p>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      sortKey: 'client',
      cell: (g) => <span className={cn(g.client.isStock && 'text-ink-3')}>{g.client.isStock ? 'Stock' : g.client.name}</span>,
    },
    { key: 'qty', header: 'Qty', sortKey: 'quantity', align: 'right', cell: (g) => count(g.quantity) },
    { key: 'unit', header: 'Unit cost', align: 'right', cell: (g) => cny(g.unitCost) },
    { key: 'landed', header: 'Landed', sortKey: 'totalCost', align: 'right', cell: (g) => ghs(g.totalCost, { symbol: false }) },
    {
      key: 'price',
      header: 'Price / unit',
      align: 'right',
      cell: (g) => (
        <span title={g.priceOverridden ? `Set manually. Suggested ${ghs(g.suggestedPrice)}` : 'Suggested price (cost × rate × 3)'}>
          {ghs(g.sellingPrice, { symbol: false })}
          {g.priceOverridden && <span className="ml-1 rounded bg-glacier px-1 text-[10.5px] font-semibold text-tide">M</span>}
        </span>
      ),
    },
    { key: 'profit', header: 'Profit', sortKey: 'profit', align: 'right', cell: (g) => <span className={signed(g.profit)}>{ghs(g.profit, { symbol: false })}</span> },
    { key: 'margin', header: 'Margin', sortKey: 'margin', align: 'right', cell: (g) => <span className="text-ink-2">{percent(g.margin)}</span> },
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      cell: (g) => <StatusCell good={g} editable={p.editable} onAdvance={p.onAdvance} onOpen={p.onOpen} />,
    },
    { key: 'checkin', header: 'Check-in', cell: (g) => <CheckInCell good={g} editable={p.editable} onCheckIn={p.onCheckIn} /> },
    { key: 'ordered', header: 'Ordered', sortKey: 'orderedAt', cell: (g) => <span className="text-ink-2">{date(g.dates.orderedAt)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-10 pr-2',
      cell: (g) => (
        <RowActions good={g} editable={p.editable} onView={p.onOpen} onEdit={p.onEdit} onDuplicate={p.onDuplicate} onArchive={p.onArchive} onRestore={p.onRestore} />
      ),
    },
  ];

  return (
    <DataTable
      caption="Goods"
      columns={columns}
      rows={p.rows}
      rowKey={(g) => g.id}
      loading={p.loading}
      sort={p.sort}
      onSortChange={p.onSortChange}
      onRowClick={p.onOpen}
      rowClassName={(g) => (g.archivedAt ? 'text-ink-3' : undefined)}
      empty={p.empty}
    />
  );
}
