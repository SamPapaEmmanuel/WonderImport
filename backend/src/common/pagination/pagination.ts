import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export class PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}

export interface Paginated<T, F = Record<string, unknown>> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
  context: { filters: F; sort?: string };
}

export function paginate<T, F>(data: T[], total: number, q: PaginationQuery, filters: F, sort?: string): Paginated<T, F> {
  return {
    data,
    meta: { page: q.page, pageSize: q.pageSize, total, pageCount: Math.max(1, Math.ceil(total / q.pageSize)) },
    context: { filters, sort },
  };
}

export function skipTake(q: PaginationQuery) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}
