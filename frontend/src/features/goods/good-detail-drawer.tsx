'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Archive, ArchiveRestore, Copy, MoreHorizontal, Pencil, Undo2 } from 'lucide-react';
import { CheckInBadge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Menu, type MenuItem } from '@/components/ui/menu';
import { Notice } from '@/components/ui/notice';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { Textarea } from '@/components/ui/textarea';
import { count, dateTime } from '@/lib/format';
import { can } from '@/lib/roles';
import { CHECK_IN_EXPECTED, nextStatus, SHIPMENT_FLOW, STATUS_META } from '@/lib/status';
import type { Good, GoodDetail, ShipmentStatus } from '@/lib/types';
import { useRequest } from '@/lib/use-request';
import { useSessionStore } from '@/stores/session-store';
import { goodsApi } from './api';
import { FinancialBreakdown } from './financial-breakdown';
import { HistoryList } from './history-list';
import { ShipmentTimeline } from './shipment-timeline';
import { useGoodsActions } from './use-goods-actions';

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-b border-line-soft py-4 first:pt-0 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-2 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

interface Props {
  goodId: string | null;
  /** Bump to force a refetch, e.g. after the good was edited elsewhere. */
  version?: number;
  onClose: () => void;
  onEdit: (g: Good) => void;
  /** Called after any change so the list can refresh. */
  onChanged: (g: Good) => void;
  onDuplicated: (g: Good) => void;
}

