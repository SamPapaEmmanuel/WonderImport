import { ShipmentStatus } from '../../generated/prisma/enums';
import { computeFinancials, PricingError, type Financials } from '../../common/finance/pricing';
import { STATUS_LABEL } from '../../common/finance/shipment';
import type { CellValue, ParsedRow } from './import-parse';

export type MessageLevel = 'error' | 'warning' | 'info';

export interface RowMessage {
  field?: string;
  level: MessageLevel;
  /** Stable code; e.g. 'duplicate_in_file' and 'duplicate_existing' rows start unselected in the review. */
  code: string;
  message: string;
}

export interface MasterRef {
  id: string;
  name: string;
  code?: string;
  archived: boolean;
}

export interface ImportDefaults {
  clientId?: string | null;
  supplierId?: string | null;
  categoryId?: string | null;
  status?: ShipmentStatus | null;
  /** GHS per CNY used when the cell is empty */
  exchangeRate: string;
}

export interface ImportContext {
  clients: MasterRef[];
  suppliers: MasterRef[];
  categories: MasterRef[];
  defaults: ImportDefaults;
  multiplier: string;
  /** Keys (see duplicateKey) of goods already in WonderImport */
  existingKeys: Set<string>;
  /** Number of existing goods per tracking number */
  trackingUse: Map<string, number>;
  fileName: string;
  today: string;
}

export interface ParsedGood {
  itemName: string;
  trackingNumber: string | null;
  quantity: number;
  quantitySold: number;
  unitCost: string;
  exchangeRate: string;
  sellingPriceOverride: string | null;
  overrideReason: string | null;
  retailPrice: string | null;
  clientId: string;
  supplierId: string;
  categoryId: string;
  status: ShipmentStatus;
  chinaCheckedIn: boolean;
  orderedAt: string;
  notes: string | null;
  /** Names for display in the review */
  display: { client: string; supplier: string; category: string };
  financials: Financials;
}

export interface ValidatedRow {
  rowNumber: number;
  raw: ParsedRow['cells'];
  state: 'VALID' | 'WARNING' | 'INVALID';
  messages: RowMessage[];
  parsed: ParsedGood | null;
}

export const DUPLICATE_CODES = ['duplicate_in_file', 'duplicate_existing'];

const text = (v: CellValue | undefined) => (v === null || v === undefined ? '' : String(v).trim());

export function duplicateKey(g: { trackingNumber: string | null; itemName: string; quantity: number; unitCost: string }) {
  return [g.trackingNumber ?? '', g.itemName.trim().toLowerCase().replace(/\s+/g, ' '), g.quantity, Number(g.unitCost).toString()].join('|');
}

/** Reads a decimal from a number cell or text such as "1,234.50", "¥12" or "GHS 15". */
function parseDecimal(v: CellValue | undefined, frac: number, intDigits: number): { value: string | null; rounded: boolean; error?: string } {
  if (v === null || v === undefined || v === '') return { value: null, rounded: false };
  if (typeof v === 'boolean') return { value: null, rounded: false, error: 'is not a number' };
  let n: number;
  let raw: string;
  if (typeof v === 'number') {
    n = v;
    raw = String(v);
  } else {
    raw = v.replace(/[,\s]/g, '').replace(/^(ghs|gh₵|₵|cny|rmb|¥|yuan)/i, '').replace(/(ghs|cny|rmb|yuan)$/i, '');
    if (!/^-?\d*\.?\d+$/.test(raw)) return { value: null, rounded: false, error: 'is not a number' };
    n = Number(raw);
  }
  if (!Number.isFinite(n)) return { value: null, rounded: false, error: 'is not a number' };
  const fixed = n.toFixed(frac);
  const value = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  if (value.replace('-', '').split('.')[0].length > intDigits) return { value: null, rounded: false, error: 'is too large' };
  return { value, rounded: Math.abs(Number(value) - n) > 1e-9 };
}

