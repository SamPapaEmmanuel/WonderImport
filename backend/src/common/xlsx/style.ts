import type { Workbook, Worksheet } from 'exceljs';

/** Workbook styling shared by the template, error report and exports: harbour-navy header, frozen, filterable. */
export const XLSX_COLORS = {
  header: 'FF12283A',
  headerText: 'FFFFFFFF',
  subtle: 'FFE6F0F3',
  error: 'FFF9E8EC',
  errorText: 'FFC24563',
  total: 'FFF3F6F8',
};

export const MONEY_FMT = '#,##0.00';
export const RATE_FMT = '0.000###';
export const DATE_FMT = 'yyyy-mm-dd';

export function styleHeader(ws: Worksheet, columns: number) {
  const row = ws.getRow(1);
  row.height = 22;
  for (let c = 1; c <= columns; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: XLSX_COLORS.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_COLORS.header } };
    cell.alignment = { vertical: 'middle' };
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns } };
}

export function setWorkbookMeta(wb: Workbook, title: string) {
  wb.creator = 'WonderImport';
  wb.title = title;
  wb.created = new Date();
}

export async function toBuffer(wb: Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}
