'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { count, ghs, percent } from '@/lib/format';
import type { DashboardSummary } from '@/lib/types';
import { goodsHref } from './links';

type Metric = 'revenue' | 'profit' | 'items';
const LABEL: Record<Metric, string> = { revenue: 'Revenue', profit: 'Profit', items: 'Items' };

export function LeadingClientsPanel({ summary }: { summary: DashboardSummary }) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const rows = summary.leadingClients[metric];
  const value = (r: (typeof rows)[number]) => (metric === 'items' ? r.goods : Number(r[metric]));
  const max = Math.max(...rows.map(value), 0) || 1;
  const u = summary.unassigned;

  return (
    <Panel>
      <PanelHeader
        title="Leading clients"
        actions={
          <div role="group" aria-label="Rank by" className="inline-flex rounded-control border border-line p-0.5">
            {(Object.keys(LABEL) as Metric[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={metric === m}
                onClick={() => setMetric(m)}
                className={cn('rounded-md px-2.5 py-1 text-[12.5px] font-medium', metric === m ? 'bg-glacier text-fjord-strong' : 'text-ink-2 hover:text-ink')}
              >
                {LABEL[m]}
              </button>
            ))}
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No named clients in this period">Goods in this period are all held as stock. Assign a client when editing a good.</EmptyState>
      ) : (
        <ol className="px-[18px] py-1.5">
          {rows.map((r, i) => (
            <li key={r.id} className="border-b border-line-soft last:border-b-0">
              <Link href={`/clients/${r.id}`} className="-mx-2 grid grid-cols-[26px_1fr_auto] items-center gap-2.5 rounded-md px-2 py-2.5 hover:bg-mist">
                <span className="grid size-6 place-items-center rounded-md bg-glacier text-xs font-semibold text-fjord-strong">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block text-xs text-ink-3">
                    {count(r.goods)} goods, {count(r.units)} units
                  </span>
                  <span className="mt-1.5 block h-[5px] overflow-hidden rounded bg-line-soft" aria-hidden>
                    <span className="block h-full rounded bg-fjord" style={{ width: `${Math.max(2, (value(r) / max) * 100)}%` }} />
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold whitespace-nowrap">{metric === 'items' ? `${count(r.goods)} goods` : ghs(r[metric])}</span>
                  <span className="block text-xs text-ink-3">{metric === 'items' ? `${count(r.units)} units` : `${percent(r.margin)} margin`}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {summary.leadingClients.namedClients > rows.length && (
        <p className="px-[18px] pb-2 text-xs text-ink-3">
          Top {rows.length} of {summary.leadingClients.namedClients} clients.{' '}
          <Link href="/clients?sort=revenue:desc" className="font-medium text-fjord hover:underline">
            See all clients
          </Link>
        </p>
      )}
      {u && u.goods > 0 && (
        <div className="mx-[18px] mb-4 rounded-control bg-amber-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-2">
          <b className="text-ink">
            {count(u.goods)} goods have no client
          </b>{' '}
          ({ghs(u.revenue)} expected revenue). They are held as stock until a client is assigned.{' '}
          <Link href={goodsHref(summary.period, { clientId: u.clientId })} className="font-medium text-fjord hover:underline">
            Review them
          </Link>
        </div>
      )}
    </Panel>
  );
}
