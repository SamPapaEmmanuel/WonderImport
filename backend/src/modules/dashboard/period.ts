import { toDateOnlyString } from '../../common/validation/decorators';

export const PERIOD_KEYS = ['30d', '90d', 'ytd', 'all'] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number] | 'custom';

export interface Period {
  key: PeriodKey;
  /** Inclusive YYYY-MM-DD bounds on the order date; null means open-ended. */
  from: string | null;
  to: string | null;
  label: string;
}

const LABEL: Record<Exclude<PeriodKey, 'custom'>, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  ytd: 'Year to date',
  all: 'All time',
};

/**
 * Resolves a reporting period on the order date, in Ghana time (UTC, no daylight saving).
 * "Last 30 days" includes today, so it covers today and the 29 days before.
 */
export function resolvePeriod(key: PeriodKey = 'all', custom: { from?: string; to?: string } = {}, now = new Date()): Period {
  if (custom.from || custom.to) {
    return { key: 'custom', from: custom.from ?? null, to: custom.to ?? null, label: 'Custom range' };
  }
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysBack = (n: number) => toDateOnlyString(new Date(today.getTime() - n * 86_400_000));
  const k = key === 'custom' ? 'all' : key;
  switch (k) {
    case '30d':
      return { key: k, from: daysBack(29), to: toDateOnlyString(today), label: LABEL[k] };
    case '90d':
      return { key: k, from: daysBack(89), to: toDateOnlyString(today), label: LABEL[k] };
    case 'ytd':
      return { key: k, from: `${today.getUTCFullYear()}-01-01`, to: toDateOnlyString(today), label: LABEL[k] };
    default:
      return { key: 'all', from: null, to: null, label: LABEL.all };
  }
}
