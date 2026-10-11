/**
 * Import columns: the template headers, what each means, and the header names accepted for it.
 * Headers are matched after normalising (lowercase, letters and digits only), so "Unit cost (CNY)*",
 * "unit cost cny" and "UNIT_COST_CNY" are the same. Aliases cover the original
 * "Final Importation Analysis" workbook so it can be imported as-is.
 */
export const IMPORT_FIELDS = [
  'itemName',
  'trackingNumber',
  'quantity',
  'quantitySold',
  'unitCost',
  'exchangeRate',
  'sellingPrice',
  'overrideReason',
  'retailPrice',
  'client',
  'supplier',
  'category',
  'status',
  'chinaCheckedIn',
  'orderedAt',
  'notes',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export interface ColumnDef {
  field: ImportField;
  header: string;
  required: boolean;
  guide: string;
  example: string;
  aliases: string[];
  width: number;
  /** Shown in the template (quantitySold is accepted but not part of the template). */
  inTemplate: boolean;
}

export const COLUMNS: ColumnDef[] = [
  { field: 'itemName', header: 'Item name*', required: true, guide: 'What the item is. Up to 200 characters.', example: 'Mini Fan', aliases: ['item', 'itemname', 'product', 'productname', 'productdescription', 'description'], width: 32, inTemplate: true },
  { field: 'trackingNumber', header: 'Tracking number', required: false, guide: 'The delivery ID on the parcel. Several items can share one.', example: 'YT8846470188274', aliases: ['tracking', 'trackingnumber', 'trackingno', 'deliveryid', 'deliveryno', 'waybill'], width: 20, inTemplate: true },
  { field: 'quantity', header: 'Quantity*', required: true, guide: 'Whole number, at least 1.', example: '2', aliases: ['quantity', 'qty', 'quantityofitem', 'quantityofitems', 'units'], width: 10, inTemplate: true },
  { field: 'quantitySold', header: 'Quantity sold', required: false, guide: 'Optional. Whole number, not more than Quantity.', example: '0', aliases: ['quantitysold', 'itemsold', 'itemssold', 'sold'], width: 12, inTemplate: false },
  { field: 'unitCost', header: 'Unit cost (CNY)*', required: true, guide: 'Price per unit in yuan, up to 4 decimal places.', example: '4.00', aliases: ['unitcost', 'unitcostcny', 'unitcostyuan', 'costperunit', 'costper1unit', 'costperoneunit', 'cost'], width: 16, inTemplate: true },
  { field: 'exchangeRate', header: 'Exchange rate (GHS per CNY)', required: false, guide: 'Leave empty to use the rate chosen when uploading.', example: '1.887', aliases: ['exchangerate', 'exchangerateghspercny', 'rate', 'fxrate'], width: 16, inTemplate: true },
  { field: 'sellingPrice', header: 'Selling price (GHS)', required: false, guide: 'Leave empty to use cost × rate × 3. Fill it only for a different price per unit.', example: '', aliases: ['sellingpriceghs', 'actualsellingprice', 'sellingpricepercedi', 'priceperunitghs'], width: 16, inTemplate: true },
  { field: 'overrideReason', header: 'Price reason', required: false, guide: 'Why the selling price differs. If empty, the import file and row are recorded as the reason.', example: '', aliases: ['pricereason', 'overridereason', 'reason'], width: 24, inTemplate: true },
  { field: 'retailPrice', header: 'Retail price (GHS)', required: false, guide: 'Optional reference price.', example: '', aliases: ['retailprice', 'retailpriceghs', 'retail'], width: 14, inTemplate: true },
  { field: 'client', header: 'Client*', required: true, guide: 'Client name or code exactly as in WonderImport. Leave empty to use the default chosen when uploading (for example Stock).', example: 'Cons', aliases: ['client', 'clientname', 'clientcode', 'customer', 'personfor', 'for', 'buyer'], width: 18, inTemplate: true },
  { field: 'supplier', header: 'Supplier*', required: true, guide: 'Supplier name exactly as in Settings. Leave empty to use the upload default.', example: '1688 Wholesale', aliases: ['supplier', 'suppliername', 'vendor', 'seller'], width: 18, inTemplate: true },
  { field: 'category', header: 'Category*', required: true, guide: 'Category name exactly as in Settings. Leave empty to use the upload default.', example: 'Electronics', aliases: ['category', 'categoryname', 'type'], width: 18, inTemplate: true },
  { field: 'status', header: 'Status', required: false, guide: 'Ordered, At supplier, China warehouse, In transit, Arrived or Delivered. Empty means the upload default.', example: 'Ordered', aliases: ['status', 'shipmentstatus', 'stage'], width: 16, inTemplate: true },
  { field: 'chinaCheckedIn', header: 'China check-in', required: false, guide: 'Yes or No. Empty means No.', example: 'No', aliases: ['chinacheckin', 'checkin', 'checkedin', 'chinacheckedin'], width: 14, inTemplate: true },
  { field: 'orderedAt', header: 'Ordered date', required: false, guide: 'YYYY-MM-DD or DD/MM/YYYY. Empty means the import date.', example: '2026-10-08', aliases: ['ordereddate', 'orderdate', 'orderedon', 'orderedat', 'date'], width: 14, inTemplate: true },
  { field: 'notes', header: 'Notes', required: false, guide: 'Anything else. Up to 2,000 characters.', example: '', aliases: ['notes', 'note', 'comments', 'remarks'], width: 30, inTemplate: true },
];

export const TEMPLATE_COLUMNS = COLUMNS.filter((c) => c.inTemplate);

export const normaliseHeader = (h: unknown) =>
  String(h ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const ALIAS_INDEX = new Map<string, ImportField>();
for (const c of COLUMNS) {
  ALIAS_INDEX.set(normaliseHeader(c.header), c.field);
  for (const a of c.aliases) ALIAS_INDEX.set(a, c.field);
}

export const fieldForHeader = (h: unknown): ImportField | undefined => ALIAS_INDEX.get(normaliseHeader(h));

export const columnFor = (f: ImportField) => COLUMNS.find((c) => c.field === f)!;
