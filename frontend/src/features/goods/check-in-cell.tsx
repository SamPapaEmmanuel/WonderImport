'use client';

import { cn } from '@/lib/cn';
import { dateTime } from '@/lib/format';
import { CHECK_IN_EXPECTED } from '@/lib/status';
import type { Good } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

/**
 * Tick-box check-in (Option A: a box on every row).
 * Staff and administrators tick to confirm the China warehouse received the
 * good. Only an administrator can untick to undo — staff see a locked box.
 * Viewers and archived rows see text only.
 */
export function CheckInCell({ good, editable, onCheckIn }: { good: Good; editable: boolean; onCheckIn: (g: Good, checkedIn: boolean) => void }) {
  const role = useSessionStore((s) => s.me?.role);
  const canToggle = editable && !good.archivedAt;
  const canUndo = role === 'ADMIN' && !good.archivedAt;
  const checkedDetail = good.chinaCheckedInAt
    ? `Checked in ${dateTime(good.chinaCheckedInAt)}${good.checkedInBy ? ` by ${good.checkedInBy.name}` : ''}`
    : 'Checked in at the China warehouse';

  if (good.chinaCheckedIn) {
    if (!canToggle) {
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-mint" title={checkedDetail}>
          <span aria-hidden className="inline-block size-4 rounded-[5px] bg-mint text-center text-[10px] leading-4 text-white">
            ✓
          </span>
          Done
        </span>
      );
    }
    return (
      <label
        className={cn('inline-flex items-center gap-2 text-xs font-medium text-mint', canUndo ? 'cursor-pointer' : 'cursor-not-allowed opacity-80')}
        title={canUndo ? `${checkedDetail}. Untick to undo.` : `${checkedDetail}. Only an administrator can undo a check-in.`}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked
          disabled={!canUndo}
          onChange={() => onCheckIn(good, false)}
          className="size-4 accent-[var(--mint)] disabled:cursor-not-allowed"
          aria-label={canUndo ? `Undo China check-in for ${good.itemName}` : `${good.itemName} checked in (only an administrator can undo)`}
        />
        Done
      </label>
    );
  }

  const expected = CHECK_IN_EXPECTED.includes(good.status);
  if (!canToggle) {
    return expected ? <span className="text-xs font-medium text-amber">Missing</span> : <span className="text-xs text-ink-3">Not yet</span>;
  }

  return (
    <label
      className={cn('inline-flex cursor-pointer items-center gap-2 text-xs', expected && good.status !== 'CHINA_WAREHOUSE' ? 'font-medium text-amber' : 'text-ink-2')}
      title={expected ? (good.status === 'CHINA_WAREHOUSE' ? 'Tick to confirm the warehouse received this good' : 'Check-in was missed. Tick to record it now.') : 'Tick to confirm this good has arrived at the warehouse'}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={false}
        onChange={() => onCheckIn(good, true)}
        className="size-4 cursor-pointer accent-[var(--fjord)]"
        aria-label={`Confirm China check-in for ${good.itemName}`}
      />
      {expected ? (good.status === 'CHINA_WAREHOUSE' ? 'Check in' : 'Missing') : 'Not yet'}
    </label>
  );
}
