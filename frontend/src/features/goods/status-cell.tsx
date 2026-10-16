'use client';

import { ChevronDown } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { Menu } from '@/components/ui/menu';
import { nextStatus, STATUS_META } from '@/lib/status';
import type { Good } from '@/lib/types';

/** Status badge that doubles as a one-step "move to next stage" control for staff and admins. */
export function StatusCell({ good, editable, onAdvance }: { good: Good; editable: boolean; onAdvance: (g: Good) => void }) {
  const next = nextStatus(good.status);
  if (!editable || !next || good.archivedAt) return <StatusBadge status={good.status} />;

  const missingCheckIn = good.status === 'CHINA_WAREHOUSE' && !good.chinaCheckedIn;
  return (
    <Menu
      align="start"
      header="Shipment status"
      items={[
        {
          label: `Move to ${STATUS_META[next].label}`,
          hint: missingCheckIn ? 'China check-in not recorded yet' : undefined,
          onSelect: () => onAdvance(good),
        },
      ]}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          onClick={(e) => {
            e.stopPropagation();
            props.onClick();
          }}
          className="inline-flex items-center gap-1 rounded-full hover:ring-2 hover:ring-line"
          aria-label={`Status ${STATUS_META[good.status].label}. Change status`}
        >
          <StatusBadge status={good.status} />
          <ChevronDown className="size-3.5 text-ink-3" aria-hidden />
        </button>
      )}
    />
  );
}
