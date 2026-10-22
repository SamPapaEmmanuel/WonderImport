'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-error';
import { nextStatus, SHIPMENT_FLOW, STATUS_META } from '@/lib/status';
import type { Good, ShipmentStatus } from '@/lib/types';
import { toast } from '@/stores/toast-store';
import { goodsApi } from './api';

interface Options {
  /** Apply a change to the on-screen copy immediately (optimistic) or roll it back. */
  applyLocal?: (id: string, patch: Partial<Good>) => void;
  /** Called with the server's version after any successful change. */
  onChanged?: (good: Good) => void;
  onDuplicated?: (good: Good) => void;
  /** The server rejected a stale update; refetch. */
  onStale?: () => void;
}

/**
 * Shipment and record actions shared by the Goods table and the detail drawer.
 * Render `dialogs` once in the screen that uses the hook.
 */
export function useGoodsActions({ applyLocal = () => undefined, onChanged, onDuplicated, onStale }: Options) {
  const [advanceTarget, setAdvanceTarget] = useState<Good | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Good | null>(null);
  const [archiveReason, setArchiveReason] = useState('');

  async function moveTo(g: Good, to: ShipmentStatus, opts: { correction?: boolean; note?: string } = {}) {
    applyLocal(g.id, { status: to });
    try {
      const res = await goodsApi.changeStatus(g.id, { status: to, expectedStatus: g.status, correction: opts.correction, note: opts.note || null });
      applyLocal(g.id, res.data);
      onChanged?.(res.data);
      toast.success(
        `${g.itemName} moved to ${STATUS_META[to].label}`,
        res.warnings.includes('CHINA_CHECK_IN_PENDING') ? 'China check-in is still not recorded for this good.' : undefined,
      );
      return true;
    } catch (e) {
      applyLocal(g.id, { status: g.status });
      const err = ApiError.from(e);
      toast.error('Status not changed', err.message);
      if (err.code === 'CONFLICT') onStale?.();
      return false;
    }
  }

  /** Moves to the next stage; asks first when leaving China warehouse without a check-in. */
  function advance(g: Good) {
    const to = nextStatus(g.status);
    if (!to) return;
    if (g.status === 'CHINA_WAREHOUSE' && !g.chinaCheckedIn) {
      setAdvanceTarget(g);
      return;
    }
    void moveTo(g, to);
  }

  async function setCheckIn(g: Good, checkedIn = true, quiet = false) {
    applyLocal(g.id, { chinaCheckedIn: checkedIn });
    try {
      const updated = await goodsApi.checkIn(g.id, checkedIn);
      applyLocal(g.id, updated);
      onChanged?.(updated);
      if (!quiet) toast.success(checkedIn ? `${g.itemName} checked in at the China warehouse` : 'China check-in removed');
      return updated;
    } catch (e) {
      applyLocal(g.id, { chinaCheckedIn: g.chinaCheckedIn });
      toast.error('Check-in not saved', ApiError.from(e).message);
      return null;
    }
  }

  /**
   * Tick-box flow.
   * - Tick: check in, then walk the status forward to China warehouse one
   *   stage at a time (the API rejects skipping stages).
   * - Untick (administrators only): remove the check-in, then walk the
   *   status back to Ordered one stage at a time as corrections. Staff
   *   never reach this path — their box is locked.
   */
  async function checkInAndMove(g: Good, checkedIn: boolean) {
    if (!checkedIn) {
      const updated = await setCheckIn(g, false, true);
      if (!updated) return;
      let current = updated;
      let moved = false;
      const note = 'Check-in removed from the Goods list';
      while (SHIPMENT_FLOW.indexOf(current.status) > SHIPMENT_FLOW.indexOf('ORDERED')) {
        const idx = SHIPMENT_FLOW.indexOf(current.status);
        const to = SHIPMENT_FLOW[idx - 1];
        applyLocal(current.id, { status: to });
        try {
          const res = await goodsApi.changeStatus(current.id, { status: to, expectedStatus: current.status, correction: true, note });
          applyLocal(current.id, res.data);
          onChanged?.(res.data);
          current = res.data;
          moved = true;
        } catch (e) {
          applyLocal(current.id, { status: current.status });
          const err = ApiError.from(e);
          toast.error('Check-in removed, but status not changed', err.message);
          if (err.code === 'CONFLICT') onStale?.();
          return;
        }
      }
      toast.success(moved ? `${g.itemName} check-in removed and moved back to Ordered` : 'China check-in removed');
      return;
    }
    const updated = await setCheckIn(g, true, true);
    if (!updated) return;
    let current = updated;
    let moved = false;
    while (SHIPMENT_FLOW.indexOf(current.status) < SHIPMENT_FLOW.indexOf('CHINA_WAREHOUSE')) {
      const to = nextStatus(current.status);
      if (!to) break;
      applyLocal(current.id, { status: to });
      try {
        const res = await goodsApi.changeStatus(current.id, { status: to, expectedStatus: current.status });
        applyLocal(current.id, res.data);
        onChanged?.(res.data);
        current = res.data;
        moved = true;
      } catch (e) {
        applyLocal(current.id, { status: current.status });
        const err = ApiError.from(e);
        toast.error('Check-in saved, but status not changed', err.message);
        if (err.code === 'CONFLICT') onStale?.();
        return;
      }
    }
    toast.success(moved ? `${g.itemName} checked in and moved to China warehouse` : `${g.itemName} checked in at the China warehouse`);
  }

  async function duplicate(g: Good) {
    try {
      const copy = await goodsApi.duplicate(g.id);
      toast.success('Copy created', 'It starts as Ordered. Edit it to change the item or quantity.');
      onDuplicated?.(copy);
    } catch (e) {
      toast.error('Could not duplicate', ApiError.from(e).message);
    }
  }

  async function restore(g: Good) {
    try {
      const restored = await goodsApi.restore(g.id);
      onChanged?.(restored);
      toast.success(`${g.itemName} restored`);
    } catch (e) {
      toast.error('Could not restore', ApiError.from(e).message);
    }
  }

  const dialogs = (
    <>
      <ConfirmDialog
        open={!!advanceTarget}
        title="Move without a China check-in?"
        description={advanceTarget ? `${advanceTarget.itemName} has not been checked in at the China warehouse.` : undefined}
        confirmLabel="Move anyway"
        onClose={() => setAdvanceTarget(null)}
        secondary={{
          label: 'Check in and move',
          onSelect: async () => {
            const g = advanceTarget!;
            const updated = await setCheckIn(g, true, true);
            if (updated) await moveTo(updated, 'IN_TRANSIT');
          },
        }}
        onConfirm={async () => {
          await moveTo(advanceTarget!, 'IN_TRANSIT');
        }}
      >
        <p className="text-[13px] text-ink-2">Goods normally leave for Ghana only after the warehouse confirms receipt. Moving anyway is recorded in the history.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!archiveTarget}
        title="Archive this good?"
        description={archiveTarget?.itemName}
        confirmLabel="Archive"
        tone="danger"
        onClose={() => {
          setArchiveTarget(null);
          setArchiveReason('');
        }}
        onConfirm={async () => {
          const g = archiveTarget!;
          try {
            const archived = await goodsApi.archive(g.id, archiveReason.trim() || undefined);
            onChanged?.(archived);
            toast.success(`${g.itemName} archived`, 'Archived goods are hidden from lists and totals. You can restore it from the Archived filter.');
          } catch (e) {
            toast.error('Could not archive', ApiError.from(e).message);
            throw e;
          }
        }}
      >
        <Field label="Reason (optional)" hint="Saved in the history.">
          <Input value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} maxLength={500} />
        </Field>
      </ConfirmDialog>
    </>
  );

  return { advance, moveTo, setCheckIn, checkInAndMove, duplicate, archive: setArchiveTarget, restore, dialogs };
}
