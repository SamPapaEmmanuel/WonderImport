'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Archive, ArchiveRestore, MoreHorizontal, Package, Pencil, Plus, Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type Column, type SortState } from '@/components/ui/data-table';
import { Menu, type MenuItem } from '@/components/ui/menu';
import { Pagination } from '@/components/ui/pagination';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { ApiError } from '@/lib/api-error';
import { count, ghs, percent } from '@/lib/format';
import { can } from '@/lib/roles';
import type { Client } from '@/lib/types';
import { useRequest } from '@/lib/use-request';
import { refreshLookups } from '@/features/lookups/use-lookups';
import { useSessionStore } from '@/stores/session-store';
import { toast } from '@/stores/toast-store';
import { clientsApi } from './api';
import { ClientFormDialog } from './client-form-dialog';
import { ExportButton } from '@/features/exports/export-button';

export function ClientsScreen() {
  const role = useSessionStore((s) => s.me?.role);
  const editable = can.editGoods(role);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState<'exclude' | 'only' | 'include'>('exclude');
  const initialSort = useSearchParams().get('sort') ?? '';
  const [sort, setSort] = useState<SortState>(() => {
    const [key, dir] = initialSort.split(':');
    return ['name', 'code', 'goods', 'revenue', 'profit', 'margin'].includes(key) && (dir === 'asc' || dir === 'desc') ? { key, dir } : { key: 'name', dir: 'asc' };
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState<{ mode: 'create' } | { mode: 'edit'; client: Client } | null>(null);
  const [archiving, setArchiving] = useState<Client | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: `${sort.key}:${sort.dir}`, archived, ...(search ? { q: search } : {}) }).toString();
  const list = useRequest(() => clientsApi.list(query), [query]);

  async function restore(c: Client) {
    try {
      await clientsApi.restore(c.id);
      void refreshLookups();
      void list.reload();
      toast.success(`${c.name} restored`);
    } catch (e) {
      toast.error('Could not restore', ApiError.from(e).message);
    }
  }

  const columns: Column<Client>[] = [
    { key: 'code', header: 'Code', sortKey: 'code', cell: (c) => <span className="font-mono text-xs text-ink-2">{c.code}</span> },
    {
      key: 'name',
      header: 'Name',
      sortKey: 'name',
      cell: (c) => (
        <span className="font-medium">
          {c.name}
          {c.isStock && <span className="ml-2 text-xs font-normal text-ink-3">System client for goods with no buyer</span>}
          {c.archivedAt && <span className="ml-2 text-xs font-normal text-ink-3">Archived</span>}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (c) => <span className="text-ink-2">{c.phone ?? c.email ?? <span className="text-ink-3">—</span>}</span>,
    },
    {
      key: 'goods',
      header: 'Goods',
      sortKey: 'goods',
      align: 'right',
      cell: (c) =>
        c.summary.goods > 0 ? (
          <Link href={`/goods?clientId=${c.id}`} className="font-medium text-fjord hover:underline" onClick={(e) => e.stopPropagation()}>
            {count(c.summary.goods)}
          </Link>
        ) : (
          <span className="text-ink-3">0</span>
        ),
    },
    {
      key: 'progress',
      header: 'Delivered / in progress',
      align: 'right',
      cell: (c) => (
        <span className="text-ink-2">
          {count(c.summary.delivered)} / {count(c.summary.inProgress)}
        </span>
      ),
    },
    { key: 'revenue', header: 'Revenue', sortKey: 'revenue', align: 'right', cell: (c) => ghs(c.summary.revenue, { symbol: false }) },
    { key: 'cost', header: 'Landed cost', align: 'right', cell: (c) => <span className="text-ink-2">{ghs(c.summary.landedCost, { symbol: false })}</span> },
    {
      key: 'profit',
      header: 'Profit',
      sortKey: 'profit',
      align: 'right',
      cell: (c) => <span className={Number(c.summary.profit) < 0 ? 'text-rose' : c.summary.goods ? 'text-mint' : 'text-ink-3'}>{ghs(c.summary.profit, { symbol: false })}</span>,
    },
    { key: 'margin', header: 'Margin', sortKey: 'margin', align: 'right', cell: (c) => <span className="text-ink-2">{percent(c.summary.margin)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-10 pr-2',
      cell: (c) => {
        const items: (MenuItem | 'separator')[] = [{ label: 'Open client', icon: <Users className="size-4" />, onSelect: () => router.push(`/clients/${c.id}`) }, { label: 'View their goods', icon: <Package className="size-4" />, onSelect: () => router.push(`/goods?clientId=${c.id}`) }];
        if (editable && !c.archivedAt) {
          items.push({ label: 'Edit', icon: <Pencil className="size-4" />, onSelect: () => setForm({ mode: 'edit', client: c }) });
          if (!c.isStock) items.push('separator', { label: 'Archive', tone: 'danger', icon: <Archive className="size-4" />, onSelect: () => setArchiving(c) });
        }
        if (editable && c.archivedAt) items.push({ label: 'Restore', icon: <ArchiveRestore className="size-4" />, onSelect: () => void restore(c) });
        return (
          <Menu
            items={items}
            trigger={(props) => (
              <button
                type="button"
                {...props}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onClick();
                }}
                className="rounded-md p-1.5 text-ink-3 hover:bg-glacier hover:text-ink" aria-label={`Actions for ${c.name}`}>
                <MoreHorizontal className="size-4" />
              </button>
            )}
          />
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Clients"
        description="Who each good is for, and what each client contributes. Totals cover all their active goods."
        actions={
          <>
            {can.importExport(role) && (
              <ExportButton
                path={`/exports/clients?${new URLSearchParams({ archived, sort: `${sort.key}:${sort.dir}`, ...(search ? { q: search } : {}) })}`}
                fallbackName="wonderimport-clients.xlsx"
              />
            )}
            {editable && (
              <Button variant="primary" onClick={() => setForm({ mode: 'create' })}>
                <Plus className="size-4" aria-hidden /> Add client
              </Button>
            )}
          </>
        }
      />
      <Panel>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line-soft px-[18px] py-3.5">
          <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-control border border-line px-3 text-ink-3 focus-within:border-tide focus-within:ring-2 focus-within:ring-tide/30 sm:max-w-[340px]">
            <Search className="size-4" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, code, phone or email" aria-label="Search clients" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3" />
          </label>
          <div className="w-44">
            <Select
              value={archived}
              aria-label="Archived clients"
              onChange={(e) => {
                setArchived(e.target.value as typeof archived);
                setPage(1);
              }}
            >
              <option value="exclude">Active clients</option>
              <option value="only">Archived only</option>
              <option value="include">All clients</option>
            </Select>
          </div>
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <DataTable
            caption="Clients"
            columns={columns}
            rows={list.data?.data ?? []}
            rowKey={(c) => c.id}
            loading={list.loading}
            sort={sort}
            onSortChange={(s) => {
              setSort(s);
              setPage(1);
            }}
            onRowClick={(c) => router.push(`/clients/${c.id}`)}
            empty={
              search ? (
                <EmptyState title={`No clients match “${search}”`}>Check the spelling, or search by phone number or client code.</EmptyState>
              ) : (
                <EmptyState title="No clients here" action={editable && <Button size="sm" variant="primary" onClick={() => setForm({ mode: 'create' })}>Add client</Button>} />
              )
            }
          />
        )}
        {list.data && list.data.meta.total > 0 && (
          <Pagination
            page={list.data.meta.page}
            pageSize={list.data.meta.pageSize}
            total={list.data.meta.total}
            noun={['client', 'clients']}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        )}
      </Panel>

      <ClientFormDialog
        state={form}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          void list.reload();
        }}
      />

      <ConfirmDialog
        open={!!archiving}
        title={`Archive ${archiving?.name ?? ''}?`}
        description="Their goods and history are kept. Archived clients can't be chosen for new goods."
        confirmLabel="Archive client"
        tone="danger"
        onClose={() => setArchiving(null)}
        onConfirm={async () => {
          try {
            await clientsApi.archive(archiving!.id);
            void refreshLookups();
            void list.reload();
            toast.success(`${archiving!.name} archived`);
          } catch (e) {
            toast.error('Could not archive', ApiError.from(e).message);
            throw e;
          }
        }}
      />
    </>
  );
}
