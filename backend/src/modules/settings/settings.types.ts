export const PRICING_KEY = 'pricing';

export type PricingSettings = {
  /** GHS per 1 CNY, as a decimal string */
  defaultExchangeRate: string;
  /** Fixed at 3 for the first release */
  priceMultiplier: string;
  baseCurrency: 'GHS';
  sourceCurrency: 'CNY';
};

export const DEFAULT_PRICING: PricingSettings = {
  defaultExchangeRate: '1.887',
  priceMultiplier: '3',
  baseCurrency: 'GHS',
  sourceCurrency: 'CNY',
};
