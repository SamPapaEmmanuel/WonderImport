import { Workbook } from 'exceljs';
import { STATUS_LABEL } from '../../common/finance/shipment';
import { setWorkbookMeta, styleHeader, toBuffer, XLSX_COLORS } from '../../common/xlsx/style';
import { COLUMNS, TEMPLATE_COLUMNS, type ImportField } from './import-columns';
import type { CellValue } from './import-parse';
import type { RowMessage } from './import-validate';

const DATA_ROWS = 2000;

const colLetter = (n: number) => {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** The import template: a Goods sheet with dropdowns, a field guide, and the current lists of valid names. */
export async function buildTemplateXlsx(lists: { clients: string[]; suppliers: string[]; categories: string[] }) {
  const wb = new Workbook();
  setWorkbookMeta(wb, 'WonderImport goods template');

  const ws = wb.addWorksheet('Goods');
  ws.columns = TEMPLATE_COLUMNS.map((c) => ({ header: c.header, key: c.field, width: c.width }));
  styleHeader(ws, TEMPLATE_COLUMNS.length);
  ws.getColumn('trackingNumber').numFmt = '@'; // keep long delivery IDs as text
  ws.getColumn('orderedAt').numFmt = 'yyyy-mm-dd';

  const listWs = wb.addWorksheet('Lists');
  const listCols: [string, string[]][] = [
    ['Clients', lists.clients],
    ['Suppliers', lists.suppliers],
    ['Categories', lists.categories],
    ['Statuses', Object.values(STATUS_LABEL)],
    ['Yes / No', ['Yes', 'No']],
  ];
  listCols.forEach(([title, values], i) => {
    const col = listWs.getColumn(i + 1);
    col.width = 26;
    listWs.getCell(1, i + 1).value = title;
    values.forEach((v, r) => (listWs.getCell(r + 2, i + 1).value = v));
  });
  styleHeader(listWs, listCols.length);

  const dropdown = (field: ImportField, listIndex: number) => {
    const values = listCols[listIndex][1];
    if (!values.length) return;
    const col = colLetter(TEMPLATE_COLUMNS.findIndex((c) => c.field === field) + 1);
    const src = `Lists!$${colLetter(listIndex + 1)}$2:$${colLetter(listIndex + 1)}$${values.length + 1}`;
    // One rule for the whole column range keeps the file small.
    // Range validations exist at runtime in exceljs 4 but are missing from its type definitions.
    (ws as unknown as { dataValidations: { add(range: string, rule: unknown): void } }).dataValidations.add(`${col}2:${col}${DATA_ROWS + 1}`, {
      type: 'list',
      allowBlank: true,
      formulae: [src],
      showErrorMessage: field === 'status' || field === 'chinaCheckedIn',
      errorTitle: 'Choose from the list',
      error: 'Pick a value from the dropdown.',
    });
  };
  dropdown('client', 0);
  dropdown('supplier', 1);
  dropdown('category', 2);
  dropdown('status', 3);
  dropdown('chinaCheckedIn', 4);

  const guide = wb.addWorksheet('Field guide');
  guide.columns = [
    { header: 'Column', key: 'header', width: 28 },
    { header: 'Required', key: 'required', width: 10 },
    { header: 'What to enter', key: 'guide', width: 80 },
    { header: 'Example', key: 'example', width: 20 },
  ];
  styleHeader(guide, 4);
  for (const c of COLUMNS) guide.addRow({ header: c.header, required: c.required ? 'Yes' : '', guide: c.guide, example: c.example });
  guide.addRow({});
  guide.addRow({ header: 'Notes', guide: 'Columns marked * are required; client, supplier and category can be left empty if you choose defaults when uploading.' });
  guide.addRow({ guide: 'Names must match WonderImport exactly (capitals do not matter). Unknown names are reported, never created.' });
  guide.addRow({ guide: 'Prices: leave "Selling price (GHS)" empty to use unit cost × rate × 3.' });
  guide.addRow({ guide: 'Nothing is saved until you review the rows and choose Import.' });
  guide.getColumn('guide').alignment = { wrapText: true, vertical: 'top' };

  wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
  return toBuffer(wb);
}

export function buildTemplateCsv() {
  return `\uFEFF${TEMPLATE_COLUMNS.map((c) => c.header).join(',')}\r\n`;
}

/** Rows that need fixing, in template layout, with a "What to fix" column. Fixed rows can be uploaded again. */
export async function buildErrorReport(fileName: string, rows: { rowNumber: number; raw: Partial<Record<ImportField, CellValue>>; messages: RowMessage[] }[]) {
  const wb = new Workbook();
  setWorkbookMeta(wb, `Rows to fix from ${fileName}`);
  const ws = wb.addWorksheet('Rows to fix');
  const cols = [
    { header: 'What to fix', key: '_fix', width: 60 },
    { header: 'Row in original file', key: '_row', width: 12 },
    ...COLUMNS.filter((c) => c.inTemplate || rows.some((r) => r.raw[c.field] != null)).map((c) => ({ header: c.header, key: c.field, width: c.width })),
  ];
  ws.columns = cols;
  styleHeader(ws, cols.length);
  ws.getColumn('trackingNumber').numFmt = '@';
  for (const r of rows) {
    const fix = r.messages.filter((m) => m.level === 'error').map((m) => m.message).join(' ');
    const added = ws.addRow({ _fix: fix, _row: r.rowNumber, ...Object.fromEntries(Object.entries(r.raw).map(([k, v]) => [k, typeof v === 'number' && k === 'trackingNumber' ? String(v) : v])) });
    const fixCell = added.getCell('_fix');
    fixCell.font = { color: { argb: XLSX_COLORS.errorText } };
    fixCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_COLORS.error } };
    fixCell.alignment = { wrapText: true, vertical: 'top' };
  }
  return toBuffer(wb);
}
