import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from './skeleton';

export interface Kpi {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Drill-through to the list behind the number. */
  href?: string;
}

/** One bordered band of key figures, divided into cells (not separate cards). */
export function KpiBand({ items, loading }: { items: Kpi[]; loading?: boolean }) {
  const cols = items.length >= 6 ? 'lg:grid-cols-6' : items.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4';
  return (
    <section aria-label="Key figures" className={cn('grid grid-cols-2 overflow-hidden rounded-panel border border-line bg-line-soft sm:grid-cols-3', cols)} style={{ gap: 1 }}>
      {items.map((k) => {
        const body = (
          <>
            <span className="text-[13px] text-ink-2">{k.label}</span>
            {loading ? <Skeleton className="my-1 h-6 w-24" /> : <span className="text-lg font-semibold tracking-[-0.01em] sm:text-[22px]">{k.value}</span>}
            {k.hint && <span className="text-xs text-ink-3">{k.hint}</span>}
          </>
        );
        const cls = 'flex min-w-0 flex-col gap-1 bg-surface px-[18px] py-4';
        return k.href && !loading ? (
          <Link key={k.label} href={k.href} className={cn(cls, 'hover:bg-mist')}>
            {body}
          </Link>
        ) : (
          <div key={k.label} className={cls}>
            {body}
          </div>
        );
      })}
    </section>
  );
}

/** "GHS 1,234.56" with a quieter currency label. */
export function MoneyFigure({ value, tone }: { value: string; tone?: 'pos' | 'neg' }) {
  return (
    <span>
      <small className="mr-1 text-[13px] font-medium text-ink-3">GHS</small>
      <span className={cn(tone === 'pos' && 'text-mint', tone === 'neg' && 'text-rose')}>{Number(value).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </span>
  );
}
