import { computeFinancials, marginOf, PricingError, suggestedUnitPrice } from './pricing';

// Worked examples from docs/PHASE-0-DECISIONS.md §3 (reference spreadsheet rows, rate 1.887).
describe('pricing', () => {
  const rate = '1.887';

  it('suggests unit cost × rate × 3, rounded half-up to 2 places', () => {
    expect(suggestedUnitPrice('2', rate)).toBe('11.32'); // 11.322
    expect(suggestedUnitPrice('3.24', rate)).toBe('18.34'); // 18.34164
    expect(suggestedUnitPrice('6', rate)).toBe('33.97'); // 33.966
    expect(suggestedUnitPrice('132', rate)).toBe('747.25'); // 747.252
  });

  it('Bag: override above suggested', () => {
    expect(computeFinancials({ quantity: 1, unitCost: '2', exchangeRate: rate, sellingPriceOverride: '15' })).toEqual({
      suggestedPrice: '11.32',
      sellingPrice: '15.00',
      priceOverridden: true,
      totalCost: '3.77',
      expectedRevenue: '15.00',
      profit: '11.23',
      margin: '74.87',
    });
  });

  it('Wall Tape: quantity 10 with override', () => {
    const f = computeFinancials({ quantity: 10, unitCost: '3.24', exchangeRate: rate, sellingPriceOverride: '18' });
    expect(f.totalCost).toBe('61.14');
    expect(f.expectedRevenue).toBe('180.00');
    expect(f.profit).toBe('118.86');
    expect(f.margin).toBe('66.03');
  });

  it('NewBalance1906: override far below suggested still reports profit correctly', () => {
    const f = computeFinancials({ quantity: 1, unitCost: '132', exchangeRate: rate, sellingPriceOverride: '350' });
    expect(f.suggestedPrice).toBe('747.25');
    expect(f.totalCost).toBe('249.08');
    expect(f.profit).toBe('100.92');
    expect(f.margin).toBe('28.83');
  });

  it('Sports Chest Bag: no override uses the suggested price', () => {
    const f = computeFinancials({ quantity: 1, unitCost: '6', exchangeRate: rate });
    expect(f).toMatchObject({ sellingPrice: '33.97', priceOverridden: false, totalCost: '11.32', profit: '22.65', margin: '66.68' });
  });

  it('reports a loss as a negative profit', () => {
    const f = computeFinancials({ quantity: 2, unitCost: '100', exchangeRate: rate, sellingPriceOverride: '150' });
    expect(f.totalCost).toBe('377.40');
    expect(f.profit).toBe('-77.40');
    expect(f.margin).toBe('-25.80');
  });

  it('treats an override equal to the suggested price as not overridden', () => {
    expect(computeFinancials({ quantity: 1, unitCost: '2', exchangeRate: rate, sellingPriceOverride: '11.32' }).priceOverridden).toBe(false);
  });

  it('avoids binary floating-point drift', () => {
    // 0.1 + 0.2 style inputs: 3 × 0.1 CNY at rate 1 = 0.30 exactly
    expect(computeFinancials({ quantity: 3, unitCost: '0.1', exchangeRate: '1', sellingPriceOverride: '0.1' }).profit).toBe('0.00');
  });

  it('rejects invalid inputs with the offending field', () => {
    expect(() => computeFinancials({ quantity: 0, unitCost: '1', exchangeRate: rate })).toThrow(PricingError);
    expect(() => computeFinancials({ quantity: 1.5, unitCost: '1', exchangeRate: rate })).toThrow('quantity');
    expect(() => computeFinancials({ quantity: 1, unitCost: '-1', exchangeRate: rate })).toThrow('unitCost');
    expect(() => computeFinancials({ quantity: 1, unitCost: '1', exchangeRate: '0' })).toThrow('exchangeRate');
    expect(() => computeFinancials({ quantity: 1, unitCost: 'abc', exchangeRate: rate })).toThrow('unitCost');
  });

  it('marginOf returns null for zero revenue', () => {
    expect(marginOf('0', '0')).toBeNull();
    expect(marginOf('41986.22', '27432.86')).toBe('65.34');
  });
});
