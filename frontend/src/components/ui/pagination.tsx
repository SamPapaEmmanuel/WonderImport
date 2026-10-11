'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { count } from '@/lib/format';
import { Button } from './button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  noun?: [singular: string, plural: string];
}

export function Pagination({ page, pageSize, total, onPage, onPageSize, noun = ['item', 'items'] }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-[18px] py-3 text-[13px] text-ink-2">
      <span>
        {total === 0 ? `No ${noun[1]}` : `${count(from)}–${count(to)} of ${count(total)} ${total === 1 ? noun[0] : noun[1]}`}
      </span>
      <div className="flex items-center gap-3">
        {onPageSize && (
          <label className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              className="h-8 rounded-control border border-line bg-surface px-2 text-[13px] text-ink"
              aria-label="Rows per page"
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[72px] text-center">
            Page {page} of {pages}
          </span>
          <Button size="sm" variant="ghost" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
