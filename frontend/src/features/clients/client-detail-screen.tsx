'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Archive, ArchiveRestore, ChevronLeft, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { KpiBand, MoneyFigure } from '@/components/ui/kpi-band';
import { Notice } from '@/components/ui/notice';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { ShippingRoute } from '@/components/ui/shipping-route';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { ApiError } from '@/lib/api-error';
import { count, dateTime, percent } from '@/lib/format';
import { can } from '@/lib/roles';
import { SHIPMENT_FLOW } from '@/lib/status';
import { useRequest } from '@/lib/use-request';
import { CompactGoodsTable } from '@/features/goods/compact-goods-table';
import { goodsApi } from '@/features/goods/api';
import { refreshLookups } from '@/features/lookups/use-lookups';
import { useSessionStore } from '@/stores/session-store';
import { toast } from '@/stores/toast-store';
import { clientsApi } from './api';
import { ClientFormDialog } from './client-form-dialog';

const RECENT = 10;

export function ClientDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const editable = can.editGoods(useSessionStore((s) => s.me?.role));
  const client = useRequest(() => clientsApi.get(id), [id]);
  const goods = useRequest(() => goodsApi.list(`clientId=${id}&pageSize=${RECENT}&sort=updatedAt:desc`), [id]);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const back = (
    <Link href="/clients" className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
      <ChevronLeft className="size-4" aria-hidden /> Clients
    </Link>
  );

  if (client.error) {
    return (
      <>
        {back}
        <Panel>
          {client.error.code === 'NOT_FOUND' ? (
            <EmptyState title="This client does not exist" action={<Button size="sm" onClick={() => router.push('/clients')}>Back to clients</Button>}>
              The link may be out of date.
            </EmptyState>
          ) : (
            <ErrorState error={client.error} onRetry={client.reload} />
          )}
        </Panel>
      </>
    );
  }

  const c = client.data;
  if (!c) {
    return (
      <>
        {back}
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[92px] w-full rounded-panel" />
        <Skeleton className="h-[220px] w-full rounded-panel" />
      </>
    );
  }

  const s = c.summary;
  const goodsLink = (extra = '') => `/goods?clientId=${c.id}${extra}`;

  async function restore() {
    try {
      await clientsApi.restore(c!.id);
      void refreshLookups();
      void client.reload();
      toast.success(`${c!.name} restored`);
    } catch (e) {
      toast.error('Could not restore', ApiError.from(e).message);
    }
  }

  return (
    <>
      {back}
      <PageHeader
        title={c.name}
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-mono text-[13px]">{c.code}</span>
            {c.isStock && <span>System client for goods bought as stock</span>}
            {c.phone && <span>{c.phone}</span>}
            {c.email && <span>{c.email}</span>}
          </span>
        }
        actions={
          editable &&
          (c.archivedAt ? (
            <Button onClick={() => void restore()}>
              <ArchiveRestore className="size-4" aria-hidden /> Restore
            </Button>
          ) : (
            <>
              {!c.isStock && (
                <Button variant="ghost" onClick={() => setArchiving(true)}>
                  <Archive className="size-4" aria-hidden /> Archive
                </Button>
              )}
              <Button onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden /> Edit details
              </Button>
            </>
          ))
        }
      />

      {c.archivedAt && <Notice tone="warning" title={`Archived ${dateTime(c.archivedAt)}`}>Their goods and history are kept. Restore the client to assign new goods.</Notice>}

      <KpiBand
        items={[
          { label: 'Goods', value: count(s.goods), hint: `${count(s.units)} units`, href: goodsLink() },
          { label: 'Delivered', value: count(s.delivered), hint: `${count(s.inProgress)} in progress`, href: goodsLink('&status=DELIVERED') },
          { label: 'Revenue', value: <MoneyFigure value={s.revenue} />, hint: 'At active selling prices', href: goodsLink('&sort=expectedRevenue:desc') },
          { label: 'Landed cost', value: <MoneyFigure value={s.landedCost} />, hint: 'Qty × unit cost × rate', href: goodsLink('&sort=totalCost:desc') },
          { label: 'Profit', value: <MoneyFigure value={s.profit} tone={Number(s.profit) < 0 ? 'neg' : 'pos'} />, hint: 'Revenue minus landed cost', href: goodsLink('&sort=profit:desc') },
          { label: 'Margin', value: percent(s.margin), hint: 'Profit ÷ revenue', href: goodsLink('&sort=margin:asc') },
        ]}
      />

      <Panel>
        <PanelHeader title="Where their goods are" />
        {s.goods === 0 ? (
          <EmptyState title="No goods for this client yet">Choose this client when adding or editing a good.</EmptyState>
        ) : (
          <ShippingRoute
            stations={SHIPMENT_FLOW.map((st) => ({ status: st, count: s.byStatus[st], href: goodsLink(`&status=${st}`) }))}
            footnote={`${Math.round((s.delivered / s.goods) * 100)}% delivered`}
          />
        )}
      </Panel>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Panel>
          <PanelHeader
            title="Their goods"
            description={goods.data && goods.data.meta.total > RECENT ? `Latest ${RECENT} of ${count(goods.data.meta.total)}` : undefined}
            actions={
              s.goods > 0 && (
                <Link href={goodsLink()} className="text-[13px] font-medium text-fjord hover:underline">
                  Open all in Goods
                </Link>
              )
            }
          />
          {goods.error ? (
            <ErrorState error={goods.error} onRetry={goods.reload} />
          ) : (
            <CompactGoodsTable rows={goods.data?.data ?? []} loading={goods.loading} showClient={false} empty={<EmptyState title="No goods yet" />} />
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Profile" />
          <PanelBody>
            <dl className="grid grid-cols-[90px_1fr] gap-x-4 gap-y-2.5 text-[13px]">
              <dt className="text-ink-3">Phone</dt>
              <dd>{c.phone ?? '—'}</dd>
              <dt className="text-ink-3">Email</dt>
              <dd className="break-all">{c.email ?? '—'}</dd>
              <dt className="text-ink-3">Address</dt>
              <dd>{c.address ?? '—'}</dd>
              <dt className="text-ink-3">Notes</dt>
              <dd className="whitespace-pre-line">{c.notes ?? '—'}</dd>
              <dt className="text-ink-3">Added</dt>
              <dd>{dateTime(c.createdAt)}</dd>
            </dl>
          </PanelBody>
        </Panel>
      </div>

      <ClientFormDialog
        state={editing ? { mode: 'edit', client: c } : null}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void client.reload();
        }}
      />

      <ConfirmDialog
        open={archiving}
        title={`Archive ${c.name}?`}
        description="Their goods and history are kept. Archived clients can't be chosen for new goods."
        confirmLabel="Archive client"
        tone="danger"
        onClose={() => setArchiving(false)}
        onConfirm={async () => {
          try {
            await clientsApi.archive(c.id);
            void refreshLookups();
            void client.reload();
            toast.success(`${c.name} archived`);
          } catch (e) {
            toast.error('Could not archive', ApiError.from(e).message);
            throw e;
          }
        }}
      />
    </>
  );
}
