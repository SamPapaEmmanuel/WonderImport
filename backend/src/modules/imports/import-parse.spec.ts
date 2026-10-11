import { detectHeader, gridToSheet, ImportFileError, normaliseCell, parseCsv } from './import-parse';

describe('import parsing', () => {
  it('finds the header below a title row, as in the original workbook', () => {
    const grid = [
      [null, null, null, null, null, null, null, 'Import Business And Selling Report.'],
      ['Delivery ID', 'Check In', 'Product Description', 'Received At Warehouse', 'Quantity of Item', 'Cost Per 1Unit', 'Person for', 'Item Sold ', 'Item Left', 'Cost PriceYuan', 'Selling Price', 'Profit', 'Selling Price (Ghana Cedis)', 'Selling Price ', 'Actual Selling Price', 'Retail Price'],
      [78583377671043, null, 'Bag', null, 1, 2, null, null, 1, 2, 6, 2, 11.322, 11.322, 15, 15],
      [null, null, null, null, null, null, null, null, 0, 0, 0, 0, 0, 0, null, null],
    ];
    const sheet = gridToSheet(grid);
    expect(sheet.headerRow).toBe(2);
    const fields = Object.fromEntries(sheet.mapping.map((m) => [m.field, m.header]));
    expect(fields).toMatchObject({
      trackingNumber: 'Delivery ID',
      chinaCheckedIn: 'Check In',
      itemName: 'Product Description',
      quantity: 'Quantity of Item',
      unitCost: 'Cost Per 1Unit',
      client: 'Person for',
      quantitySold: 'Item Sold ',
      sellingPrice: 'Actual Selling Price',
      retailPrice: 'Retail Price',
    });
    // The yuan "Selling Price" and the computed cedi price are formula columns and must not be imported.
    expect(sheet.unmappedHeaders).toEqual(expect.arrayContaining(['Selling Price', 'Selling Price (Ghana Cedis)', 'Profit']));
    // The trailing row of formula zeros is ignored.
    expect(sheet.rows).toHaveLength(1);
    expect(sheet.rows[0]).toMatchObject({ rowNumber: 3, cells: { itemName: 'Bag', quantity: 1, unitCost: 2, sellingPrice: 15 } });
  });

  it('explains a missing header row', () => {
    expect(() => detectHeader([['a', 'b'], [1, 2]])).toThrow(ImportFileError);
  });

  it('requires quantity and unit cost columns', () => {
    expect(() => detectHeader([['Item name*', 'Client*', 'Supplier*', 'Notes']])).toThrow('"Quantity" and "Unit cost (CNY)"');
  });

  it('parses CSV with quotes, embedded commas, CRLF, BOM and semicolons', () => {
    expect(parseCsv('\uFEFFItem name*,Notes\r\n"Fan, mini","He said ""hi"""\r\n')).toEqual([
      ['Item name*', 'Notes'],
      ['Fan, mini', 'He said "hi"'],
    ]);
    expect(parseCsv('a;b\n1,5;2')).toEqual([
      ['a', 'b'],
      ['1,5', '2'],
    ]);
  });

  it('normalises formula, rich-text, hyperlink and date cells', () => {
    expect(normaliseCell({ formula: 'E5*F5', result: 8 })).toBe(8);
    expect(normaliseCell({ richText: [{ text: 'Mini ' }, { text: 'Fan' }] })).toBe('Mini Fan');
    expect(normaliseCell({ text: 'YT1', hyperlink: 'https://x' })).toBe('YT1');
    expect(normaliseCell(new Date('2026-06-02T00:00:00Z'))).toBe('2026-06-02');
    expect(normaliseCell('  ')).toBeNull();
  });
});
