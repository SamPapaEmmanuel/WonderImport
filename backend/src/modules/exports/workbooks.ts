import Decimal from 'decimal.js';
import { Workbook, type Worksheet } from 'exceljs';
import { STATUS_LABEL } from '../../common/finance/shipment';
import { marginOf } from '../../common/finance/pricing';
import { DATE_FMT, MONEY_FMT, RATE_FMT, setWorkbookMeta, styleHeader, toBuffer, XLSX_COLORS } from '../../common/xlsx/style';
import type { GoodView } from '../goods/goods.view';

const SIGNED_MONEY = '#,##0.00;[Red]-#,##0.00';
const day = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

interface Col<T> {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
  value: (row: T) => string | number | Date | null;
  /** Add a SUM in the totals row */
  sum?: boolean;
}

/** Writes rows plus a shaded totals row whose cells hold SUM formulas and their exact pre-computed results. */
function writeTable<T>(ws: Worksheet, cols: Col<T>[], rows: T[], totals: { label: string; values: Record<string, number | string | null> }) {
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  styleHeader(ws, cols.length);
  cols.forEach((c, i) => {
    if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt;
  });
  for (const r of rows) ws.addRow(Object.fromEntries(cols.map((c) => [c.key, c.value(r)])));

  const last = rows.length + 1;
  const totalRow = ws.addRow({});
  totalRow.getCell(1).value = totals.label;
  cols.forEach((c, i) => {
    const cell = totalRow.getCell(i + 1);
    const pre = totals.values[c.key];
    if (c.sum) {
      const letter = ws.getColumn(i + 1).letter;
      cell.value = { formula: `SUM(${letter}2:${letter}${last})`, result: Number(pre ?? 0) };
    } else if (pre !== undefined && i > 0) cell.value = pre === null ? null : Number(pre);
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_COLORS.total } };
    cell.border = { top: { style: 'thin', color: { argb: 'FFDCE4EA' } } };
  });
}

function writeInfo(wb: Workbook, lines: [string, string | number][]) {
  const ws = wb.addWorksheet('About this export');
  ws.columns = [
    { header: 'Item', key: 'k', width: 26 },
    { header: 'Value', key: 'v', width: 80 },
  ];
  styleHeader(ws, 2);
  for (const [k, v] of lines) ws.addRow({ k, v });
  ws.getColumn('v').alignment = { wrapText: true, vertical: 'top' };
}

const sumOf = (rows: GoodView[], f: (g: GoodView) => string) => rows.reduce((d, g) => d.plus(f(g)), new Decimal(0)).toFixed(2);

