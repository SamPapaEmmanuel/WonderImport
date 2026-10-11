import { STATUS_LABEL } from '../../common/finance/shipment';
import type { GoodsFilters } from '../goods/goods-query';

export interface NameLookup {
  clients: Map<string, string>;
  suppliers: Map<string, string>;
  categories: Map<string, string>;
}

const CHECK_IN: Record<string, string> = { yes: 'checked in', no: 'not checked in', missing: 'missing (past the warehouse)' };

/** Plain-language description of the filters behind an export, one line each. */
export function describeGoodsFilters(f: GoodsFilters, names: NameLookup): string[] {
  const lines: string[] = [];
  const list = (ids: string[] | undefined, map: Map<string, string>) => (ids ?? []).map((id) => map.get(id) ?? 'unknown').join(', ');
  if (f.q?.trim()) lines.push(`Search: "${f.q.trim()}"`);
  if (f.status?.length) lines.push(`Status: ${f.status.map((s) => STATUS_LABEL[s]).join(', ')}`);
  if (f.checkIn) lines.push(`China check-in: ${CHECK_IN[f.checkIn]}`);
  if (f.clientId?.length) lines.push(`Client: ${list(f.clientId, names.clients)}`);
  if (f.supplierId?.length) lines.push(`Supplier: ${list(f.supplierId, names.suppliers)}`);
  if (f.categoryId?.length) lines.push(`Category: ${list(f.categoryId, names.categories)}`);
  if (f.orderedFrom || f.orderedTo) lines.push(`Ordered: ${f.orderedFrom ?? 'any date'} to ${f.orderedTo ?? 'today'}`);
  if (f.priceOverridden !== undefined) lines.push(`Selling price: ${f.priceOverridden ? 'set manually' : 'suggested (×3)'}`);
  if (f.archived === 'only') lines.push('Archived goods only');
  else if (f.archived === 'include') lines.push('Including archived goods');
  return lines.length ? lines : ['All active goods (no filters)'];
}
