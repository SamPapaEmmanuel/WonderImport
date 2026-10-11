'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button, buttonClass } from '@/components/ui/button';
import { KpiBand, MoneyFigure } from '@/components/ui/kpi-band';
import { Notice } from '@/components/ui/notice';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { ShippingRoute } from '@/components/ui/shipping-route';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { count, date, ghs, ghsWhole, percent } from '@/lib/format';
import { can } from '@/lib/roles';
import { STATUS_META } from '@/lib/status';
import type { DashboardSummary, PeriodKey } from '@/lib/types';
import { useRequest } from '@/lib/use-request';
import { CompactGoodsTable } from '@/features/goods/compact-goods-table';
import { useSessionStore } from '@/stores/session-store';
import { getDashboardSummary } from './api';
import { LeadingClientsPanel } from './leading-clients-panel';
import { goodsHref } from './links';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'ytd', label: 'This year' },
  { key: 'all', label: 'All time' },
];

function describePeriod(p: DashboardSummary['period']) {
  if (!p.from && !p.to) return 'All goods recorded, by order date';
  return `Goods ordered between ${date(p.from)} and ${date(p.to)}`;
}

function DashboardSkeleton() {
  return (
    <>
      <KpiBand loading items={['Goods recorded', 'In transit', 'Landed cost', 'Projected revenue', 'Projected profit', 'Average margin'].map((label) => ({ label, value: null }))} />
      <Skeleton className="h-[230px] w-full rounded-panel" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Skeleton className="h-[380px] rounded-panel" />
        <Skeleton className="h-[380px] rounded-panel" />
      </div>
    </>
  );
}

export function DashboardScreen() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const editable = can.editGoods(useSessionStore((s) => s.me?.role));
  const raw = sp.get('period');
  const period: PeriodKey = PERIODS.some((p) => p.key === raw) ? (raw as PeriodKey) : 'all';
  const { data: s, error, loading, reload } = useRequest(() => getDashboardSummary(period), [period]);

  const setPeriod = (key: PeriodKey) => router.replace(key === 'all' ? pathname : `${pathname}?period=${key}`, { scroll: false });

  const header = (
    <PageHeader
      title="Dashboard"
      description={s ? describePeriod(s.period) : ' '}
      actions={
        <>
          <div role="group" aria-label="Period" className="inline-flex rounded-control border border-line bg-surface p-[3px]">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={period === p.key}
                onClick={() => setPeriod(p.key)}
                className={cn('rounded-md px-3 py-1 text-[13px] font-medium', period === p.key ? 'bg-glacier text-fjord-strong' : 'text-ink-2 hover:text-ink')}
              >
                {p.label}
              </button>
            ))}
          </div>
          {editable && (
            <Link href="/goods?new=1" className={buttonClass('primary', 'md', 'gap-2')}>
              <Plus className="size-4" aria-hidden /> Add good
            </Link>
          )}
        </>
      }
    />
  );

  if (error)
    return (
      <>
        {header}
        <Panel>
          <ErrorState error={error} onRetry={reload} />
        </Panel>
      </>
    );

  if (!s || (loading && s.period.key !== period)) {
    return (
      <>
        {header}
        <DashboardSkeleton />
      </>
    );
  }

  const t = s.totals;

  if (t.goods === 0) {
    return (
      <>
        {header}
        <Panel>
          {s.period.key === 'all' ? (
            <EmptyState title="No goods recorded yet" action={editable && <Link href="/goods?new=1" className="font-medium text-fjord hover:underline">Add the first good</Link>}>
              The dashboard fills in as goods are added: costs, expected profit, where each parcel is, and who it is for.
            </EmptyState>
          ) : (
            <EmptyState title={`No goods were ordered in this period (${s.period.label.toLowerCase()})`} action={<Button size="sm" onClick={() => setPeriod('all')}>Show all time</Button>}>
              The period counts goods by their order date.
            </EmptyState>
          )}
        </Panel>
      </>
    );
  }

  const delivered = s.pipeline.find((p) => p.status === 'DELIVERED')!;

  return (
    <>
      {header}

      <KpiBand
        items={[
          { label: 'Goods recorded', value: count(t.goods), hint: `${count(t.units)} units`, href: goodsHref(s.period) },
          { label: 'In transit', value: count(t.inTransit.goods), hint: `${ghs(t.inTransit.landedCost)} landed cost`, href: goodsHref(s.period, { status: ['IN_TRANSIT'] }) },
          { label: 'Landed cost', value: <MoneyFigure value={t.landedCost} />, hint: 'Qty × unit cost × rate', href: goodsHref(s.period, { sort: 'totalCost:desc' }) },
          { label: 'Projected revenue', value: <MoneyFigure value={t.revenue} />, hint: 'At active selling prices', href: goodsHref(s.period, { sort: 'expectedRevenue:desc' }) },
          {
            label: 'Projected profit',
            value: <MoneyFigure value={t.profit} tone={Number(t.profit) < 0 ? 'neg' : 'pos'} />,
            hint: 'Revenue minus landed cost',
            href: goodsHref(s.period, { sort: 'profit:desc' }),
          },
          { label: 'Average margin', value: percent(t.margin), hint: 'Total profit ÷ revenue', href: goodsHref(s.period, { sort: 'margin:asc' }) },
        ]}
      />

      {t.checkInMissing > 0 && (
        <Notice tone="warning" title={`${count(t.checkInMissing)} ${t.checkInMissing === 1 ? 'good has' : 'goods have'} passed the China warehouse without a check-in`}>
          <Link href={goodsHref(s.period, { checkIn: 'missing' })} className="font-medium text-fjord hover:underline">
            Review and record check-ins
          </Link>
        </Notice>
      )}

      <Panel>
        <PanelHeader title="Shipping route" description="Goods count and landed cost at each stage. Select a stage to open those goods." />
        <ShippingRoute
          stations={s.pipeline.map((p) => ({
            status: p.status,
            count: p.goods,
            detail: ghsWhole(p.landedCost),
            href: goodsHref(s.period, { status: [p.status] }),
            flag: p.checkInMissing ? { label: `${p.checkInMissing} not checked in`, href: goodsHref(s.period, { status: [p.status], checkIn: 'missing' }) } : undefined,
          }))}
          footnote={`${Math.round((delivered.goods / t.goods) * 100)}% ${STATUS_META.DELIVERED.label.toLowerCase()}`}
        />
      </Panel>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Panel>
          <PanelHeader
            title="Recently updated goods"
            actions={
              <Link href={goodsHref(s.period, { sort: 'updatedAt:desc' })} className="text-[13px] font-medium text-fjord hover:underline">
                Open goods list
              </Link>
            }
          />
          <CompactGoodsTable rows={s.recent} />
        </Panel>
        <LeadingClientsPanel summary={s} />
      </div>

      <p className="text-xs text-ink-3">{s.period.definition}</p>
    </>
  );
}
