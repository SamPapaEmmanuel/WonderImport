import { cn } from '@/lib/cn';
import { date, dateTime } from '@/lib/format';
import { SHIPMENT_FLOW, STAGE_DATE_KEY, STATUS_META } from '@/lib/status';
import type { GoodDetail } from '@/lib/types';

/** The six stages top to bottom: reached stages are filled, the current one is ringed. */
export function ShipmentTimeline({ good }: { good: GoodDetail }) {
  const current = SHIPMENT_FLOW.indexOf(good.status);
  const corrections = good.statusHistory.filter((h) => h.isCorrection);

  return (
    <div>
      <ol className="relative">
        {SHIPMENT_FLOW.map((s, i) => {
          const reached = i <= current;
          const last = [...good.statusHistory].reverse().find((h) => h.toStatus === s);
          const day = good.dates[STAGE_DATE_KEY[s]];
          return (
            <li key={s} className="relative flex gap-3 pb-4 last:pb-0" style={{ ['--c' as string]: STATUS_META[s].color }}>
              {i < SHIPMENT_FLOW.length - 1 && (
                <span aria-hidden className={cn('absolute top-5 left-[8px] h-[calc(100%-12px)] w-0.5', i < current ? 'bg-[color:var(--c)] opacity-50' : 'bg-line')} />
              )}
              <span
                aria-hidden
                className={cn(
                  'relative z-[1] mt-0.5 size-[18px] flex-none rounded-full border-[4px]',
                  reached ? 'border-[color:var(--c)] bg-surface' : 'border-line bg-surface',
                  i === current && 'ring-4 ring-[color-mix(in_srgb,var(--c)_20%,transparent)]',
                )}
              />
              <div className="min-w-0 text-[13px]">
                <p className={cn('font-medium', !reached && 'text-ink-3')}>
                  {STATUS_META[s].label}
                  {i === current && <span className="sr-only"> (current)</span>}
                </p>
                <p className="text-xs text-ink-3">
                  {reached ? (day ? date(day) : 'Date not recorded') : 'Not reached'}
                  {reached && last ? `, by ${last.changedBy.name}` : ''}
                </p>
                {s === 'CHINA_WAREHOUSE' && reached && !good.chinaCheckedIn && <p className="mt-0.5 text-xs font-medium text-amber">Check-in not recorded</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {corrections.length > 0 && (
        <div className="mt-4 rounded-md bg-amber-bg px-3 py-2.5 text-xs text-ink-2">
          <p className="font-medium text-ink">Corrections</p>
          <ul className="mt-1 space-y-1">
            {corrections.map((c) => (
              <li key={c.id}>
                {STATUS_META[c.fromStatus ?? 'ORDERED'].label} to {STATUS_META[c.toStatus].label} by {c.changedBy.name}, {dateTime(c.changedAt)}. {c.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
