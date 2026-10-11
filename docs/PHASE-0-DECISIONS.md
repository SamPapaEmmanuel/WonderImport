# Phase 0 — Product decisions and visual foundation

This record settles the business rules that the database and API depend on. Items marked **Confirm** are working assumptions taken from the spreadsheet; they are already built in, and changing one later is a small, contained edit.

## 1. What the spreadsheet told us

The reference workbook (`Final Importation Analysis.xlsx`, sheet `Import`, 220 goods) shaped these decisions. Several findings change the plan:

| Finding | Effect on WonderImport |
|---|---|
| `Cost Per 1Unit` is in Chinese yuan; `Sheet1` holds `1 GHS = 0.53 CNY`, which is where `1.887` (= 1 ÷ 0.53) comes from. | Unit cost is entered in **CNY**. Exchange rate is **GHS per 1 CNY** (default `1.887`). All reporting is in **GHS**. |
| `Selling Price (Ghana Cedis)` per unit is `unit cost × 3 × 1.887`. | Matches the plan's rule exactly: suggested price = unit cost × rate × 3. |
| The `Profit` column equals the yuan cost (`=J5`), not selling price minus cost. Cost is never converted to cedis. | The spreadsheet's profit figures are not reliable. WonderImport computes profit in GHS as revenue − landed cost. |
| `Actual Selling Price` is filled on 117 rows and usually differs from the ×3 price (e.g. New Balance 1906: suggested GHS 747.25, sold at GHS 350). | Treated as an **audited price override**. The suggested price is kept beside it. |
| `Retail Price` is a separate, often higher figure. | Stored as optional `retailPrice` for reference; it does not affect totals. |
| The same `Delivery ID` repeats on several rows (one parcel holding several items). | **Tracking number is not unique.** The importer warns on exact duplicates (same tracking number, item, quantity and cost) instead. **Confirm.** |
| `Person for` is empty on 171 of 220 rows; one row reads `Cons, Grace`. | A system client **Stock (unassigned)** holds goods bought for resale. Each good belongs to one client; shared rows are assigned to the first name. **Confirm.** |
| `Check In`, `Received At Warehouse` and `Item Sold` are empty everywhere. | These become first-class fields (check-in with actor and time, stage dates, `quantitySold`) so they are captured from now on. |
| Summary cells use fixed ranges (`=SUM(M5:M122)`) that miss later rows. | Dashboard totals are computed live from the database. |
| No supplier or shipment status columns exist. | Seed data uses placeholder suppliers and demo statuses; real values come in through Phase 2 editing and Phase 4 import. |

## 2. Field dictionary — Good

| Field | Type | Rule |
|---|---|---|
| `itemName` | text, required | 1–200 characters |
| `trackingNumber` | text, optional | Indexed, not unique |
| `quantity` | integer, required | ≥ 1 |
| `quantitySold` | integer | 0 ≤ sold ≤ quantity; `itemsLeft = quantity − quantitySold` |
| `unitCost` | decimal(14,4), CNY | > 0 |
| `exchangeRate` | decimal(12,6), GHS per CNY | > 0; defaults from Settings |
| `priceMultiplier` | decimal(6,3) | Fixed at 3 for now; stored per good so history is reproducible |
| `suggestedPrice` | decimal(14,2), GHS | Computed by the API |
| `sellingPrice` | decimal(14,2), GHS | Active price: the override if set, else suggested |
| `priceOverridden`, `overrideReason`, `overriddenBy`, `overriddenAt` | | Reason required when overriding |
| `retailPrice` | decimal(14,2), GHS, optional | Reference only |
| `totalCost`, `expectedRevenue`, `profit` | decimal(16,2), GHS | Written by the API on every change so dashboards can aggregate in SQL |
| `status` | enum | `ORDERED → AT_SUPPLIER → CHINA_WAREHOUSE → IN_TRANSIT → ARRIVED → DELIVERED` |
| `chinaCheckedIn`, `chinaCheckedInAt`, `chinaCheckedInBy` | | |
| `orderedAt`, `supplierReceivedAt`, `warehouseReceivedAt`, `departedAt`, `arrivedAt`, `deliveredAt` | date | Optional |
| `client`, `supplier`, `category` | relations, required | |

## 3. Calculations and rounding

All arithmetic uses decimal numbers (`decimal.js` in the API, `NUMERIC` in PostgreSQL) — never binary floats. Money rounds **half-up to 2 places** at these exact points:

1. `suggestedPrice = round2(unitCost × exchangeRate × multiplier)`
2. `totalCost = round2(quantity × unitCost × exchangeRate)`
3. `expectedRevenue = quantity × sellingPrice` (already 2 places)
4. `profit = expectedRevenue − totalCost`
5. `margin = round2(profit ÷ expectedRevenue × 100)`; shown as `—` when revenue is zero

Worked examples from the spreadsheet, rate 1.887:

