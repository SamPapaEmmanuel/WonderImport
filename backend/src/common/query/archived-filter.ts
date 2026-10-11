import { IsIn, IsOptional } from 'class-validator';

export const ARCHIVED_FILTERS = ['exclude', 'only', 'include'] as const;
export type ArchivedFilter = (typeof ARCHIVED_FILTERS)[number];

export function archivedWhere(filter: ArchivedFilter = 'exclude') {
  if (filter === 'only') return { archivedAt: { not: null } };
  if (filter === 'include') return {};
  return { archivedAt: null };
}

export class ArchivedQuery {
  @IsOptional()
  @IsIn(ARCHIVED_FILTERS)
  archived: ArchivedFilter = 'exclude';
}
