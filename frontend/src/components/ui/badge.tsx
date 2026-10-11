import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { STATUS_META } from '@/lib/status';
import type { ShipmentStatus } from '@/lib/types';

/** Coloured dot + label. */
export function DotBadge({ color, children, className }: { color: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn('badge-dot', className)} style={{ ['--c' as string]: color }}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const meta = STATUS_META[status];
  return <DotBadge color={meta.color}>{meta.label}</DotBadge>;
}

const PAST_WAREHOUSE: ShipmentStatus[] = ['CHINA_WAREHOUSE', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'];

/** China warehouse check-in: Done, Missing (should have happened), or Not yet. */
export function CheckInBadge({ checkedIn, status }: { checkedIn: boolean; status: ShipmentStatus }) {
  if (checkedIn) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-mint">
        <Check className="size-3.5" aria-hidden /> Done
      </span>
    );
  }
  if (PAST_WAREHOUSE.includes(status)) return <span className="text-xs font-medium text-amber">Missing</span>;
  return <span className="text-xs text-ink-3">Not yet</span>;
}

export function RoleBadge({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full bg-glacier px-2 py-px text-xs font-medium text-fjord-strong">{children}</span>;
}
