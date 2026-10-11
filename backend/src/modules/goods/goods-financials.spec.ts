import { planFinancials, type FinancialState } from './goods-financials';

const defaults = { exchangeRate: '1.887' };

const stored = (over: Partial<FinancialState> = {}): FinancialState => ({
  quantity: 1,
  unitCost: '2',
  exchangeRate: '1.887',
  priceMultiplier: '3',
  sellingPrice: '11.32',
  priceOverridden: false,
  overrideReason: null,
  ...over,
});

describe('planFinancials', () => {
  it('creates with the default rate and suggested price', () => {
    const p = planFinancials(null, { quantity: 1, unitCost: '2' }, defaults);
    expect(p.errors).toEqual([]);
    expect(p.columns).toMatchObject({ exchangeRate: '1.887', sellingPrice: '11.32', priceOverridden: false, overrideReason: null, margin: '66.70' });
    expect(p.financialsChanged).toBe(true);
    expect(p.overrideEvent).toBe('none');
  });

  it('requires a reason when an override is set', () => {
    const p = planFinancials(null, { quantity: 1, unitCost: '2', sellingPrice: '15' }, defaults);
    expect(p.errors).toEqual([expect.objectContaining({ field: 'overrideReason' })]);
  });

  it('records an override with its reason', () => {
    const p = planFinancials(null, { quantity: 1, unitCost: '2', sellingPrice: '15', overrideReason: 'Market price in Accra' }, defaults);
    expect(p.errors).toEqual([]);
    expect(p.overrideEvent).toBe('set');
    expect(p.columns).toMatchObject({ sellingPrice: '15.00', priceOverridden: true, overrideReason: 'Market price in Accra', profit: '11.23' });
  });

  it('keeps an existing override when cost changes, recomputing the suggestion', () => {
    const current = stored({ sellingPrice: '15.00', priceOverridden: true, overrideReason: 'Market price' });
    const p = planFinancials(current, { unitCost: '3' }, defaults);
    expect(p.errors).toEqual([]);
    expect(p.overrideEvent).toBe('none');
    expect(p.columns).toMatchObject({ suggestedPrice: '16.98', sellingPrice: '15.00', priceOverridden: true, overrideReason: 'Market price', totalCost: '5.66' });
    expect(p.financialsChanged).toBe(true);
  });

  it('follows the suggestion when not overridden', () => {
    const p = planFinancials(stored(), { quantity: 4 }, defaults);
    expect(p.columns).toMatchObject({ sellingPrice: '11.32', expectedRevenue: '45.28', totalCost: '15.10' });
  });

  it('needs a fresh reason when an override amount changes', () => {
    const current = stored({ sellingPrice: '15.00', priceOverridden: true, overrideReason: 'Market price' });
    expect(planFinancials(current, { sellingPrice: '14' }, defaults).errors[0]?.field).toBe('overrideReason');
    const ok = planFinancials(current, { sellingPrice: '14', overrideReason: 'Bulk discount for Cons' }, defaults);
    expect(ok.overrideEvent).toBe('changed');
    expect(ok.columns.overrideReason).toBe('Bulk discount for Cons');
  });

  it('clears an override with null and drops the reason', () => {
    const current = stored({ sellingPrice: '15.00', priceOverridden: true, overrideReason: 'Market price' });
    const p = planFinancials(current, { sellingPrice: null }, defaults);
    expect(p.overrideEvent).toBe('cleared');
    expect(p.columns).toMatchObject({ sellingPrice: '11.32', priceOverridden: false, overrideReason: null });
  });

  it('keeps a stored rate even when the company default has changed', () => {
    const p = planFinancials(stored(), { quantity: 2 }, { exchangeRate: '2.000' });
    expect(p.columns.exchangeRate).toBe('1.887');
  });

  it('reports no financial change when nothing financial was edited', () => {
    expect(planFinancials(stored(), {}, defaults).financialsChanged).toBe(false);
  });

  it('reports missing inputs as field errors', () => {
    const p = planFinancials(null, { quantity: 1 }, defaults);
    expect(p.errors).toEqual([expect.objectContaining({ field: 'unitCost', code: 'required' })]);
  });
});
