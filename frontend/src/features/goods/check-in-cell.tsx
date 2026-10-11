'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { dateTime } from '@/lib/format';
import { CHECK_IN_EXPECTED } from '@/lib/status';
import type { Good } from '@/lib/types';

/** Done / Missing / Not yet, with a one-click "Check in" for staff once the good reaches the warehouse. */
export function CheckInCell({ good, editable, onCheckIn }: { good: Good; editable: boolean; onCheckIn: (g: Good) => void }) {
  if (good.chinaCheckedIn) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-mint" title={good.chinaCheckedInAt ? `Checked in ${dateTime(good.chinaCheckedInAt)}${good.checkedInBy ? ` by ${good.checkedInBy.name}` : ''}` : undefined}>
        <Check className="size-3.5" aria-hidden /> Done
      </span>
    );
  }
  const expected = CHECK_IN_EXPECTED.includes(good.status);
  if (!expected) return <span className="text-xs text-ink-3">Not yet</span>;
  if (!editable || good.archivedAt) return <span className="text-xs font-medium text-amber">Missing</span>;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onCheckIn(good);
      }}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
        good.status === 'CHINA_WAREHOUSE' ? 'border-line text-fjord hover:border-fjord hover:bg-glacier' : 'border-amber/40 bg-amber-bg text-amber hover:border-amber',
      )}
      title={good.status === 'CHINA_WAREHOUSE' ? 'Record that the warehouse received this good' : 'Check-in was missed. Record it now.'}
    >
      {good.status === 'CHINA_WAREHOUSE' ? 'Check in' : 'Missing, check in'}
    </button>
  );
}
