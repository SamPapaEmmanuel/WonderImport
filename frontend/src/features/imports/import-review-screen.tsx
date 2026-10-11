'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type Column } from '@/components/ui/data-table';
import { KpiBand } from '@/components/ui/kpi-band';
import { Notice } from '@/components/ui/notice';
import { Pagination } from '@/components/ui/pagination';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { ApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { cny, count, dateTime, ghs } from '@/lib/format';
import type { ImportBatchDetail, ImportRow, RowMessage } from '@/lib/types';
import { useRequest } from '@/lib/use-request';
import { useLookups } from '@/features/lookups/use-lookups';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { can } from '@/lib/roles';
import { useSessionStore } from '@/stores/session-store';
import { toast } from '@/stores/toast-store';
import { importsApi } from './api';
import { BatchStatusBadge } from './batch-status';

const PAGE = 100;
const DUPLICATE_CODES = ['duplicate_in_file', 'duplicate_existing'];

const FIELD_LABEL: Record<string, string> = {
  itemName: 'Item name', trackingNumber: 'Tracking number', quantity: 'Quantity', quantitySold: 'Quantity sold', unitCost: 'Unit cost',
  exchangeRate: 'Exchange rate', sellingPrice: 'Selling price', overrideReason: 'Price reason', retailPrice: 'Retail price', client: 'Client',
  supplier: 'Supplier', category: 'Category', status: 'Status', chinaCheckedIn: 'China check-in', orderedAt: 'Ordered date', notes: 'Notes',
};

type Tab = 'all' | 'ready' | 'warnings' | 'invalid' | 'committed' | 'skipped';

const selectable = (r: ImportRow) => r.state === 'VALID' || r.state === 'WARNING';
const preselected = (r: ImportRow) => r.state === 'VALID' || (r.state === 'WARNING' && !r.messages.some((m) => DUPLICATE_CODES.includes(m.code)));

function Messages({ messages }: { messages: RowMessage[] }) {
  if (!messages.length) return <span className="text-xs text-mint">Ready</span>;
  return (
    <ul className="flex max-w-[380px] flex-col gap-0.5 whitespace-normal">
      {messages.map((m, i) => (
        <li key={i} className={cn('text-xs leading-snug', m.level === 'error' ? 'text-rose' : m.level === 'warning' ? 'text-amber' : 'text-ink-3')}>
          {m.message}
        </li>
      ))}
    </ul>
  );
}

function Mapping({ batch }: { batch: ImportBatchDetail }) {
  const { data: lookups } = useLookups();
  const o = batch.options;
  if (!o) return null;
  const name = (list: { id: string; name: string }[] | undefined, id?: string | null) => (id ? (list?.find((x) => x.id === id)?.name ?? 'a removed record') : null);
  const defaults = [
    name(lookups?.clients, o.defaults.clientId) && `client ${name(lookups?.clients, o.defaults.clientId)}`,
    name(lookups?.suppliers, o.defaults.supplierId) && `supplier ${name(lookups?.suppliers, o.defaults.supplierId)}`,
    name(lookups?.categories, o.defaults.categoryId) && `category ${name(lookups?.categories, o.defaults.categoryId)}`,
    `rate ${o.defaults.exchangeRate}`,
  ].filter(Boolean);
  return (
    <details className="rounded-panel border border-line bg-surface px-[18px] py-3 text-[13px]">
      <summary className="cursor-pointer font-medium">How the file was read</summary>
      <div className="mt-2 flex flex-col gap-1.5 text-ink-2">
        <p>
          {o.sheetName ? `Sheet "${o.sheetName}", ` : ''}headers on row {o.headerRow}.
        </p>
        <p>
          <span className="text-ink-3">Columns used: </span>
          {o.mapping.map((m) => `${m.header.trim()} → ${FIELD_LABEL[m.field] ?? m.field}`).join(', ')}
        </p>
        {o.ignoredColumns.length > 0 && (
          <p>
            <span className="text-ink-3">Ignored: </span>
            {o.ignoredColumns.map((c) => c.trim()).join(', ')}
            <span className="text-ink-3"> (calculated by WonderImport or not needed)</span>
          </p>
        )}
        <p>
          <span className="text-ink-3">Defaults for empty cells: </span>
          {defaults.join(', ')}
        </p>
      </div>
    </details>
  );
}

export function ImportReviewScreen({ id }: { id: string }) {
  const req = useRequest(() => importsApi.get(id), [id]);
  const batch = req.data;
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [failedOnCommit, setFailedOnCommit] = useState<{ rowNumber: number; messages: RowMessage[] }[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const isAdmin = can.manageSettings(useSessionStore((s) => s.me?.role));
  const [undoing, setUndoing] = useState(false);
  const [undoReason, setUndoReason] = useState('');

  useEffect(() => {
    if (batch?.status === 'READY') setSelected(new Set(batch.rows.filter(preselected).map((r) => r.rowNumber)));
  }, [batch?.id, batch?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = batch?.rows ?? [];
  const tabRows = useMemo(() => {
    const by: Record<Tab, (r: ImportRow) => boolean> = {
      all: () => true,
      ready: (r) => r.state === 'VALID',
      warnings: (r) => r.state === 'WARNING',
      invalid: (r) => r.state === 'INVALID',
      committed: (r) => r.state === 'COMMITTED',
      skipped: (r) => r.state === 'SKIPPED',
    };
    return rows.filter(by[tab]);
  }, [rows, tab]);
  const pageRows = tabRows.slice((page - 1) * PAGE, page * PAGE);

  const totals = useMemo(() => {
    let cost = 0, revenue = 0, profit = 0, n = 0;
    for (const r of rows) {
      if (!selected.has(r.rowNumber) || !r.parsed) continue;
      n++;
      cost += Number(r.parsed.financials.totalCost);
      revenue += Number(r.parsed.financials.expectedRevenue);
      profit += Number(r.parsed.financials.profit);
    }
    return { n, cost, revenue, profit };
  }, [rows, selected]);

  if (req.error) {
    return (
      <Panel>
        <ErrorState error={req.error} onRetry={req.reload} />
      </Panel>
    );
  }
  if (!batch) {
    return (
      <>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-[92px] w-full rounded-panel" />
        <Skeleton className="h-[400px] w-full rounded-panel" />
      </>
    );
  }

  const open = batch.status === 'READY';
  const toggle = (n: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  const tabSelectable = tabRows.filter(selectable);
  const allTabSelected = tabSelectable.length > 0 && tabSelectable.every((r) => selected.has(r.rowNumber));
  const toggleTab = () =>
    setSelected((s) => {
      const next = new Set(s);
      tabSelectable.forEach((r) => (allTabSelected ? next.delete(r.rowNumber) : next.add(r.rowNumber)));
      return next;
    });

  async function commit() {
    try {
      const res = await importsApi.commit(id, [...selected].sort((a, b) => a - b));
      req.mutate(() => res.data);
      setFailedOnCommit(res.failedOnCommit);
      setTab('all');
      toast.success(`${count(res.data.committedRows)} goods imported`, res.failedOnCommit.length ? `${res.failedOnCommit.length} rows were no longer valid and were not imported.` : undefined);
    } catch (e) {
      toast.error('Import not completed', ApiError.from(e).message);
      void req.reload();
      throw e;
    }
  }

  async function cancel() {
    setCancelling(true);
    try {
      const res = await importsApi.cancel(id);
      req.mutate(() => res);
      toast.info('Import cancelled', 'Nothing was saved.');
    } catch (e) {
      toast.error('Could not cancel', ApiError.from(e).message);
      void req.reload();
    } finally {
      setCancelling(false);
    }
  }

  const columns: Column<ImportRow>[] = [
    ...(open
      ? [
          {
            key: 'select',
            header: (
              <input type="checkbox" checked={allTabSelected} onChange={toggleTab} disabled={!tabSelectable.length} aria-label="Select all rows in this view" className="size-4 accent-[var(--fjord)]" />
            ),
            className: 'w-8',
            cell: (r: ImportRow) =>
              selectable(r) ? (
                <input type="checkbox" checked={selected.has(r.rowNumber)} onChange={() => toggle(r.rowNumber)} aria-label={`Import row ${r.rowNumber}`} className="size-4 accent-[var(--fjord)]" />
              ) : null,
          } satisfies Column<ImportRow>,
        ]
      : []),
    { key: 'row', header: 'Row', align: 'right', cell: (r) => <span className="text-ink-3">{r.rowNumber}</span> },
    {
      key: 'item',
      header: 'Item and tracking number',
      cell: (r) => (
        <div className="max-w-[240px]">
          <p className="truncate font-medium" title={String(r.parsed?.itemName ?? r.raw.itemName ?? '')}>
            {r.parsed?.itemName ?? r.raw.itemName ?? <span className="text-rose">No item name</span>}
          </p>
          <p className="truncate font-mono text-[11.5px] text-ink-3">{r.parsed?.trackingNumber ?? (r.raw.trackingNumber != null ? String(r.raw.trackingNumber) : '')}</p>
        </div>
      ),
    },
    { key: 'client', header: 'Client', cell: (r) => <span className="text-ink-2">{r.parsed?.display.client ?? (r.raw.client != null ? String(r.raw.client) : '—')}</span> },
    { key: 'qty', header: 'Qty', align: 'right', cell: (r) => r.parsed?.quantity ?? (r.raw.quantity != null ? String(r.raw.quantity) : '—') },
    { key: 'cost', header: 'Unit cost', align: 'right', cell: (r) => (r.parsed ? cny(r.parsed.unitCost) : r.raw.unitCost != null ? String(r.raw.unitCost) : '—') },
    {
      key: 'price',
      header: 'Price / unit',
      align: 'right',
      cell: (r) =>
        r.parsed ? (
          <span title={r.parsed.financials.priceOverridden ? `From the file. Suggested ${ghs(r.parsed.financials.suggestedPrice)}` : 'Suggested (cost × rate × 3)'}>
            {ghs(r.parsed.financials.sellingPrice, { symbol: false })}
            {r.parsed.financials.priceOverridden && <span className="ml-1 rounded bg-glacier px-1 text-[10.5px] font-semibold text-tide">M</span>}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'profit',
      header: 'Profit',
      align: 'right',
      cell: (r) => (r.parsed ? <span className={Number(r.parsed.financials.profit) < 0 ? 'text-rose' : 'text-mint'}>{ghs(r.parsed.financials.profit, { symbol: false })}</span> : '—'),
    },
    { key: 'status', header: 'Status', cell: (r) => (r.parsed ? <StatusBadge status={r.parsed.status} /> : null) },
    {
      key: 'messages',
      header: 'Check',
      cell: (r) =>
        r.state === 'COMMITTED' ? (
          r.goodId ? (
            <Link href={`/goods?good=${r.goodId}`} className="text-xs font-medium text-fjord hover:underline">
              Imported, open good
            </Link>
          ) : (
            <span className="text-xs text-mint">Imported</span>
          )
        ) : r.state === 'SKIPPED' ? (
          <span className="text-xs text-ink-3">Not selected</span>
        ) : (
          <Messages messages={r.messages} />
        ),
    },
  ];

  const counts = {
    all: rows.length,
    ready: rows.filter((r) => r.state === 'VALID').length,
    warnings: rows.filter((r) => r.state === 'WARNING').length,
    invalid: rows.filter((r) => r.state === 'INVALID').length,
    committed: rows.filter((r) => r.state === 'COMMITTED').length,
    skipped: rows.filter((r) => r.state === 'SKIPPED').length,
  };
  const tabs: [Tab, string][] = open
    ? [['all', 'All'], ['ready', 'Ready'], ['warnings', 'Warnings'], ['invalid', 'Need fixing']]
    : [['all', 'All'], ['committed', 'Imported'], ['skipped', 'Not selected'], ['invalid', 'Not imported']];

  return (
    <>
      <Link href="/imports" className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> Imports
      </Link>
      <PageHeader
        title={batch.fileName}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <BatchStatusBadge status={batch.status} />
            <span>
              Uploaded {dateTime(batch.createdAt)} by {batch.importedBy.name}
              {batch.committedAt ? `, imported ${dateTime(batch.committedAt)}` : ''}
            </span>
          </span>
        }
        actions={
          counts.invalid > 0 && (
            <Button onClick={() => void importsApi.errors(id).catch((e) => toast.error('Download failed', ApiError.from(e).message))}>Download rows to fix</Button>
          )
        }
      />

      <KpiBand
        items={
          open
            ? [
                { label: 'Rows in file', value: count(counts.all) },
                { label: 'Ready', value: count(counts.ready), hint: 'No problems found' },
                { label: 'With warnings', value: count(counts.warnings), hint: 'Possible repeats or missing check-ins' },
                { label: 'Need fixing', value: <span className={counts.invalid ? 'text-rose' : ''}>{count(counts.invalid)}</span>, hint: 'Cannot be imported as they are' },
              ]
            : [
                { label: 'Rows in file', value: count(counts.all) },
                { label: 'Imported', value: <span className="text-mint">{count(counts.committed)}</span> },
                { label: 'Not selected', value: count(counts.skipped) },
                { label: 'Not imported', value: count(counts.invalid), hint: counts.invalid ? 'Download the rows to fix them' : undefined },
              ]
        }
      />

      {batch.status === 'COMMITTED' && (
        <Notice tone="success" title={`${count(batch.committedRows)} goods were added`}>
          <Link href="/goods?sort=createdAt:desc" className="font-medium text-fjord hover:underline">
            See them in Goods
          </Link>
          {failedOnCommit.length > 0 && ` ${failedOnCommit.length} selected rows changed since upload (for example a client was archived) and were not imported; they are listed under "Not imported".`}
          {isAdmin && (
            <span className="mt-2 block">
              Imported the wrong file?{' '}
              <button type="button" onClick={() => setUndoing(true)} className="font-medium text-rose hover:underline">
                Archive the goods from this import
              </button>
            </span>
          )}
        </Notice>
      )}
      {batch.status === 'CANCELLED' && <Notice title="This import was cancelled">Nothing from it was saved. Upload the file again to start over.</Notice>}

      <Mapping batch={batch} />

      <Panel>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line-soft px-[18px] py-3" role="group" aria-label="Show">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => {
                setTab(key);
                setPage(1);
              }}
              className={cn('rounded-md px-3 py-1.5 text-[13px] font-medium', tab === key ? 'bg-glacier text-fjord-strong' : 'text-ink-2 hover:text-ink')}
            >
              {label} <span className="text-ink-3">{count(counts[key])}</span>
            </button>
          ))}
        </div>
        <DataTable
          caption="Import rows"
          columns={columns}
          rows={pageRows}
          rowKey={(r) => String(r.rowNumber)}
          rowClassName={(r) => (r.state === 'INVALID' ? 'bg-rose-bg/40' : undefined)}
          empty={<EmptyState title="No rows in this view" />}
        />
        {tabRows.length > PAGE && <Pagination page={page} pageSize={PAGE} total={tabRows.length} onPage={setPage} noun={['row', 'rows']} />}
      </Panel>

      {open && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] z-10 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-panel border border-line bg-surface px-[18px] py-3 shadow-[0_10px_30px_-18px_rgba(18,40,58,0.45)]">
          <div className="text-[13px]">
            <p className="font-medium">
              {count(totals.n)} of {count(counts.ready + counts.warnings)} importable rows selected
            </p>
            <p className="text-xs text-ink-3">
              Landed cost {ghs(totals.cost)}, revenue {ghs(totals.revenue)}, profit {ghs(totals.profit)}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => void cancel()} loading={cancelling}>
              Cancel import
            </Button>
            <Button variant="primary" disabled={!totals.n} onClick={() => setConfirming(true)}>
              Import {count(totals.n)} {totals.n === 1 ? 'good' : 'goods'}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={undoing}
        title="Archive the goods from this import?"
        description="Every good this import created is archived, including any edited since. They leave lists and totals but keep their history, and each can be restored."
        confirmLabel="Archive goods"
        tone="danger"
        confirmDisabled={undoReason.trim().length < 3}
        onClose={() => setUndoing(false)}
        onConfirm={async () => {
          try {
            const res = await importsApi.archiveGoods(id, undoReason.trim());
            toast.success(`${count(res.archived)} goods archived`, 'Restore any of them from Goods with the Archived filter.');
            setUndoReason('');
          } catch (e) {
            toast.error('Not archived', ApiError.from(e).message);
            throw e;
          }
        }}
      >
        <Field label="Reason" hint="Required. Saved in each good's history.">
          <Textarea value={undoReason} onChange={(e) => setUndoReason(e.target.value)} rows={2} maxLength={500} />
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirming}
        title={`Import ${count(totals.n)} goods?`}
        description="They are added to Goods now. Each one can still be edited or archived afterwards."
        confirmLabel={`Import ${count(totals.n)} goods`}
        onClose={() => setConfirming(false)}
        onConfirm={commit}
      >
        <dl className="grid grid-cols-[130px_1fr] gap-y-1.5 text-[13px]">
          <dt className="text-ink-3">Landed cost</dt>
          <dd>{ghs(totals.cost)}</dd>
          <dt className="text-ink-3">Expected revenue</dt>
          <dd>{ghs(totals.revenue)}</dd>
          <dt className="text-ink-3">Expected profit</dt>
          <dd className="text-mint">{ghs(totals.profit)}</dd>
          <dt className="text-ink-3">Not selected</dt>
          <dd>{count(counts.ready + counts.warnings - totals.n)} rows will be skipped</dd>
        </dl>
      </ConfirmDialog>
    </>
  );
}
