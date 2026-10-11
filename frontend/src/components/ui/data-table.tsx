'use client';

import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from './skeleton';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  /** API sort field; makes the header clickable. */
  sortKey?: string;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Rendered in place of the body when there are no rows. */
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  caption?: string;
  skeletonRows?: number;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
}

/** Dense data table: 40px rows, right-aligned numbers, sortable headers, horizontal scroll inside its own container. */
export function DataTable<T>({ columns, rows, rowKey, loading, empty, onRowClick, rowClassName, caption, skeletonRows = 8, sort, onSortChange }: DataTableProps<T>) {
  const alignCls = (c: Column<T>) => (c.align === 'right' ? 'text-right' : 'text-left');

  function header(c: Column<T>) {
    if (!c.sortKey || !onSortChange) return c.header;
    const active = sort?.key === c.sortKey;
    const Icon = !active ? ArrowUpDown : sort!.dir === 'asc' ? ArrowUp : ArrowDown;
    const nextDir = active && sort!.dir === 'desc' ? 'asc' : 'desc';
    return (
      <button
        type="button"
        onClick={() => onSortChange({ key: c.sortKey!, dir: nextDir })}
        className={cn('inline-flex items-center gap-1 rounded hover:text-ink', c.align === 'right' && 'flex-row-reverse', active && 'text-ink')}
      >
        {c.header}
        <Icon className={cn('size-3.5', !active && 'opacity-40')} aria-hidden />
      </button>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={c.sortKey && sort?.key === c.sortKey ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                className={cn('border-b border-line bg-surface px-3 py-2.5 font-medium whitespace-nowrap text-ink-3', alignCls(c), c.className)}
              >
                {header(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className="border-b border-line-soft px-3 py-3">
                      <Skeleton className={cn('h-3.5', c.align === 'right' ? 'ml-auto w-14' : 'w-24')} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  // Rows that open something are reachable and operable from the keyboard.
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => activateRow(e, () => onRowClick(row)) : undefined}
                  className={cn(
                    'hover:bg-mist [&:last-child>td]:border-b-0',
                    onRowClick && 'cursor-pointer focus-visible:bg-glacier focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-tide',
                    loading && 'opacity-60',
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('border-b border-line-soft px-3 py-2.5 whitespace-nowrap', alignCls(c), c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && empty}
    </div>
  );
}

function activateRow(e: KeyboardEvent<HTMLTableRowElement>, open: () => void) {
  if (e.target !== e.currentTarget) return; // a button, link or checkbox inside the row handles its own keys
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    open();
  }
}

/** Stops a click inside an interactive cell from also opening the row. */
export const stopRowClick = { onClick: (e: MouseEvent) => e.stopPropagation() };
