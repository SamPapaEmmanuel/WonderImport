import type { ShipmentStatus } from '@/lib/types';
import { SHIPMENT_FLOW } from '@/lib/status';

/**
 * The goods filter contract, mirrored from the API (GoodsFilterQuery).
 * The URL holds these exact keys, and the same query string is sent to the API,
 * so a shared link, the table and (in Phase 4) the export always agree.
 */
export interface GoodsFilters {
  q: string;
  status: ShipmentStatus[];
  checkIn: '' | 'yes' | 'no' | 'missing';
  clientId: string;
  supplierId: string;
  categoryId: string;
  orderedFrom: string;
  orderedTo: string;
  priceOverridden: '' | 'true' | 'false';
  archived: 'exclude' | 'only' | 'include';
  sort: string;
  page: number;
  pageSize: number;
}

export const DEFAULT_SORT = 'updatedAt:desc';

export const EMPTY_FILTERS: GoodsFilters = {
  q: '',
  status: [],
  checkIn: '',
  clientId: '',
  supplierId: '',
  categoryId: '',
  orderedFrom: '',
  orderedTo: '',
  priceOverridden: '',
  archived: 'exclude',
  sort: DEFAULT_SORT,
  page: 1,
  pageSize: 25,
};

/** Keys that change which goods are shown (everything except paging, sort and the open drawer). */
export const FILTER_KEYS = ['q', 'status', 'checkIn', 'clientId', 'supplierId', 'categoryId', 'orderedFrom', 'orderedTo', 'priceOverridden', 'archived'] as const;

const oneOf = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T => (v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);

export function parseFilters(sp: URLSearchParams): GoodsFilters {
  const status = sp
    .getAll('status')
    .flatMap((s) => s.split(','))
    .filter((s): s is ShipmentStatus => (SHIPMENT_FLOW as string[]).includes(s));
  const page = Number.parseInt(sp.get('page') ?? '', 10);
  const pageSize = Number.parseInt(sp.get('pageSize') ?? '', 10);
  return {
    q: sp.get('q') ?? '',
    status,
    checkIn: oneOf(sp.get('checkIn'), ['', 'yes', 'no', 'missing'] as const, ''),
    clientId: sp.get('clientId') ?? '',
    supplierId: sp.get('supplierId') ?? '',
    categoryId: sp.get('categoryId') ?? '',
    orderedFrom: sp.get('orderedFrom') ?? '',
    orderedTo: sp.get('orderedTo') ?? '',
    priceOverridden: oneOf(sp.get('priceOverridden'), ['', 'true', 'false'] as const, ''),
    archived: oneOf(sp.get('archived'), ['exclude', 'only', 'include'] as const, 'exclude'),
    sort: /^[a-zA-Z]+:(asc|desc)$/.test(sp.get('sort') ?? '') ? sp.get('sort')! : DEFAULT_SORT,
    page: page > 0 ? page : 1,
    pageSize: [25, 50, 100].includes(pageSize) ? pageSize : 25,
  };
}

/** Serialises only non-default values, so URLs stay short and readable. */
export function toQueryString(f: GoodsFilters): string {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set('q', f.q.trim());
  f.status.forEach((s) => sp.append('status', s));
  for (const k of ['checkIn', 'clientId', 'supplierId', 'categoryId', 'orderedFrom', 'orderedTo', 'priceOverridden'] as const) {
    if (f[k]) sp.set(k, f[k]);
  }
  if (f.archived !== 'exclude') sp.set('archived', f.archived);
  if (f.sort !== DEFAULT_SORT) sp.set('sort', f.sort);
  if (f.page > 1) sp.set('page', String(f.page));
  if (f.pageSize !== 25) sp.set('pageSize', String(f.pageSize));
  return sp.toString();
}

export function activeFilterCount(f: GoodsFilters) {
  return FILTER_KEYS.reduce((n, k) => {
    const v = f[k];
    if (k === 'archived') return n + (v !== 'exclude' ? 1 : 0);
    return n + (Array.isArray(v) ? (v.length ? 1 : 0) : v ? 1 : 0);
  }, 0);
}