| Item | Qty | Unit cost | Suggested | Active price | Landed cost | Revenue | Profit | Margin |
|---|---|---|---|---|---|---|---|---|
| Bag | 1 | ¥2.00 | 11.32 | 15.00 (override) | 3.77 | 15.00 | 11.23 | 74.87% |
| Wall Tape | 10 | ¥3.24 | 18.34 | 18.00 (override) | 61.14 | 180.00 | 118.86 | 66.03% |
| NewBalance1906 | 1 | ¥132.00 | 747.25 | 350.00 (override) | 249.08 | 350.00 | 100.92 | 28.83% |
| Sports Chest Bag | 1 | ¥6.00 | 33.97 | 33.97 (suggested) | 11.32 | 33.97 | 22.65 | 66.68% |

These four cases are the unit tests in `backend/src/common/finance/pricing.spec.ts`.

## 4. Role matrix

| Capability | Admin | Staff | Viewer |
|---|---|---|---|
| View dashboard, goods, clients | ✓ | ✓ | ✓ |
| Create and edit goods, clients | ✓ | ✓ | |
| Advance shipment status, record China check-in | ✓ | ✓ | |
| Undo a China check-in | ✓ | | |
| Override selling price (with reason) | ✓ | ✓ | |
| Correct an earlier shipment stage or reopen Delivered | ✓ | | |
| Manage suppliers and categories | ✓ | | |
| Import spreadsheets | ✓ | ✓ | |
| Export goods | ✓ | ✓ | |
| View audit history | ✓ | ✓ | |
| Change exchange-rate default, manage users | ✓ | | |

Staff may override prices (with a required reason), because `Actual Selling Price` is set routinely in the spreadsheet.

## 5. Reporting conventions

- Base currency GHS; source currency CNY.
- The dashboard period filters on `orderedAt`; default is **All time**, with 30 days and Quarter as quick options.
- "In transit" on the dashboard means status `IN_TRANSIT` only.
- Unassigned stock is excluded from client rankings and shown as its own note.

## 6. API conventions

- Base path `/api`. JSON only. Authentication by `Authorization: Bearer <Supabase access token>`.
- List envelope: `{ data: [...], meta: { page, pageSize, total }, context: { filters, sort } }`. `page` starts at 1; `pageSize` defaults to 25, maximum 100.
- Error envelope:
  ```json
  { "error": { "code": "VALIDATION_FAILED", "message": "2 fields are invalid", "fields": [{ "field": "quantity", "code": "min", "message": "quantity must not be less than 1" }], "requestId": "…" } }
  ```
  Stable codes: `UNAUTHENTICATED`, `ACCOUNT_NOT_PROVISIONED`, `ACCOUNT_DISABLED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `CONFLICT`, `INVALID_STATUS_TRANSITION`, `INTERNAL_ERROR`.
- Filters are query parameters; multi-value filters repeat the key (`status=IN_TRANSIT&status=ARRIVED`). Sorting: `sort=profit:desc`.
- Every write records an `AuditLog` row: entity, entity id, action, before and after JSON, actor, time, inside the same transaction as the change.

## 7. Visual system

Preview: `docs/design/dashboard-preview.html` (built from the spreadsheet's 220 rows).

The palette is cool and maritime, taken from the shipping subject: a deep harbour navy for navigation, a fjord teal for actions, and a status spectrum that cools from slate to mint as goods move closer to delivery.

| Token | Hex | Use |
|---|---|---|
| Harbour | `#12283A` | Sidebar, headings |
| Fjord | `#17697A` | Primary actions, active states |
| Tide | `#2E8FC0` | Links, In transit |
| Glacier | `#E6F0F3` | Selected and subtle surfaces |
| Mist | `#F3F6F8` | App background |
| Mint | `#2A9D7F` | Profit, Delivered |
| Rose | `#C24563` | Loss, errors |
| Amber | `#B7791F` | Warnings (missing check-in) |

Text shades (adjusted in Phase 5 for WCAG AA contrast, at least 4.6:1 on every background): grey hints `#5D6A75`, links `#247096`, profit `#20765F`, loss and errors `#B4405C`, warnings `#8F5E18`; dark theme `#859AAA`, `#4DA0C9`, `#41A88D`, `#D57F93`, `#C38E43`. The hues above remain for dots, lines and fills.

Status colours: Ordered `#8A9AAB`, At supplier `#6C7FD8`, China warehouse `#8B6FC9`, In transit `#2E8FC0`, Arrived `#1F9E9A`, Delivered `#2A9D7F`. Status is always shown as dot plus text, never colour alone.

Type: IBM Plex Sans for everything, with tabular figures; IBM Plex Mono only for tracking numbers. Scale: 24 / 15 / 14 / 13 / 12 px. Surfaces are white panels with a 1px border and 12px radius; no shadows, gradients, or decorative imagery. Tables are dense (40px rows) with right-aligned numbers. Light and dark themes share the same tokens.

The one distinctive element is the **shipping route**: the six stages drawn as stations on a line, each showing its goods count and landed cost, linking to the filtered goods list.