export async function buildGoodsWorkbook(rows: GoodView[], info: { exportedBy: string; exportedAt: Date; filters: string[]; sort: string }) {
  const wb = new Workbook();
  setWorkbookMeta(wb, 'WonderImport goods export');
  const ws = wb.addWorksheet('Goods');

  const cols: Col<GoodView>[] = [
    { header: 'Delivery ID', key: 'tracking', width: 20, numFmt: '@', value: (g) => g.trackingNumber },
    { header: 'Item', key: 'item', width: 34, value: (g) => g.itemName },
    { header: 'Client', key: 'client', width: 20, value: (g) => g.client.name },
    { header: 'Client code', key: 'clientCode', width: 11, value: (g) => g.client.code },
    { header: 'Supplier', key: 'supplier', width: 18, value: (g) => g.supplier.name },
    { header: 'Category', key: 'category', width: 16, value: (g) => g.category.name },
    { header: 'Status', key: 'status', width: 16, value: (g) => STATUS_LABEL[g.status] },
    { header: 'China check-in', key: 'checkIn', width: 13, value: (g) => (g.chinaCheckedIn ? 'Yes' : 'No') },
    { header: 'Quantity', key: 'qty', width: 9, value: (g) => g.quantity, sum: true },
    { header: 'Sold', key: 'sold', width: 7, value: (g) => g.quantitySold, sum: true },
    { header: 'Left', key: 'left', width: 7, value: (g) => g.itemsLeft, sum: true },
    { header: 'Unit cost (CNY)', key: 'unitCost', width: 14, numFmt: '#,##0.00##', value: (g) => Number(g.unitCost) },
    { header: 'Rate (GHS per CNY)', key: 'rate', width: 12, numFmt: RATE_FMT, value: (g) => Number(g.exchangeRate) },
    { header: 'Suggested price (GHS)', key: 'suggested', width: 14, numFmt: MONEY_FMT, value: (g) => Number(g.suggestedPrice) },
    { header: 'Selling price (GHS)', key: 'selling', width: 14, numFmt: MONEY_FMT, value: (g) => Number(g.sellingPrice) },
    { header: 'Manual price', key: 'manual', width: 10, value: (g) => (g.priceOverridden ? 'Yes' : 'No') },
    { header: 'Price reason', key: 'reason', width: 26, value: (g) => g.overrideReason },
    { header: 'Retail price (GHS)', key: 'retail', width: 13, numFmt: MONEY_FMT, value: (g) => (g.retailPrice ? Number(g.retailPrice) : null) },
    { header: 'Landed cost (GHS)', key: 'cost', width: 15, numFmt: MONEY_FMT, value: (g) => Number(g.totalCost), sum: true },
    { header: 'Revenue (GHS)', key: 'revenue', width: 15, numFmt: MONEY_FMT, value: (g) => Number(g.expectedRevenue), sum: true },
    { header: 'Profit (GHS)', key: 'profit', width: 15, numFmt: SIGNED_MONEY, value: (g) => Number(g.profit), sum: true },
    { header: 'Margin %', key: 'margin', width: 9, numFmt: '0.00;[Red]-0.00', value: (g) => (g.margin === null ? null : Number(g.margin)) },
    { header: 'Ordered', key: 'ordered', width: 11, numFmt: DATE_FMT, value: (g) => day(g.dates.orderedAt) },
    { header: 'At supplier', key: 'atSupplier', width: 11, numFmt: DATE_FMT, value: (g) => day(g.dates.supplierReceivedAt) },
    { header: 'At warehouse', key: 'atWarehouse', width: 11, numFmt: DATE_FMT, value: (g) => day(g.dates.warehouseReceivedAt) },
    { header: 'Departed', key: 'departed', width: 11, numFmt: DATE_FMT, value: (g) => day(g.dates.departedAt) },
    { header: 'Arrived', key: 'arrived', width: 11, numFmt: DATE_FMT, value: (g) => day(g.dates.arrivedAt) },
    { header: 'Delivered', key: 'delivered', width: 11, numFmt: DATE_FMT, value: (g) => day(g.dates.deliveredAt) },
    { header: 'Notes', key: 'notes', width: 30, value: (g) => g.notes },
    { header: 'Archived', key: 'archived', width: 9, value: (g) => (g.archivedAt ? 'Yes' : '') },
  ];

  const cost = sumOf(rows, (g) => g.totalCost);
  const revenue = sumOf(rows, (g) => g.expectedRevenue);
  const profit = sumOf(rows, (g) => g.profit);
  const margin = marginOf(revenue, profit);
  writeTable(ws, cols, rows, {
    label: `Total, ${rows.length} goods`,
    values: {
      qty: rows.reduce((n, g) => n + g.quantity, 0),
      sold: rows.reduce((n, g) => n + g.quantitySold, 0),
      left: rows.reduce((n, g) => n + g.itemsLeft, 0),
      cost,
      revenue,
      profit,
      margin,
    },
  });
  // Group margin = total profit ÷ total revenue, as a live formula.
  const t = rows.length + 2;
  const [rev, pro] = [ws.getColumn('revenue').letter, ws.getColumn('profit').letter];
  ws.getRow(t).getCell('margin').value = { formula: `IF(${rev}${t}=0,"",ROUND(${pro}${t}/${rev}${t}*100,2))`, result: margin === null ? '' : Number(margin) };

  writeInfo(wb, [
    ['Exported', info.exportedAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'],
    ['Exported by', info.exportedBy],
    ...info.filters.map((f, i) => [i === 0 ? 'Filters' : '', f] as [string, string]),
    ['Sorted by', info.sort],
    ['Goods', rows.length],
    ['Landed cost (GHS)', cost],
    ['Revenue (GHS)', revenue],
    ['Profit (GHS)', profit],
    ['Margin', margin === null ? '—' : `${margin}%`],
    ['Notes', 'Amounts are Ghana cedis unless marked CNY. Margin for the total is total profit ÷ total revenue. Figures match the Goods list with the same filters.'],
  ]);

  return toBuffer(wb);
}

export interface ClientExportRow {
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  isStock: boolean;
  archivedAt: string | null;
  summary: { goods: number; units: number; delivered: number; inProgress: number; landedCost: string; revenue: string; profit: string; margin: string | null };
}

export async function buildClientsWorkbook(rows: ClientExportRow[], info: { exportedBy: string; exportedAt: Date; description: string }) {
  const wb = new Workbook();
  setWorkbookMeta(wb, 'WonderImport client profitability');
  const ws = wb.addWorksheet('Clients');
  const cols: Col<ClientExportRow>[] = [
    { header: 'Code', key: 'code', width: 10, value: (c) => c.code },
    { header: 'Client', key: 'name', width: 26, value: (c) => (c.isStock ? `${c.name} (no named buyer)` : c.name) },
    { header: 'Phone', key: 'phone', width: 16, value: (c) => c.phone },
    { header: 'Email', key: 'email', width: 24, value: (c) => c.email },
    { header: 'Goods', key: 'goods', width: 8, value: (c) => c.summary.goods, sum: true },
    { header: 'Units', key: 'units', width: 8, value: (c) => c.summary.units, sum: true },
    { header: 'Delivered', key: 'delivered', width: 10, value: (c) => c.summary.delivered, sum: true },
    { header: 'In progress', key: 'inProgress', width: 11, value: (c) => c.summary.inProgress, sum: true },
    { header: 'Landed cost (GHS)', key: 'cost', width: 15, numFmt: MONEY_FMT, value: (c) => Number(c.summary.landedCost), sum: true },
    { header: 'Revenue (GHS)', key: 'revenue', width: 15, numFmt: MONEY_FMT, value: (c) => Number(c.summary.revenue), sum: true },
    { header: 'Profit (GHS)', key: 'profit', width: 15, numFmt: SIGNED_MONEY, value: (c) => Number(c.summary.profit), sum: true },
    { header: 'Margin %', key: 'margin', width: 9, numFmt: '0.00;[Red]-0.00', value: (c) => (c.summary.margin === null ? null : Number(c.summary.margin)) },
    { header: 'Archived', key: 'archived', width: 9, value: (c) => (c.archivedAt ? 'Yes' : '') },
  ];
  const total = (k: 'landedCost' | 'revenue' | 'profit') => rows.reduce((d, c) => d.plus(c.summary[k]), new Decimal(0)).toFixed(2);
  const revenue = total('revenue');
  const profit = total('profit');
  writeTable(ws, cols, rows, {
    label: `Total, ${rows.length} clients`,
    values: {
      goods: rows.reduce((n, c) => n + c.summary.goods, 0),
      units: rows.reduce((n, c) => n + c.summary.units, 0),
      delivered: rows.reduce((n, c) => n + c.summary.delivered, 0),
      inProgress: rows.reduce((n, c) => n + c.summary.inProgress, 0),
      cost: total('landedCost'),
      revenue,
      profit,
      margin: marginOf(revenue, profit),
    },
  });
  writeInfo(wb, [
    ['Exported', info.exportedAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'],
    ['Exported by', info.exportedBy],
    ['Clients', info.description],
    ['Notes', 'Totals cover each client’s active (non-archived) goods. Margin is profit ÷ revenue.'],
  ]);
  return toBuffer(wb);
}
