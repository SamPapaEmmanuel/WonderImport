'use client';

import { Button } from '@/components/ui/button';
import { count, dateTime, ghs } from '@/lib/format';
import type { Allocation, Good, GoodDetail } from '@/lib/types';

/**
 * Buyers: two or more clients can purchase shares of the same good at the
 * same time. Each sale consumes itemsLeft atomically; an oversell attempt
 * gets a 409 with the fresh count and the panel refreshes.
 */
export function BuyersPanel({ good, onChanged }: { good: GoodDetail | Good; onChanged: (g: Good) => void }) {
  const allocations: Allocation[] = (good as GoodDetail).allocations ?? [];
  const left = good.itemsLeft;
  const sold = allocations.reduce((n, a) => n + a.quantity, 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-2">
        {count(good.quantity)} ordered
        {good.quantitySold > 0 && `, ${count(good.quantitySold)} sold before split sales`}
        {allocations.length > 0 && `, ${count(sold)} split across ${allocations.length} buyer${allocations.length === 1 ? '' : 's'}`}
        {` — `}
        <strong className={left === 0 ? 'text-rose' : undefined}>{count(left)} left</strong>.
      </p>

      {allocations.length === 0 ? (
        <p className="text-[13px] text-ink-3">No split sales yet.</p>
      ) : (
        <ul className="divide-y divide-line-soft rounded-control border border-line">
          {allocations.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
              <span className="min-w-0">
                <span className="font-medium">{a.client.isStock ? 'Stock (unassigned)' : a.client.name}</span>{' '}
                <span className="text-ink-3">× {count(a.quantity)}</span>
                {a.sellingPrice && <span className="text-ink-3"> @ {ghs(a.sellingPrice)}/unit</span>}
                {a.createdBy && <span className="block text-xs text-ink-3">by {a.createdBy.name}{a.createdAt ? ` · ${dateTime(a.createdAt)}` : ''}</span>}
              </span>
              <span className="shrink-0 font-mono text-xs text-ink-3">{a.client.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
