'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Notice } from '@/components/ui/notice';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { can } from '@/lib/roles';
import { ExportButton } from '@/features/exports/export-button';
import { EMPTY_FILTERS, toQueryString, type GoodsFilters } from '@/features/goods/filters';
import { useSessionStore } from '@/stores/session-store';

const yearStart = () => `${new Date().getUTCFullYear()}-01-01`;

interface Preset {
  title: string;
  description: string;
  filters?: Partial<GoodsFilters>;
  path?: string;
  file: string;
}

const PRESETS: () => Preset[] = () => [
  { title: 'All active goods', description: 'Every good with costs, prices, profit and stage dates.', filters: { sort: 'orderedAt:desc' }, file: 'wonderimport-goods.xlsx' },
  { title: 'Goods in transit', description: 'What is on its way to Ghana right now, with landed cost.', filters: { status: ['IN_TRANSIT'], sort: 'orderedAt:asc' }, file: 'wonderimport-in-transit.xlsx' },
  { title: 'Missing China check-ins', description: 'Goods past the warehouse without a check-in, oldest first.', filters: { checkIn: 'missing', sort: 'orderedAt:asc' }, file: 'wonderimport-missing-check-ins.xlsx' },
  { title: 'Manual selling prices', description: 'Goods sold at a price different from cost × rate × 3, with the reasons.', filters: { priceOverridden: 'true', sort: 'margin:asc' }, file: 'wonderimport-manual-prices.xlsx' },
  { title: 'This year’s goods', description: `Ordered since 1 January, most profitable first.`, filters: { orderedFrom: yearStart(), sort: 'profit:desc' }, file: 'wonderimport-this-year.xlsx' },
  { title: 'Client profitability', description: 'Every client with goods, units, delivered, landed cost, revenue, profit and margin.', path: '/exports/clients?sort=revenue:desc', file: 'wonderimport-clients.xlsx' },
];

export function ReportsScreen() {
  const allowed = can.importExport(useSessionStore((s) => s.me?.role));
  return (
    <>
      <PageHeader title="Reports" description="Ready-made Excel exports. Every export includes a totals row and a sheet describing exactly what it contains." />
      {!allowed ? (
        <Notice title="Only staff and administrators can export">You can still view every figure on the Dashboard, Goods and Clients pages.</Notice>
      ) : (
        <>
          <Panel>
            <PanelHeader title="Exports" />
            <ul>
              {PRESETS().map((p) => {
                const qs = p.filters ? toQueryString({ ...EMPTY_FILTERS, ...p.filters }) : '';
                const path = p.path ?? `/exports/goods${qs ? `?${qs}` : ''}`;
                return (
                  <li key={p.title} className="flex flex-wrap items-center gap-4 border-b border-line-soft px-[18px] py-3.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.title}</p>
                      <p className="text-[13px] text-ink-2">{p.description}</p>
                    </div>
                    {p.filters && (
                      <Link href={`/goods?${qs}`} className="text-[13px] font-medium text-fjord hover:underline">
                        View list
                      </Link>
                    )}
                    <ExportButton path={path} fallbackName={p.file} size="sm" label="Download" />
                  </li>
                );
              })}
            </ul>
          </Panel>
          <p className="text-[13px] text-ink-2">
            Need something else? Filter the <Link href="/goods" className="font-medium text-fjord hover:underline">Goods list</Link> any way you like and use Export: the file matches the list exactly.
          </p>
        </>
      )}
    </>
  );
}
