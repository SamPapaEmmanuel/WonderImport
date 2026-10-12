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

/** Separate pill cards like a modern dashboard, instead of one divided band. */
export function KpiBand({ items, loading }: { items: Kpi[]; loading?: boolean }) {
  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((k) => {
        const body = (
          <>
            <span className="text-[13px] text-ink-2">{k.label}</span>
            {loading ? <Skeleton className="my-1 h-6 w-24" /> : <span className="text-lg font-semibold tracking-[-0.02em] sm:text-[22px]">{k.value}</span>}
            {k.hint && <span className="text-xs text-ink-3">{k.hint}</span>}
          </>
        );
        const cls =
          'flex min-w-0 flex-col gap-1 rounded-panel border border-line bg-surface px-[18px] py-4 shadow-[0_1px_2px_rgba(16,16,28,0.04)] transition-colors';
        return k.href && !loading ? (
          <Link key={k.label} href={k.href} className={cn(cls, 'hover:border-tide/50')}>
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
