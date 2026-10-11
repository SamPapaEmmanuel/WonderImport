import { fieldForHeader, type ImportField } from './import-columns';

/** A JSON-safe cell value. Dates are converted to YYYY-MM-DD. */
export type CellValue = string | number | boolean | null;

export interface ParsedRow {
  /** Row number as shown in the spreadsheet (1-based, including the header and anything above it). */
  rowNumber: number;
  cells: Partial<Record<ImportField, CellValue>>;
}

export interface ParsedSheet {
  headerRow: number;
  /** Which column (0-based) feeds which field, and the header text found there. */
  mapping: { field: ImportField; column: number; header: string }[];
  unmappedHeaders: string[];
  rows: ParsedRow[];
}

export class ImportFileError extends Error {}

export const MAX_ROWS = 2000;
const HEADER_SCAN_ROWS = 15;

/** Turns whatever a spreadsheet cell holds (formula results, rich text, hyperlinks, dates) into a plain value. */
export function normaliseCell(v: unknown): CellValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const t = v.replace(/\u00a0/g, ' ').trim();
    return t === '' ? null : t;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return normaliseCell(o.result); // formula
    if (Array.isArray(o.richText)) return normaliseCell((o.richText as { text: string }[]).map((r) => r.text).join(''));
    if ('text' in o) return normaliseCell(o.text); // hyperlink
    if ('error' in o) return null;
  }
  return normaliseCell(String(v));
}

/**
 * Finds the header row (the first rows may hold a title, as in the original workbook)
 * and maps columns to fields. Requires at least the item name and two other known columns.
 */
export function detectHeader(grid: CellValue[][]): Pick<ParsedSheet, 'headerRow' | 'mapping' | 'unmappedHeaders'> {
  let best: { index: number; mapping: ParsedSheet['mapping']; unmapped: string[] } | null = null;
  for (let r = 0; r < Math.min(HEADER_SCAN_ROWS, grid.length); r++) {
    const mapping: ParsedSheet['mapping'] = [];
    const unmapped: string[] = [];
    const used = new Set<ImportField>();
    grid[r].forEach((cell, c) => {
      if (cell === null || cell === '') return;
      const f = fieldForHeader(cell);
      if (f && !used.has(f)) {
        used.add(f);
        mapping.push({ field: f, column: c, header: String(cell) });
      } else unmapped.push(String(cell));
    });
    if (used.has('itemName') && mapping.length >= 3 && (!best || mapping.length > best.mapping.length)) {
      best = { index: r, mapping, unmapped };
    }
  }
  if (!best) {
    throw new ImportFileError(
      'No header row was found. The file needs a row of column names including "Item name", "Quantity" and "Unit cost (CNY)". Download the template to see the expected columns.',
    );
  }
  const missing = (['quantity', 'unitCost'] as ImportField[]).filter((f) => !best!.mapping.some((m) => m.field === f));
  if (missing.length) {
    const names = { quantity: 'Quantity', unitCost: 'Unit cost (CNY)' } as Record<string, string>;
    throw new ImportFileError(`The header row is missing ${missing.map((m) => `"${names[m]}"`).join(' and ')}. These columns are required.`);
  }
  return { headerRow: best.index + 1, mapping: best.mapping, unmappedHeaders: best.unmapped };
}

/** Converts a grid (rows of cells, index 0 = spreadsheet row 1) into mapped data rows, skipping empty ones. */
export function gridToSheet(grid: CellValue[][]): ParsedSheet {
  const header = detectHeader(grid);
  const rows: ParsedRow[] = [];
  for (let r = header.headerRow; r < grid.length; r++) {
    const cells: ParsedRow['cells'] = {};
    let filled = false;
    for (const m of header.mapping) {
      const v = grid[r][m.column] ?? null;
      cells[m.field] = v;
      // A row counts only if it has something in the core columns; leftover formula rows of zeros are ignored.
      if (v !== null && v !== '' && v !== 0 && (m.field === 'itemName' || m.field === 'quantity' || m.field === 'unitCost' || m.field === 'trackingNumber')) filled = true;
    }
    if (!filled) continue;
    rows.push({ rowNumber: r + 1, cells });
    if (rows.length > MAX_ROWS) {
      throw new ImportFileError(`The file has more than ${MAX_ROWS.toLocaleString('en')} rows of goods. Split it into smaller files and import them one at a time.`);
    }
  }
  if (!rows.length) throw new ImportFileError('The file has a header row but no goods below it.');
  return { ...header, rows };
}

/** RFC 4180 CSV parser. Detects comma or semicolon delimiters and strips a UTF-8 BOM. */
export function parseCsv(text: string): CellValue[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.slice(0, src.search(/\r?\n/) === -1 ? undefined : src.search(/\r?\n/));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: CellValue[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row.map(normaliseCell));
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row.map(normaliseCell));
  }
  return rows;
}
