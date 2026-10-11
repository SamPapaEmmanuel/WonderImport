import Link from 'next/link';
import { cn } from '@/lib/cn';
import { STATUS_META } from '@/lib/status';
import type { ShipmentStatus } from '@/lib/types';

export interface RouteStation {
  status: ShipmentStatus;
  count: number;
  detail?: string;
  href?: string;
  flag?: { label: string; href?: string };
}

/**
 * The six shipment stages drawn as stations on a line: the dashboard's signature element.
 * Each station shows its goods count and links to the filtered goods list.
 */
export function ShippingRoute({ stations, footnote }: { stations: RouteStation[]; footnote?: string }) {
  const total = stations.reduce((n, s) => n + s.count, 0);
  return (
    <div className="overflow-x-auto px-6 pt-6 pb-5">
      <ol className="grid min-w-[760px] grid-cols-6">
        {stations.map((s, i) => {
          const color = STATUS_META[s.status].color;
          const inner = (
            <>
              <span aria-hidden className="relative z-[1] mb-2.5 size-[26px] rounded-full border-[5px] bg-surface transition-transform group-hover:scale-110" style={{ borderColor: color }} />
              <span className="text-[13px] font-medium text-ink-2">{STATUS_META[s.status].label}</span>
              <span className={cn('text-[26px] leading-tight font-semibold', s.count === 0 && 'text-ink-3')}>{s.count}</span>
              {s.detail && <span className="text-[12.5px] text-ink-3">{s.detail}</span>}
            </>
          );
          return (
            <li key={s.status} className="relative flex flex-col items-center text-center">
              {i < stations.length - 1 && <span aria-hidden className="absolute top-[11px] left-1/2 h-1 w-full opacity-55" style={{ background: color }} />}
              {s.href ? (
                <Link href={s.href} className="group flex flex-col items-center rounded-panel px-2" aria-label={`${STATUS_META[s.status].label}: ${s.count} goods`}>
                  {inner}
                </Link>
              ) : (
                <div className="group flex flex-col items-center px-2">{inner}</div>
              )}
              {s.flag &&
                (s.flag.href ? (
                  <Link href={s.flag.href} className="mt-1.5 rounded-full bg-amber-bg px-2.5 py-0.5 text-xs font-medium text-amber hover:underline">
                    {s.flag.label}
                  </Link>
                ) : (
                  <span className="mt-1.5 rounded-full bg-amber-bg px-2.5 py-0.5 text-xs font-medium text-amber">{s.flag.label}</span>
                ))}
            </li>
          );
        })}
      </ol>
      {total > 0 && (
        <>
          <div className="mt-5 flex h-2 min-w-[760px] gap-0.5 overflow-hidden rounded-md" aria-hidden>
            {stations.map((s) => (s.count ? <span key={s.status} style={{ flex: s.count, background: STATUS_META[s.status].color }} /> : null))}
          </div>
          <div className="mt-2 flex min-w-[760px] justify-between text-xs text-ink-3">
            <span>Share of goods by stage</span>
            {footnote && <span>{footnote}</span>}
          </div>
        </>
      )}
    </div>
  );
}
