'use client';

import { ChevronDown } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { Menu, type MenuItem } from '@/components/ui/menu';
import { nextStatus, SHIPMENT_FLOW, STATUS_META } from '@/lib/status';
import type { Good, ShipmentStatus } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

interface StatusCellProps {
  good: Good;
  editable: boolean;
  onAdvance: (g: Good) => void;
  onMoveTo: (g: Good, to: ShipmentStatus, opts: { correction?: boolean; note?: string }) => void;
}

/**
 * Status badge that opens a pick-from-list dropdown of all six stages.
 * - Next stage: normal move (keeps the "move without check-in" confirm).
 * - Earlier stages: administrator corrections (fixed history note).
 * - Further-forward stages: disabled — the API rejects skipping stages.
 */
export function StatusCell({ good, editable, onAdvance, onMoveTo }: StatusCellProps) {
  const role = useSessionStore((s) => s.me?.role);
  if (!editable || good.archivedAt) return <StatusBadge status={good.status} />;

  const next = nextStatus(good.status);
  const currentIdx = SHIPMENT_FLOW.indexOf(good.status);
  const missingCheckIn = good.status === 'CHINA_WAREHOUSE' && !good.chinaCheckedIn;

  const dot = (s: ShipmentStatus) => (
    <span aria-hidden className="mt-1.5 size-2 flex-none rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
  );

  const items: MenuItem[] = SHIPMENT_FLOW.map((s) => {
    const idx = SHIPMENT_FLOW.indexOf(s);
    if (s === good.status) {
      return { label: `${STATUS_META[s].label} (current)`, icon: dot(s), disabled: true, onSelect: () => undefined };
    }
    if (next && s === next) {
      return {
        label: `Move to ${STATUS_META[s].label}`,
        icon: dot(s),
        hint: missingCheckIn ? 'China check-in not recorded yet' : undefined,
        onSelect: () => onAdvance(good),
      };
    }
    if (idx < currentIdx) {
      const allowed = role === 'ADMIN';
      return {
        label: STATUS_META[s].label,
        icon: dot(s),
        hint: allowed ? 'Correction — recorded in the history' : 'Administrators only',
        disabled: !allowed,
        onSelect: () => onMoveTo(good, s, { correction: true, note: 'Status corrected from the Goods list' }),
      };
    }
    return {
      label: STATUS_META[s].label,
      icon: dot(s),
      hint: 'Move one stage at a time',
      disabled: true,
      onSelect: () => undefined,
    };
  });

  return (
    <Menu
      align="start"
      header="Shipment status"
      items={items}
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