function parseInteger(v: CellValue | undefined): { value: number | null; error?: string } {
  if (v === null || v === undefined || v === '') return { value: null };
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s]/g, ''));
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { value: null, error: 'must be a whole number' };
  return { value: n };
}

const STATUS_BY_KEY = new Map<string, ShipmentStatus>();
for (const s of Object.values(ShipmentStatus)) {
  STATUS_BY_KEY.set(s.toLowerCase().replace(/[^a-z]/g, ''), s);
  STATUS_BY_KEY.set(STATUS_LABEL[s].toLowerCase().replace(/[^a-z]/g, ''), s);
}
STATUS_BY_KEY.set('supplier', ShipmentStatus.AT_SUPPLIER);
STATUS_BY_KEY.set('warehouse', ShipmentStatus.CHINA_WAREHOUSE);
STATUS_BY_KEY.set('transit', ShipmentStatus.IN_TRANSIT);
STATUS_BY_KEY.set('shipped', ShipmentStatus.IN_TRANSIT);

export function parseStatus(v: CellValue | undefined): ShipmentStatus | null | 'invalid' {
  const t = text(v);
  if (!t) return null;
  return STATUS_BY_KEY.get(t.toLowerCase().replace(/[^a-z]/g, '')) ?? 'invalid';
}

const YES = new Set(['yes', 'y', 'true', '1', 'checked', 'checkedin', 'done', '✓', '✔', 'x']);
const NO = new Set(['no', 'n', 'false', '0', 'notcheckedin', 'pending']);

export function parseYesNo(v: CellValue | undefined): boolean | null | 'invalid' {
  if (typeof v === 'boolean') return v;
  const t = text(v).toLowerCase().replace(/[\s-]/g, '');
  if (!t) return null;
  if (YES.has(t)) return true;
  if (NO.has(t)) return false;
  return 'invalid';
}

const isRealDate = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 2000 && y <= 2100;
};

/** Accepts YYYY-MM-DD, day-first DD/MM/YYYY (also with - or .), and Excel serial numbers. */
export function parseDate(v: CellValue | undefined): string | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    if (v < 36526 || v > 73051) return 'invalid'; // 2000-01-01 .. 2100-01-01
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000).toISOString().slice(0, 10);
  }
  const t = text(v);
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m && isRealDate(+m[1], +m[2], +m[3])) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m && isRealDate(+m[3], +m[2], +m[1])) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return 'invalid';
}

function trackingText(v: CellValue | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  // Long numeric IDs are stored by Excel as numbers; print them without exponent or decimals.
  if (typeof v === 'number') return Number.isInteger(v) ? BigInt(Math.round(v)).toString() : String(v);
  return String(v).trim().replace(/\s+/g, ' ');
}

function findRef(list: MasterRef[], value: string, matchCode: boolean) {
  const key = value.trim().toLowerCase();
  return list.find((r) => r.name.trim().toLowerCase() === key || (matchCode && r.code?.toLowerCase() === key));
}

const AT_OR_PAST_WAREHOUSE: ShipmentStatus[] = [ShipmentStatus.CHINA_WAREHOUSE, ShipmentStatus.IN_TRANSIT, ShipmentStatus.ARRIVED, ShipmentStatus.DELIVERED];

