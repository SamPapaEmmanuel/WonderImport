import { EMPTY_FILTERS, toQueryString, type GoodsFilters } from '@/features/goods/filters';
import type { DashboardSummary } from '@/lib/types';

/**
 * Builds a Goods link for the dashboard period plus extra filters.
 * Uses the period's resolved dates (from the API), so the list adds up to the figure that linked to it.
 */
export function goodsHref(period: DashboardSummary['period'], extra: Partial<GoodsFilters> = {}) {
  const qs = toQueryString({ ...EMPTY_FILTERS, orderedFrom: period.from ?? '', orderedTo: period.to ?? '', ...extra });
  return qs ? `/goods?${qs}` : '/goods';
}