export function GoodDetailDrawer({ goodId, version = 0, onClose, onEdit, onChanged, onDuplicated }: Props) {
  const role = useSessionStore((s) => s.me?.role);
  const editable = can.editGoods(role);
  const isAdmin = can.correctShipment(role);
  const detail = useRequest(() => (goodId ? goodsApi.get(goodId) : Promise.resolve(null)), [goodId, version]);
  const g = detail.data;
  const [correcting, setCorrecting] = useState(false);
  const [correctTo, setCorrectTo] = useState<ShipmentStatus>('ORDERED');
  const [correctNote, setCorrectNote] = useState('');
  const [undoCheckIn, setUndoCheckIn] = useState(false);

  const refresh = (changed: Good) => {
    onChanged(changed);
    void detail.reload();
  };

  const actions = useGoodsActions({
    applyLocal: (_id, patch) => detail.mutate((d) => (d ? ({ ...d, ...patch } as GoodDetail) : d)),
    onChanged: refresh,
    onDuplicated,
    onStale: () => void detail.reload(),
  });

  if (!goodId) return null;

  const next = g ? nextStatus(g.status) : null;
  const live = g && !g.archivedAt;
  const menuItems: (MenuItem | 'separator')[] = [];
  if (g && editable) {
    if (live) {
      menuItems.push({ label: 'Duplicate', icon: <Copy className="size-4" />, onSelect: () => actions.duplicate(g) });
      if (isAdmin) {
        menuItems.push({
          label: 'Correct status…',
          hint: 'Move to an earlier or later stage',
          icon: <Undo2 className="size-4" />,
          onSelect: () => {
            setCorrectTo(SHIPMENT_FLOW[Math.max(0, SHIPMENT_FLOW.indexOf(g.status) - 1)]);
            setCorrectNote('');
            setCorrecting(true);
          },
        });
        if (g.chinaCheckedIn) menuItems.push({ label: 'Undo China check-in', icon: <Undo2 className="size-4" />, onSelect: () => setUndoCheckIn(true) });
      }
      menuItems.push('separator', { label: 'Archive', tone: 'danger', icon: <Archive className="size-4" />, onSelect: () => actions.archive(g) });
    } else {
      menuItems.push({ label: 'Restore', icon: <ArchiveRestore className="size-4" />, onSelect: () => actions.restore(g) });
    }
  }

  return (
    <>
      <Dialog
        open
        variant="drawer"
        onClose={onClose}
        title={g?.itemName ?? 'Loading…'}
        description={
          g ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {g.trackingNumber && <span className="font-mono text-xs">{g.trackingNumber}</span>}
              <span>{g.client.isStock ? 'Stock' : g.client.name}</span>
            </span>
          ) : undefined
        }
      >
        {detail.error ? (
          <ErrorState error={detail.error} onRetry={detail.reload} />
        ) : !g ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="flex flex-col">
            {g.archivedAt && (
              <Notice tone="warning" title={`Archived ${dateTime(g.archivedAt)}`} className="mb-4">
                Archived goods are hidden from lists and totals. Restore it to make changes.
              </Notice>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-panel border border-line px-3.5 py-3">
              <StatusBadge status={g.status} />
              <span className="text-xs text-ink-3">China check-in</span>
              <CheckInBadge checkedIn={g.chinaCheckedIn} status={g.status} />
              <div className="ml-auto flex items-center gap-2">
                {editable && live && next && (
                  <Button size="sm" variant="primary" onClick={() => actions.advance(g)}>
                    Move to {STATUS_META[next].label}
                  </Button>
                )}
                {editable && live && (
                  <Button size="sm" onClick={() => onEdit(g)}>
                    <Pencil className="size-3.5" aria-hidden /> Edit
                  </Button>
                )}
                {menuItems.length > 0 && (
                  <Menu
                    items={menuItems}
                    trigger={(props) => (
                      <Button size="sm" variant="ghost" {...props} aria-label="More actions">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    )}
                  />
                )}
              </div>
            </div>

            <Section title="Financials">
              <FinancialBreakdown good={g} />
            </Section>

            <Section
              title="Shipment"
              action={
                editable && live && !g.chinaCheckedIn && CHECK_IN_EXPECTED.includes(g.status) ? (
                  <Button size="sm" onClick={() => actions.setCheckIn(g, true)}>
                    Record China check-in
                  </Button>
                ) : undefined
              }
            >
              <ShipmentTimeline good={g} />
              {g.chinaCheckedIn && (
                <p className="mt-3 text-xs text-ink-2">
                  Checked in at the China warehouse{g.checkedInBy ? ` by ${g.checkedInBy.name}` : ''}
                  {g.chinaCheckedInAt ? ` on ${dateTime(g.chinaCheckedInAt)}` : ''}.
                </p>
              )}
            </Section>

            <Section title="Details">
              <Facts
                rows={[
                  [
                    'Client',
                    <Link key="client" href={`/clients/${g.client.id}`} className="font-medium text-fjord hover:underline">
                      {g.client.isStock ? 'Stock (unassigned)' : `${g.client.name} (${g.client.code})`}
                    </Link>,
                  ],
                  ['Supplier', g.supplier.name],
                  ['Category', g.category.name],
                  ['Quantity', `${count(g.quantity)} ordered, ${count(g.quantitySold)} sold, ${count(g.itemsLeft)} left`],
                  ['Notes', g.notes ?? <span className="text-ink-3">None</span>],
                  ['Recorded', `${dateTime(g.createdAt)} by ${g.createdBy.name}`],
                  ['Last change', `${dateTime(g.updatedAt)}${g.updatedBy ? ` by ${g.updatedBy.name}` : ''}`],
                ]}
              />
            </Section>

            {editable && (
              <Section title="History">
                <HistoryList goodId={g.id} version={g.updatedAt + g.status + String(g.chinaCheckedIn)} />
              </Section>
            )}
          </div>
        )}
      </Dialog>

      {actions.dialogs}

      {g && (
        <ConfirmDialog
          open={correcting}
          title="Correct shipment status"
          description="Use this to fix a mistake. The correction and your reason are shown in the timeline."
          confirmLabel="Save correction"
          confirmDisabled={correctNote.trim().length < 3}
          onClose={() => setCorrecting(false)}
          onConfirm={async () => {
            const ok = await actions.moveTo(g, correctTo, { correction: true, note: correctNote.trim() });
            if (!ok) throw new Error('failed');
          }}
        >
          <div className="flex flex-col gap-4">
            <Field label="Correct status">
              <Select value={correctTo} onChange={(e) => setCorrectTo(e.target.value as ShipmentStatus)}>
                {SHIPMENT_FLOW.filter((s) => s !== g.status).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reason" hint="Required. Shown in the timeline.">
              <Textarea value={correctNote} onChange={(e) => setCorrectNote(e.target.value)} rows={2} maxLength={500} />
            </Field>
          </div>
        </ConfirmDialog>
      )}

      {g && (
        <ConfirmDialog
          open={undoCheckIn}
          title="Undo the China check-in?"
          description={g.itemName}
          confirmLabel="Undo check-in"
          tone="danger"
          onClose={() => setUndoCheckIn(false)}
          onConfirm={async () => {
            const res = await actions.setCheckIn(g, false);
            if (!res) throw new Error('failed');
          }}
        >
          <p className="text-[13px] text-ink-2">The original check-in stays in the history.</p>
        </ConfirmDialog>
      )}
    </>
  );
}
