import Decimal from 'decimal.js';

/**
 * Authoritative pricing and profitability rules.
 * See docs/PHASE-0-DECISIONS.md §3 for the rounding points.
 *
 * unitCost      CNY per unit
 * exchangeRate  GHS per 1 CNY
 * all outputs   GHS
 */

export const DEFAULT_PRICE_MULTIPLIER = '3';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
type Num = Decimal.Value;

const money = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export interface PricingInput {
  quantity: number;
  unitCost: Num;
  exchangeRate: Num;
  multiplier?: Num;
  /** Manual selling price per unit in GHS; null/undefined means "use the suggested price". */
  sellingPriceOverride?: Num | null;
}

export interface Financials {
  suggestedPrice: string;
  sellingPrice: string;
  priceOverridden: boolean;
  totalCost: string;
  expectedRevenue: string;
  profit: string;
  /** Percentage with 2 decimals, or null when revenue is zero. */
  margin: string | null;
}

export class PricingError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

function positive(field: string, value: Num): Decimal {
  let d: Decimal;
  try {
    d = new D(value);
  } catch {
    throw new PricingError(field, `${field} must be a number`);
  }
  if (!d.isFinite() || d.lte(0)) throw new PricingError(field, `${field} must be greater than 0`);
  return d;
}

/** unit cost × exchange rate × multiplier, rounded to 2 places. */
export function suggestedUnitPrice(unitCost: Num, exchangeRate: Num, multiplier: Num = DEFAULT_PRICE_MULTIPLIER): string {
  return money(positive('unitCost', unitCost).mul(positive('exchangeRate', exchangeRate)).mul(positive('multiplier', multiplier))).toFixed(2);
}

export function computeFinancials(input: PricingInput): Financials {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new PricingError('quantity', 'quantity must be a whole number of at least 1');
  }
  const qty = new D(input.quantity);
  const unitCost = positive('unitCost', input.unitCost);
  const rate = positive('exchangeRate', input.exchangeRate);
  const multiplier = positive('multiplier', input.multiplier ?? DEFAULT_PRICE_MULTIPLIER);

  const suggested = money(unitCost.mul(rate).mul(multiplier));
  const hasOverride = input.sellingPriceOverride !== null && input.sellingPriceOverride !== undefined && input.sellingPriceOverride !== '';
  const selling = hasOverride ? money(positive('sellingPrice', input.sellingPriceOverride as Num)) : suggested;

  const totalCost = money(qty.mul(unitCost).mul(rate));
  const revenue = money(qty.mul(selling));
  const profit = revenue.minus(totalCost);
  const margin = revenue.isZero() ? null : money(profit.div(revenue).mul(100)).toFixed(2);

  return {
    suggestedPrice: suggested.toFixed(2),
    sellingPrice: selling.toFixed(2),
    priceOverridden: hasOverride && !selling.eq(suggested),
    totalCost: totalCost.toFixed(2),
    expectedRevenue: revenue.toFixed(2),
    profit: profit.toFixed(2),
    margin,
  };
}

/** Margin for aggregated totals (dashboard, client summaries). */
export function marginOf(revenue: Num, profit: Num): string | null {
  const r = new D(revenue);
  if (r.isZero()) return null;
  return money(new D(profit).div(r).mul(100)).toFixed(2);
}
