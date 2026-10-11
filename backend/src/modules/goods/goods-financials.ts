import Decimal from 'decimal.js';
import type { FieldError } from '../../common/errors/error-codes';
import { computeFinancials, DEFAULT_PRICE_MULTIPLIER, PricingError } from '../../common/finance/pricing';

/** The financial fields currently stored on a good (null when creating). */
export interface FinancialState {
  quantity: number;
  unitCost: string;
  exchangeRate: string;
  priceMultiplier: string;
  sellingPrice: string;
  priceOverridden: boolean;
  overrideReason: string | null;
}

/** What the request asks to change. `sellingPrice: null` clears an override. */
export interface FinancialPatch {
  quantity?: number;
  unitCost?: string;
  exchangeRate?: string;
  sellingPrice?: string | null;
  overrideReason?: string | null;
}

export type OverrideEvent = 'none' | 'set' | 'changed' | 'cleared';

export interface FinancialPlan {
  columns: {
    quantity: number;
    unitCost: string;
    exchangeRate: string;
    priceMultiplier: string;
    suggestedPrice: string;
    sellingPrice: string;
    priceOverridden: boolean;
    overrideReason: string | null;
    totalCost: string;
    expectedRevenue: string;
    profit: string;
    margin: string | null;
  };
  /** True when a new financial snapshot should be written. */
  financialsChanged: boolean;
  overrideEvent: OverrideEvent;
  errors: FieldError[];
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  a === b || (a != null && b != null && new Decimal(a).eq(new Decimal(b)));

/**
 * Applies the pricing rule to a create or update:
 * - without an override the selling price follows unit cost × rate × multiplier;
 * - an override survives input changes until it is cleared;
 * - setting or changing an override requires a reason (≥ 3 characters).
 */
export function planFinancials(current: FinancialState | null, patch: FinancialPatch, defaults: { exchangeRate: string; multiplier?: string }): FinancialPlan {
  const errors: FieldError[] = [];
  const quantity = patch.quantity ?? current?.quantity;
  const unitCost = patch.unitCost ?? current?.unitCost;
  const exchangeRate = patch.exchangeRate ?? current?.exchangeRate ?? defaults.exchangeRate;
  const priceMultiplier = current?.priceMultiplier ?? defaults.multiplier ?? DEFAULT_PRICE_MULTIPLIER;

  if (quantity === undefined) errors.push({ field: 'quantity', code: 'required', message: 'quantity is required' });
  if (unitCost === undefined) errors.push({ field: 'unitCost', code: 'required', message: 'unitCost is required' });

  // Which override (if any) applies after this request
  let override: string | null;
  if (patch.sellingPrice === null) override = null;
  else if (patch.sellingPrice !== undefined) override = patch.sellingPrice;
  else override = current?.priceOverridden ? current.sellingPrice : null;

  let f: ReturnType<typeof computeFinancials> | null = null;
  if (!errors.length) {
    try {
      f = computeFinancials({ quantity: quantity!, unitCost: unitCost!, exchangeRate, multiplier: priceMultiplier, sellingPriceOverride: override });
    } catch (e) {
      if (e instanceof PricingError) errors.push({ field: e.field === 'sellingPrice' ? 'sellingPrice' : e.field, code: 'invalid', message: e.message });
      else throw e;
    }
  }

  if (!f) {
    return { columns: null as never, financialsChanged: false, overrideEvent: 'none', errors };
  }

  const wasOverridden = current?.priceOverridden ?? false;
  let overrideEvent: OverrideEvent = 'none';
  if (f.priceOverridden && !wasOverridden) overrideEvent = 'set';
  else if (f.priceOverridden && wasOverridden && !same(f.sellingPrice, current!.sellingPrice)) overrideEvent = 'changed';
  else if (!f.priceOverridden && wasOverridden) overrideEvent = 'cleared';

  let overrideReason: string | null = null;
  if (f.priceOverridden) {
    const given = patch.overrideReason?.trim() || null;
    overrideReason = overrideEvent === 'none' ? (given ?? current?.overrideReason ?? null) : given;
    if ((overrideEvent === 'set' || overrideEvent === 'changed') && (!overrideReason || overrideReason.length < 3)) {
      errors.push({ field: 'overrideReason', code: 'required', message: 'Give a reason for setting a different selling price' });
    }
  }

  const columns = {
    quantity: quantity!,
    unitCost: new Decimal(unitCost!).toString(),
    exchangeRate: new Decimal(exchangeRate).toString(),
    priceMultiplier: new Decimal(priceMultiplier).toString(),
    suggestedPrice: f.suggestedPrice,
    sellingPrice: f.sellingPrice,
    priceOverridden: f.priceOverridden,
    overrideReason,
    totalCost: f.totalCost,
    expectedRevenue: f.expectedRevenue,
    profit: f.profit,
    margin: f.margin,
  };

  const financialsChanged =
    !current ||
    current.quantity !== columns.quantity ||
    !same(current.unitCost, columns.unitCost) ||
    !same(current.exchangeRate, columns.exchangeRate) ||
    !same(current.sellingPrice, columns.sellingPrice) ||
    current.priceOverridden !== columns.priceOverridden;

  return { columns, financialsChanged, overrideEvent, errors };
}