/** Validates every row against master data and the pricing rules. Nothing is written. */
export function validateRows(rows: ParsedRow[], ctx: ImportContext): ValidatedRow[] {
  const seen = new Map<string, number>();
  const byId = (list: MasterRef[], id?: string | null) => (id ? list.find((r) => r.id === id) : undefined);

  return rows.map((row) => {
    const c = row.cells;
    const msgs: RowMessage[] = [];
    const err = (field: string, code: string, message: string) => msgs.push({ field, level: 'error', code, message });
    const warn = (field: string | undefined, code: string, message: string) => msgs.push({ field, level: 'warning', code, message });

    // Item
    const itemName = text(c.itemName).replace(/\s+/g, ' ');
    if (!itemName) err('itemName', 'required', 'Item name is empty.');
    else if (itemName.length > 200) err('itemName', 'too_long', 'Item name is longer than 200 characters.');

    const trackingNumber = trackingText(c.trackingNumber);
    if (trackingNumber && !/^[A-Za-z0-9][A-Za-z0-9 _./-]{0,63}$/.test(trackingNumber)) err('trackingNumber', 'invalid', 'Tracking number may only contain letters, digits, spaces, dots, slashes and hyphens (max 64).');

    // Quantities
    const qty = parseInteger(c.quantity);
    if (qty.value === null) err('quantity', 'required', qty.error ? `Quantity ${qty.error}.` : 'Quantity is empty.');
    else if (qty.value < 1) err('quantity', 'min', 'Quantity must be at least 1.');
    const sold = parseInteger(c.quantitySold);
    if (sold.error) err('quantitySold', 'invalid', `Quantity sold ${sold.error}.`);
    else if (sold.value !== null && qty.value !== null && (sold.value < 0 || sold.value > qty.value)) err('quantitySold', 'range', `Quantity sold must be between 0 and ${qty.value}.`);

    // Money
    const unitCost = parseDecimal(c.unitCost, 4, 10);
    if (unitCost.error) err('unitCost', 'invalid', `Unit cost ${unitCost.error}.`);
    else if (!unitCost.value) err('unitCost', 'required', 'Unit cost is empty.');
    else if (Number(unitCost.value) <= 0) err('unitCost', 'min', 'Unit cost must be greater than 0.');
    else if (unitCost.rounded) warn('unitCost', 'rounded', `Unit cost rounded to ${unitCost.value}.`);

    const rateCell = parseDecimal(c.exchangeRate, 6, 6);
    if (rateCell.error) err('exchangeRate', 'invalid', `Exchange rate ${rateCell.error}.`);
    else if (rateCell.value !== null && Number(rateCell.value) <= 0) err('exchangeRate', 'min', 'Exchange rate must be greater than 0.');
    const exchangeRate = rateCell.value ?? ctx.defaults.exchangeRate;

    const selling = parseDecimal(c.sellingPrice, 2, 12);
    if (selling.error) err('sellingPrice', 'invalid', `Selling price ${selling.error}.`);
    else if (selling.value !== null && Number(selling.value) <= 0) err('sellingPrice', 'min', 'Selling price must be greater than 0, or left empty.');
    else if (selling.rounded) warn('sellingPrice', 'rounded', `Selling price rounded to ${selling.value}.`);

    const retail = parseDecimal(c.retailPrice, 2, 12);
    if (retail.error) err('retailPrice', 'invalid', `Retail price ${retail.error}.`);

    // Master data
    const ref = (field: 'client' | 'supplier' | 'category', list: MasterRef[], defaultId: string | null | undefined, label: string) => {
      const value = text(c[field]);
      const found = value ? findRef(list, value, field === 'client') : byId(list, defaultId);
      if (!value && !found) {
        err(field, 'required', `${label} is empty and no default ${label.toLowerCase()} was chosen.`);
        return undefined;
      }
      if (!found) {
        err(field, 'not_found', `No ${label.toLowerCase()} named "${value}". Add it in WonderImport first, or correct the spelling.`);
        return undefined;
      }
      if (found.archived) {
        err(field, 'archived', `${label} "${found.name}" is archived.`);
        return undefined;
      }
      return found;
    };
    const client = ref('client', ctx.clients, ctx.defaults.clientId, 'Client');
    const supplier = ref('supplier', ctx.suppliers, ctx.defaults.supplierId, 'Supplier');
    const category = ref('category', ctx.categories, ctx.defaults.categoryId, 'Category');

    // Shipment
    const statusCell = parseStatus(c.status);
    if (statusCell === 'invalid') err('status', 'invalid', `Status "${text(c.status)}" is not one of: ${Object.values(STATUS_LABEL).join(', ')}.`);
    const status = (statusCell !== 'invalid' && statusCell) || ctx.defaults.status || ShipmentStatus.ORDERED;

    const checkIn = parseYesNo(c.chinaCheckedIn);
    if (checkIn === 'invalid') err('chinaCheckedIn', 'invalid', `China check-in "${text(c.chinaCheckedIn)}" should be Yes or No.`);
    const chinaCheckedIn = checkIn === true;
    if (!chinaCheckedIn && AT_OR_PAST_WAREHOUSE.includes(status) && checkIn !== 'invalid') {
      warn('chinaCheckedIn', 'check_in_missing', `Status is ${STATUS_LABEL[status]} but there is no China check-in. It will show as missing.`);
    }

    const orderedCell = parseDate(c.orderedAt);
    if (orderedCell === 'invalid') err('orderedAt', 'invalid', `Ordered date "${text(c.orderedAt)}" is not a date. Use YYYY-MM-DD or DD/MM/YYYY.`);
    const orderedAt = (orderedCell !== 'invalid' && orderedCell) || ctx.today;

    const notes = text(c.notes) || null;
    if (notes && notes.length > 2000) err('notes', 'too_long', 'Notes are longer than 2,000 characters.');
    const reasonCell = text(c.overrideReason) || null;

    // Price preview
    let financials: Financials | null = null;
    if (!msgs.some((m) => m.level === 'error' && ['quantity', 'unitCost', 'exchangeRate', 'sellingPrice'].includes(m.field ?? ''))) {
      try {
        financials = computeFinancials({ quantity: qty.value!, unitCost: unitCost.value!, exchangeRate, multiplier: ctx.multiplier, sellingPriceOverride: selling.value });
      } catch (e) {
        if (e instanceof PricingError) err(e.field, 'invalid', e.message);
        else throw e;
      }
    }

    // Duplicates and shared tracking numbers
    if (itemName && qty.value && unitCost.value) {
      const key = duplicateKey({ trackingNumber, itemName, quantity: qty.value, unitCost: unitCost.value });
      const earlier = seen.get(key);
      if (earlier) warn(undefined, 'duplicate_in_file', `Same tracking number, item, quantity and cost as row ${earlier}. Left unselected in case it is a repeat.`);
      else seen.set(key, row.rowNumber);
      if (ctx.existingKeys.has(key)) warn(undefined, 'duplicate_existing', 'A good with the same tracking number, item, quantity and cost is already recorded. Left unselected.');
    }
    if (trackingNumber && ctx.trackingUse.get(trackingNumber)) {
      const n = ctx.trackingUse.get(trackingNumber)!;
      msgs.push({ field: 'trackingNumber', level: 'info', code: 'tracking_in_use', message: `Tracking number already used by ${n} recorded ${n === 1 ? 'good' : 'goods'} (fine for a shared parcel).` });
    }

    const hasError = msgs.some((m) => m.level === 'error');
    const hasWarning = msgs.some((m) => m.level === 'warning');

    const parsed: ParsedGood | null =
      hasError || !financials || !client || !supplier || !category
        ? null
        : {
            itemName,
            trackingNumber,
            quantity: qty.value!,
            quantitySold: sold.value ?? 0,
            unitCost: unitCost.value!,
            exchangeRate,
            sellingPriceOverride: financials.priceOverridden ? financials.sellingPrice : null,
            overrideReason: financials.priceOverridden ? (reasonCell ?? `Imported from ${ctx.fileName}, row ${row.rowNumber}`) : null,
            retailPrice: retail.value,
            clientId: client.id,
            supplierId: supplier.id,
            categoryId: category.id,
            status,
            chinaCheckedIn,
            orderedAt,
            notes,
            display: { client: client.name, supplier: supplier.name, category: category.name },
            financials,
          };

    return {
      rowNumber: row.rowNumber,
      raw: c,
      state: hasError || !parsed ? 'INVALID' : hasWarning ? 'WARNING' : 'VALID',
      messages: msgs,
      parsed,
    };
  });
}
