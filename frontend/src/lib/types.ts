// Shared request/response shapes. Mirrors backend enums and envelopes (docs/PHASE-0-DECISIONS.md §6).

export type Role = 'ADMIN' | 'STAFF' | 'VIEWER';

export type ShipmentStatus = 'ORDERED' | 'AT_SUPPLIER' | 'CHINA_WAREHOUSE' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED';

export interface Me {
  id: string;
  authId: string;
  email: string;
  name: string;
  role: Role;
}

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: FieldError[];
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

export interface Envelope<T> {
  data: T;
}

export interface Paginated<T, F = Record<string, unknown>> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
  context: { filters: F; sort?: string };
}

export interface Health {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  latencyMs: number;
  version: string;
  time: string;
}

export interface PricingSettings {
  defaultExchangeRate: string;
  priceMultiplier: string;
  baseCurrency: 'GHS';
  sourceCurrency: 'CNY';
  updatedAt: string | null;
  updatedBy: string | null;
}

// ───────────────────────── Phase 2 ─────────────────────────

export interface PersonRef {
  id: string;
  name: string;
}

export interface Lookups {
  clients: { id: string; code: string; name: string; isStock: boolean }[];
  suppliers: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}

export interface StageDates {
  orderedAt: string | null;
  supplierReceivedAt: string | null;
  warehouseReceivedAt: string | null;
  departedAt: string | null;
  arrivedAt: string | null;
  deliveredAt: string | null;
}

/** A good as returned by the API. Money and rates are exact decimal strings. */
export interface Good {
  id: string;
  itemName: string;
  trackingNumber: string | null;
  quantity: number;
  quantitySold: number;
  itemsLeft: number;
  unitCost: string;
  exchangeRate: string;
  priceMultiplier: string;
  suggestedPrice: string;
  sellingPrice: string;
  priceOverridden: boolean;
  overrideReason: string | null;
  overriddenAt: string | null;
  overriddenBy: PersonRef | null;
  retailPrice: string | null;
  totalCost: string;
  expectedRevenue: string;
  profit: string;
  margin: string | null;
  status: ShipmentStatus;
  chinaCheckedIn: boolean;
  chinaCheckedInAt: string | null;
  checkedInBy: PersonRef | null;
  dates: StageDates;
  notes: string | null;
  client: { id: string; code: string; name: string; isStock: boolean };
  supplier: { id: string; name: string };
  category: { id: string; name: string };
  archivedAt: string | null;
  createdAt: string;
  createdBy: PersonRef;
  updatedAt: string;
  updatedBy: PersonRef | null;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: ShipmentStatus | null;
  toStatus: ShipmentStatus;
  isCorrection: boolean;
  note: string | null;
  changedAt: string;
  changedBy: PersonRef;
}

export interface FinancialSnapshot {
  id: string;
  quantity: number;
  unitCost: string;
  exchangeRate: string;
  priceMultiplier: string;
  suggestedPrice: string;
  sellingPrice: string;
  priceOverridden: boolean;
  overrideReason: string | null;
  createdAt: string;
  createdBy: PersonRef;
}

export interface GoodDetail extends Good {
  statusHistory: StatusHistoryEntry[];
  snapshots: FinancialSnapshot[];
}

export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'ARCHIVE' | 'RESTORE' | 'DUPLICATE' | 'STATUS_CHANGE' | 'STATUS_CORRECTION'
  | 'CHINA_CHECK_IN' | 'PRICE_OVERRIDE' | 'ACCOUNT_LINK' | 'IMPORT' | 'EXPORT';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  note: string | null;
  actor: PersonRef | null;
  createdAt: string;
}

export interface StatusChangeResult {
  data: Good;
  warnings: 'CHINA_CHECK_IN_PENDING'[];
}

export interface Client {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isStock: boolean;
  archivedAt: string | null;
  goodsCount: number;
  summary: ClientSummary;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  country: string;
  notes: string | null;
  archivedAt: string | null;
  goodsCount: number;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  archivedAt: string | null;
  goodsCount: number;
}

// ───────────────────────── Phase 3 ─────────────────────────

/** Totals for a group of goods. Money is an exact 2-decimal string; margin is profit ÷ revenue. */
export interface Sums {
  goods: number;
  units: number;
  landedCost: string;
  revenue: string;
  profit: string;
  margin: string | null;
}

export interface ClientSummary extends Sums {
  delivered: number;
  inProgress: number;
  byStatus: Record<ShipmentStatus, number>;
}

export interface StageSummary extends Sums {
  status: ShipmentStatus;
  checkInMissing: number;
}

export interface ClientRank extends Sums {
  id: string;
  code: string;
  name: string;
}

export type PeriodKey = '30d' | '90d' | 'ytd' | 'all';

export interface DashboardSummary {
  period: { key: PeriodKey | 'custom'; from: string | null; to: string | null; label: string; definition: string };
  totals: Sums & { inTransit: { goods: number; units: number; landedCost: string }; checkInMissing: number };
  pipeline: StageSummary[];
  leadingClients: { revenue: ClientRank[]; profit: ClientRank[]; items: ClientRank[]; namedClients: number };
  unassigned: (Sums & { clientId: string }) | null;
  recent: Good[];
}

// ───────────────────────── Phase 4 ─────────────────────────

export type ImportBatchStatus = 'VALIDATING' | 'READY' | 'COMMITTED' | 'FAILED' | 'CANCELLED';
export type ImportRowState = 'VALID' | 'WARNING' | 'INVALID' | 'COMMITTED' | 'SKIPPED';

export interface RowMessage {
  field?: string;
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

export interface ImportParsedGood {
  itemName: string;
  trackingNumber: string | null;
  quantity: number;
  unitCost: string;
  exchangeRate: string;
  sellingPriceOverride: string | null;
  status: ShipmentStatus;
  chinaCheckedIn: boolean;
  orderedAt: string;
  display: { client: string; supplier: string; category: string };
  financials: { suggestedPrice: string; sellingPrice: string; priceOverridden: boolean; totalCost: string; expectedRevenue: string; profit: string; margin: string | null };
}

export interface ImportBatch {
  id: string;
  fileName: string;
  status: ImportBatchStatus;
  totalRows: number;
  validRows: number;
  warningRows: number;
  invalidRows: number;
  committedRows: number;
  skippedRows: number;
  options: {
    defaults: { clientId?: string | null; supplierId?: string | null; categoryId?: string | null; status?: ShipmentStatus | null; exchangeRate: string };
    sheetName: string | null;
    headerRow: number;
    mapping: { field: string; header: string }[];
    ignoredColumns: string[];
  } | null;
  importedBy: PersonRef;
  createdAt: string;
  committedAt: string | null;
}

export interface ImportRow {
  rowNumber: number;
  state: ImportRowState;
  raw: Record<string, string | number | boolean | null>;
  messages: RowMessage[];
  parsed: ImportParsedGood | null;
  goodId: string | null;
}

export interface ImportBatchDetail extends ImportBatch {
  rows: ImportRow[];
}
