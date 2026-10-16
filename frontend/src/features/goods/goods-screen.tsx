'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import type { SortState } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Panel } from '@/components/ui/panel';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { count } from '@/lib/format';
import { can } from '@/lib/roles';
import type { Good, Paginated } from '@/lib/types';
import { useRequest } from '@/lib/use-request';
import { useSessionStore } from '@/stores/session-store';
import { goodsApi } from './api';
import { activeFilterCount, EMPTY_FILTERS, parseFilters, toQueryString, type GoodsFilters } from './filters';
import { GoodFormDrawer, type GoodFormMode } from './good-form-drawer';
import { GoodsTable } from './goods-table';
import { GoodsToolbar } from './goods-toolbar';
import { useGoodsSession } from './goods-session-store';
import { useGoodsActions } from './use-goods-actions';
import { ExportButton } from '@/features/exports/export-button';

/**
 * Goods workspace. The URL is the source of truth for filters, sorting, and paging,
 * so any view can be bookmarked or shared, and Back behaves as expected.
 */
export function GoodsScreen() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const role = useSessionStore((s) => s.me?.role);
  const editable = can.editGoods(role);

  const filters = useMemo(() => parseFilters(new URLSearchParams(sp.toString())), [sp]);
  const apiQuery = toQueryString(filters);
  const [form, setForm] = useState<GoodFormMode | null>(null);

  // Restore this session's last filters when Goods is opened without any.
  const { lastQuery, setLastQuery } = useGoodsSession();
  useEffect(() => {
    if (!sp.toString() && lastQuery) router.replace(`${pathname}?${lastQuery}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => setLastQuery(apiQuery), [apiQuery, setLastQuery]);

  const list = useRequest(() => goodsApi.list(apiQuery), [apiQuery]);

  const navigate = useCallback(
    (next: GoodsFilters) => {
      const s = toQueryString(next);
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  // "Add good" links from elsewhere (e.g. the dashboard) arrive as ?new=1.
  useEffect(() => {
    if (sp.get('new') === '1') {
      if (editable) setForm({ mode: 'create' });
      navigate(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const setFilters = (patch: Partial<GoodsFilters>) => {
    const resetsPage = !('page' in patch);
    navigate({ ...filters, ...patch, page: resetsPage ? 1 : (patch.page ?? 1) });
  };

  const applyLocal = (id: string, patch: Partial<Good>) =>
    list.mutate((d) => (d ? ({ ...d, data: d.data.map((g) => (g.id === id ? { ...g, ...patch } : g)) } as Paginated<Good>) : d));

  const actions = useGoodsActions({
    applyLocal,
    onChanged: (g) => (g.archivedAt && filters.archived === 'exclude' ? void list.reload() : applyLocal(g.id, g)),
    onDuplicated: () => void list.reload(),
    onStale: () => void list.reload(),
  });

  const [sortKey, sortDir] = filters.sort.split(':') as [string, 'asc' | 'desc'];
  const sort: SortState = { key: sortKey, dir: sortDir };
  const meta = list.data?.meta;
  const filtered = activeFilterCount(filters) > 0;
  // The export takes the same filters and sort as the table, without paging.
  const exportQuery = toQueryString({ ...filters, page: 1, pageSize: 25 });

  return (
    <>
      <PageHeader
        title="Goods"
        description={meta ? `${count(meta.total)} ${filtered ? 'matching' : filters.archived === 'only' ? 'archived' : 'recorded'} ${meta.total === 1 ? 'good' : 'goods'}` : 'Every item from order to delivery.'}
        actions={
          <>
            {can.importExport(role) && meta && meta.total > 0 && (
              <ExportButton path={`/exports/goods${exportQuery ? `?${exportQuery}` : ''}`} fallbackName="wonderimport-goods.xlsx" label={`Export ${count(meta.total)}`} />
            )}
            {editable && (
              <Button variant="primary" onClick={() => setForm({ mode: 'create' })}>
                <Plus className="size-4" aria-hidden /> Add good
              </Button>
            )}
          </>
        }
      />

      <Panel>
        <GoodsToolbar filters={filters} onChange={setFilters} />
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <GoodsTable
            rows={list.data?.data ?? []}
            loading={list.loading}
            editable={editable}
            sort={sort}
            onSortChange={(s) => setFilters({ sort: `${s.key}:${s.dir}` })}
            onEdit={(g) => setForm({ mode: 'edit', good: g })}
            onAdvance={actions.advance}
            onCheckIn={(g) => void actions.setCheckIn(g, true)}
            onDuplicate={(g) => void actions.duplicate(g)}
            onArchive={actions.archive}
            onRestore={(g) => void actions.restore(g)}
            empty={
              filtered ? (
                <EmptyState title="No goods match these filters" action={<Button size="sm" onClick={() => navigate({ ...EMPTY_FILTERS, sort: filters.sort, pageSize: filters.pageSize })}>Clear filters</Button>}>
                  Try fewer statuses, a wider date range, or a shorter search.
                </EmptyState>
              ) : (
                <EmptyState title="No goods recorded yet" action={editable && <Button size="sm" variant="primary" onClick={() => setForm({ mode: 'create' })}>Add the first good</Button>}>
                  Add goods one at a time here. Spreadsheet import arrives in Phase 4.
                </EmptyState>
              )
            }
          />
        )}
        {meta && meta.total > 0 && (
          <Pagination
            page={meta.page}
            pageSize={meta.pageSize}
            total={meta.total}
            noun={['good', 'goods']}
            onPage={(page) => setFilters({ page })}
            onPageSize={(pageSize) => setFilters({ pageSize })}
          />
        )}
      </Panel>

      {actions.dialogs}

      <GoodFormDrawer
        state={form}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          void list.reload();
        }}
      />
    </>
  );
}
