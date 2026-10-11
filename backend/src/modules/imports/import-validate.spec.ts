import { ShipmentStatus } from '../../generated/prisma/enums';
import { duplicateKey, parseDate, parseStatus, parseYesNo, validateRows, type ImportContext } from './import-validate';

const ctx = (over: Partial<ImportContext> = {}): ImportContext => ({
  clients: [
    { id: 'stock', name: 'Stock (unassigned)', code: 'STOCK', archived: false },
    { id: 'cons', name: 'Cons', code: 'CL-001', archived: false },
    { id: 'old', name: 'Old Client', code: 'CL-009', archived: true },
  ],
  suppliers: [{ id: 's1', name: '1688 Wholesale', archived: false }],
  categories: [{ id: 'k1', name: 'Bags', archived: false }],
  defaults: { clientId: 'stock', supplierId: 's1', categoryId: 'k1', status: null, exchangeRate: '1.887' },
  multiplier: '3',
  existingKeys: new Set(),
  trackingUse: new Map(),
  fileName: 'june.xlsx',
  today: '2026-10-08',
  ...over,
});

const row = (rowNumber: number, cells: Record<string, unknown>) => ({ rowNumber, cells: cells as never });

describe('validateRows', () => {
  it('turns a spreadsheet row into a good, using defaults for empty cells', () => {
    const [r] = validateRows([row(5, { trackingNumber: 78583377671043, itemName: 'Bag', quantity: 1, unitCost: 2, sellingPrice: 15, retailPrice: 15 })], ctx());
    expect(r.state).toBe('VALID');
    expect(r.parsed).toMatchObject({
      trackingNumber: '78583377671043',
      clientId: 'stock',
      supplierId: 's1',
      categoryId: 'k1',
      exchangeRate: '1.887',
      status: 'ORDERED',
      orderedAt: '2026-10-08',
      sellingPriceOverride: '15.00',
      overrideReason: 'Imported from june.xlsx, row 5',
      retailPrice: '15',
    });
    expect(r.parsed!.financials).toMatchObject({ suggestedPrice: '11.32', totalCost: '3.77', profit: '11.23' });
  });

  it('matches clients by name or code, case-insensitively', () => {
    const rows = validateRows([row(2, { itemName: 'A', quantity: 1, unitCost: 1, client: 'cons' }), row(3, { itemName: 'B', quantity: 1, unitCost: 1, client: 'CL-001' })], ctx());
    expect(rows.map((r) => r.parsed?.clientId)).toEqual(['cons', 'cons']);
  });

  it('rejects unknown and archived names instead of creating them', () => {
    const rows = validateRows(
      [row(2, { itemName: 'A', quantity: 1, unitCost: 1, client: 'Lucky' }), row(3, { itemName: 'B', quantity: 1, unitCost: 1, client: 'Old Client' })],
      ctx(),
    );
    expect(rows[0]).toMatchObject({ state: 'INVALID', parsed: null });
    expect(rows[0].messages[0]).toMatchObject({ field: 'client', code: 'not_found' });
    expect(rows[1].messages[0]).toMatchObject({ field: 'client', code: 'archived' });
  });

  it('requires a default when the column is empty', () => {
    const [r] = validateRows([row(2, { itemName: 'A', quantity: 1, unitCost: 1 })], ctx({ defaults: { exchangeRate: '1.887', clientId: 'stock', supplierId: null, categoryId: 'k1' } }));
    expect(r.messages).toContainEqual(expect.objectContaining({ field: 'supplier', code: 'required' }));
  });

  it('reports each problem on the row with the field it belongs to', () => {
    const [r] = validateRows([row(9, { itemName: '', quantity: 1.5, unitCost: 'abc', status: 'Lost', chinaCheckedIn: 'maybe', orderedAt: '31/02/2026' })], ctx());
    expect(r.state).toBe('INVALID');
    expect(r.messages.filter((m) => m.level === 'error').map((m) => m.field)).toEqual(['itemName', 'quantity', 'unitCost', 'status', 'chinaCheckedIn', 'orderedAt']);
  });

  it('flags repeats within the file and goods already recorded as warnings', () => {
    const existing = new Set([duplicateKey({ trackingNumber: 'T2', itemName: 'Fan', quantity: 1, unitCost: '5' })]);
    const rows = validateRows(
      [
        row(2, { trackingNumber: '777388094064965', itemName: 'MOUSUF Perfume', quantity: 1, unitCost: 13 }),
        row(3, { trackingNumber: '777388094064965', itemName: 'MOUSUF  perfume', quantity: 1, unitCost: '13.00' }),
        row(4, { trackingNumber: 'T2', itemName: 'Fan', quantity: 1, unitCost: 5 }),
      ],
      ctx({ existingKeys: existing, trackingUse: new Map([['T2', 1]]) }),
    );
    expect(rows.map((r) => r.state)).toEqual(['VALID', 'WARNING', 'WARNING']);
    expect(rows[1].messages[0]).toMatchObject({ code: 'duplicate_in_file', message: expect.stringContaining('row 2') });
    expect(rows[2].messages.map((m) => m.code)).toEqual(['duplicate_existing', 'tracking_in_use']);
  });

  it('warns when a good past the warehouse has no check-in', () => {
    const [r] = validateRows([row(2, { itemName: 'A', quantity: 1, unitCost: 1, status: 'In transit' })], ctx());
    expect(r).toMatchObject({ state: 'WARNING', parsed: { status: 'IN_TRANSIT', chinaCheckedIn: false } });
  });

  it('accepts amounts written with currency and thousands separators', () => {
    const [r] = validateRows([row(2, { itemName: 'Shoes', quantity: '2', unitCost: '¥1,320.50', sellingPrice: 'GHS 3,500' })], ctx());
    expect(r.parsed).toMatchObject({ unitCost: '1320.5', sellingPriceOverride: '3500.00' });
  });
});

describe('cell readers', () => {
  it('statuses by label or code', () => {
    expect(parseStatus('China warehouse')).toBe(ShipmentStatus.CHINA_WAREHOUSE);
    expect(parseStatus('IN_TRANSIT')).toBe(ShipmentStatus.IN_TRANSIT);
    expect(parseStatus('')).toBeNull();
    expect(parseStatus('lost')).toBe('invalid');
  });

  it('yes/no', () => {
    expect(['Yes', '✓', 'TRUE', 1].map((v) => parseYesNo(v as never))).toEqual([true, true, true, true]);
    expect(parseYesNo('No')).toBe(false);
    expect(parseYesNo('sometimes')).toBe('invalid');
  });

  it('dates: ISO, day-first and Excel serials', () => {
    expect(parseDate('2026-06-02')).toBe('2026-06-02');
    expect(parseDate('2/6/2026')).toBe('2026-06-02');
    expect(parseDate(46175)).toBe('2026-06-02');
    expect(parseDate('31/02/2026')).toBe('invalid');
  });
});
