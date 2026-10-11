/**
 * Display-only estimate shown while typing. The API recalculates with exact decimals on save;
 * these numbers are never sent back as financial values.
 */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PreviewInput {
  quantity: string;
  unitCost: string;
  exchangeRate: string;
  multiplier: string;
  override?: string;
}

export interface Preview {
  suggested: number;
  selling: number;
  totalCost: number;
  revenue: number;
  profit: number;
  margin: number | null;
}

export function previewFinancials(i: PreviewInput): Preview | null {
  const q = Number(i.quantity);
  const c = Number(i.unitCost);
  const r = Number(i.exchangeRate);
  const m = Number(i.multiplier || '3');
  if (!(Number.isInteger(q) && q > 0 && c > 0 && r > 0 && m > 0)) return null;
  const suggested = round2(c * r * m);
  const o = Number(i.override);
  const selling = i.override && o > 0 ? round2(o) : suggested;
  const totalCost = round2(q * c * r);
  const revenue = round2(q * selling);
  const profit = round2(revenue - totalCost);
  return { suggested, selling, totalCost, revenue, profit, margin: revenue ? round2((profit / revenue) * 100) : null };
}
