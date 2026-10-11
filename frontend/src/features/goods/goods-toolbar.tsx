'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { SHIPMENT_FLOW, STATUS_META } from '@/lib/status';
import type { ShipmentStatus } from '@/lib/types';
import { useLookups } from '@/features/lookups/use-lookups';
import { activeFilterCount, EMPTY_FILTERS, type GoodsFilters } from './filters';

interface ToolbarProps {
  filters: GoodsFilters;
  onChange: (patch: Partial<GoodsFilters>) => void;
}

function Labeled({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-xs text-ink-3">{label}</span>
      {children}
    </label>
  );
}

export function GoodsToolbar({ filters, onChange }: ToolbarProps) {
  const { data: lookups } = useLookups();
  const [q, setQ] = useState(filters.q);
  const advancedCount = activeFilterCount({ ...filters, q: '', status: [] });
  const [showMore, setShowMore] = useState(advancedCount > 0);
  const total = activeFilterCount(filters);

  // Keep the box in sync when the URL changes elsewhere (e.g. top-bar search).
  useEffect(() => setQ(filters.q), [filters.q]);

  // Debounced search
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => onChange({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function toggleStatus(s: ShipmentStatus) {
    const has = filters.status.includes(s);
    onChange({ status: has ? filters.status.filter((x) => x !== s) : SHIPMENT_FLOW.filter((x) => x === s || filters.status.includes(x)) });
  }

  return (
    <div className="flex flex-col gap-3 border-b border-line-soft px-[18px] py-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-control border border-line bg-surface px-3 text-ink-3 focus-within:border-tide focus-within:ring-2 focus-within:ring-tide/30 sm:max-w-[340px]">
          <Search className="size-4 flex-none" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Item, tracking number, client, supplier"
            aria-label="Search goods"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="rounded p-0.5 hover:text-ink">
              <X className="size-3.5" />
            </button>
          )}
        </label>

        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {SHIPMENT_FLOW.map((s) => {
            const on = filters.status.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggleStatus(s)}
                style={{ ['--c' as string]: STATUS_META[s].color }}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors',
                  on ? 'border-[color:var(--c)] bg-[color-mix(in_srgb,var(--c)_12%,transparent)] text-ink' : 'border-line text-ink-2 hover:border-ink-3',
                )}
              >
                <span className="size-2 rounded-full bg-[color:var(--c)]" aria-hidden />
                {STATUS_META[s].label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant={showMore ? 'secondary' : 'ghost'} onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
            <SlidersHorizontal className="size-4" aria-hidden />
            More filters{advancedCount ? ` (${advancedCount})` : ''}
          </Button>
          {total > 0 && (
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort, pageSize: filters.pageSize })}>
              Clear all
            </Button>
          )}
        </div>
      </div>

      {showMore && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Labeled label="Client" className="col-span-2 md:col-span-1">
            <Select value={filters.clientId} onChange={(e) => onChange({ clientId: e.target.value })}>
              <option value="">All clients</option>
              {lookups?.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Supplier">
            <Select value={filters.supplierId} onChange={(e) => onChange({ supplierId: e.target.value })}>
              <option value="">All</option>
              {lookups?.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Category">
            <Select value={filters.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })}>
              <option value="">All</option>
              {lookups?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="China check-in">
            <Select value={filters.checkIn} onChange={(e) => onChange({ checkIn: e.target.value as GoodsFilters['checkIn'] })}>
              <option value="">Any</option>
              <option value="yes">Checked in</option>
              <option value="no">Not checked in</option>
              <option value="missing">Missing (past warehouse)</option>
            </Select>
          </Labeled>
          <Labeled label="Ordered from">
            <Input type="date" value={filters.orderedFrom} max={filters.orderedTo || undefined} onChange={(e) => onChange({ orderedFrom: e.target.value })} />
          </Labeled>
          <Labeled label="Ordered to">
            <Input type="date" value={filters.orderedTo} min={filters.orderedFrom || undefined} onChange={(e) => onChange({ orderedTo: e.target.value })} />
          </Labeled>
          <Labeled label="Selling price">
            <Select value={filters.priceOverridden} onChange={(e) => onChange({ priceOverridden: e.target.value as GoodsFilters['priceOverridden'] })}>
              <option value="">Any</option>
              <option value="false">Suggested (×3)</option>
              <option value="true">Set manually</option>
            </Select>
          </Labeled>
          <Labeled label="Archived">
            <Select value={filters.archived} onChange={(e) => onChange({ archived: e.target.value as GoodsFilters['archived'] })}>
              <option value="exclude">Hide archived</option>
              <option value="include">Show all</option>
              <option value="only">Archived only</option>
            </Select>
          </Labeled>
        </div>
      )}
    </div>
  );
}
