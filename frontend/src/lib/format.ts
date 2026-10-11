const LOCALE = 'en-GH';

const money2 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type Num = string | number | null | undefined;

/** Display-only rounding. Amounts arrive from the API as exact decimal strings. */
const toNumber = (v: Num) => (v === null || v === undefined || v === '' ? null : Number(v));

export function ghs(v: Num, opts: { symbol?: boolean } = {}) {
  const n = toNumber(v);
  if (n === null || Number.isNaN(n)) return '—';
  const s = money2.format(n);
  return opts.symbol === false ? s : `GHS ${s}`;
}

/** Whole cedis, for compact summaries (e.g. route stations). */
export function ghsWhole(v: Num) {
  const n = toNumber(v);
  return n === null || Number.isNaN(n) ? '—' : `GHS ${int.format(Math.round(n))}`;
}

export function cny(v: Num) {
  const n = toNumber(v);
  return n === null || Number.isNaN(n) ? '—' : `¥${money2.format(n)}`;
}

export function count(v: Num) {
  const n = toNumber(v);
  return n === null || Number.isNaN(n) ? '—' : int.format(n);
}

export function percent(v: Num) {
  const n = toNumber(v);
  return n === null || Number.isNaN(n) ? '—' : `${n.toFixed(1)}%`;
}

export function date(v: string | Date | null | undefined) {
  return v ? dateFmt.format(new Date(v)) : '—';
}

export function dateTime(v: string | Date | null | undefined) {
  return v ? dateTimeFmt.format(new Date(v)) : '—';
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
