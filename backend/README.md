# WonderImport — backend

NestJS 11 API with Prisma 7.10 on Supabase PostgreSQL. All routes live under `/api` and require a Supabase access token except `GET /api/health`.

## Setup

```bash
cp .env.example .env          # fill in DATABASE_URL, DIRECT_URL, SUPABASE_URL, SEED_ADMIN_EMAIL
npm install                   # also runs `prisma generate`
npx prisma migrate dev --name init
npm run db:secure             # enable row-level security on every table (see below)
npm run db:seed               # pricing defaults, admin, master data, 220 demo goods
npm run dev                   # http://localhost:4000/api
```

**Row-level security.** Supabase publishes the `public` schema through its Data API. `db:secure` switches RLS on for every WonderImport table with no policies, so the browser's publishable key cannot read them; the API connects as the table owner and is unaffected. Run it again after any migration that adds a table.

**First administrator.** The seed creates a user row for `SEED_ADMIN_EMAIL`. Create the same email in Supabase (Authentication → Users → Add user, or Invite). On first sign-in the API links the Supabase account to that row and records an `ACCOUNT_LINK` audit entry. Anyone who signs in without a user row gets `ACCOUNT_NOT_PROVISIONED`.

## Upgrading an existing Phase 1 database

Phase 2 adds a stored `margin` column to goods (so lists can sort by it):

```bash
npx prisma migrate dev --name goods_margin
npm run db:backfill-margin    # fills margin for goods recorded before the column existed
```

## Upgrading to Phase 5

No database changes. `npm install` adds `helmet`, `@nestjs/throttler` and test tools. New optional settings in `.env.example`: `SUPABASE_SERVICE_ROLE_KEY` (invitation emails), `TRUST_PROXY`, `RATE_LIMIT_PER_MINUTE`, `DB_POOL_MAX`.

## Upgrading to Phase 4

Phase 4 adds columns to the import tables:

```bash
npm install                       # adds exceljs and multer types
npx prisma migrate dev --name imports
```

## Endpoints

Read endpoints are open to every signed-in user. "Staff" means administrators and staff.

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/health` | Public | Database reachability and latency |
| GET | `/api/auth/me` | Signed in | |
| GET / PATCH | `/api/settings/pricing` | PATCH: admin | Default exchange rate, audited |
| GET | `/api/lookups` | Signed in | Active clients, suppliers, categories for dropdowns |
| GET | `/api/goods` | Signed in | Filters: `q`, `status` (repeatable), `checkIn=yes\|no\|missing`, `clientId`, `supplierId`, `categoryId`, `orderedFrom`, `orderedTo`, `priceOverridden`, `archived=exclude\|only\|include`, `sort=field:dir`, `page`, `pageSize` |
| GET | `/api/goods/:id` | Signed in | Includes status history and financial snapshots |
| GET | `/api/goods/:id/history` | Staff | Audit entries, newest first |
| POST | `/api/goods` | Staff | Price is computed by the API; `sellingPrice` + `overrideReason` set a manual price |
| PATCH | `/api/goods/:id` | Staff | Partial update; `sellingPrice: null` returns to the suggested price |
| PATCH | `/api/goods/:id/status` | Staff | `{ status, expectedStatus?, correction?, note? }`. One stage forward; corrections are admin-only with a note. Returns `warnings` |
| PATCH | `/api/goods/:id/china-check-in` | Staff | `{ checkedIn }`. Undoing a check-in is admin-only |
| POST | `/api/goods/:id/duplicate` · `archive` · `restore` | Staff | |
| GET | `/api/dashboard/summary` | Signed in | `period=30d\|90d\|ytd\|all` (default all) or `from`/`to`. Totals, six-stage pipeline, leading clients, unassigned stock, 8 recently updated goods |
| GET / POST / PATCH | `/api/clients`, `/api/clients/:id` | Writes: staff | Each client includes `summary`: goods, units, landed cost, revenue, profit, margin, delivered, in progress, count by status. Sort by `name`, `code`, `goods`, `revenue`, `profit`, `margin`. Codes are generated as `CL-###` |
| POST | `/api/clients/:id/archive` · `restore` | Staff | The stock client cannot be archived |
| GET / POST / PATCH | `/api/suppliers`, `/api/categories` | Writes: admin | `archive` / `restore` likewise |

| GET | `/api/imports/template?format=xlsx\|csv` | Staff | Template with dropdowns, a field guide and the current client/supplier/category lists |
| POST | `/api/imports` | Staff | Multipart: `file` (.xlsx or .csv, 5 MB, 2,000 goods) plus optional `defaultClientId`, `defaultSupplierId`, `defaultCategoryId`, `defaultStatus`, `defaultExchangeRate`. Validates every row; creates nothing |
| GET | `/api/imports`, `/api/imports/:id` | Staff | History; one import with every row, its messages and price preview |
| POST | `/api/imports/:id/commit` | Staff | `{ rowNumbers }`. Re-validates, then creates the goods in one transaction |
| POST | `/api/imports/:id/cancel` | Staff | |
| GET | `/api/imports/:id/errors` | Staff | Rows that need fixing as .xlsx, with a "What to fix" column; can be uploaded again |
| GET | `/api/exports/goods` | Staff | The `GET /goods` filter contract, without paging (up to 50,000). Totals row and an "About this export" sheet. Audited |
| GET | `/api/exports/clients` | Staff | Client profitability, same filters and sort as the client list. Audited |

| GET / POST | `/api/users` | Admin | People and roles; `{ email, name, role, sendInvite? }`. Invitations need `SUPABASE_SERVICE_ROLE_KEY` |
| PATCH | `/api/users/:id` | Admin | `{ name?, role?, active? }`. The last active administrator cannot be demoted or deactivated |
| POST | `/api/users/:id/invite` | Admin | Resend the invitation email |
| POST | `/api/imports/:id/archive-goods` | Admin | `{ reason }`. Undo for a mistaken import: archives the goods it created |

Every route's access rule is listed and enforced in `src/route-access.spec.ts`.

Sort fields for goods: `orderedAt`, `status`, `totalCost`, `expectedRevenue`, `profit`, `margin`, `client`, `updatedAt`, `createdAt`, `itemName`, `quantity`.

### Rules enforced by the API

- **Pricing** (`modules/goods/goods-financials.ts`): without an override, the selling price follows unit cost × rate × 3 and is recalculated whenever cost, rate or quantity change. A manual price survives later cost changes until it is cleared. Setting or changing a manual price requires a reason. Every financial change writes a snapshot.
- **Exchange rate**: new goods default to the company rate; existing goods keep their stored rate when the default changes.
- **Shipment**: one stage forward at a time. Moving back, reopening Delivered or skipping ahead is an admin correction with a reason; moving back clears the dates of later stages. Leaving China warehouse without a check-in is allowed and returns `CHINA_CHECK_IN_PENDING`.
- **Stale updates**: `expectedStatus` makes a status change fail with `CONFLICT` if someone else moved the good first.
- **Reconciliation**: the dashboard builds its WHERE clause with the same `goodsWhere()` as `GET /goods`, and each figure's link uses the period's resolved dates, so a figure always equals the total of the list it opens. Pipeline stages, client totals plus unassigned stock, and the KPI totals are all the same sum.
- **Margins** for groups (dashboard, clients) are total profit ÷ total revenue, not an average of item margins.
- **Periods** filter on the order date in Ghana time (UTC). "Last 30 days" includes today.
- **Imports** never create clients, suppliers or categories. Names are matched exactly (ignoring capitals and surrounding spaces); clients also by code. Upload defaults fill empty cells only. Repeats of an earlier row, or of a good already recorded (same tracking number, item, quantity and cost), are warnings and start unselected. A manual selling price without a reason records the file and row as the reason. The original "Final Importation Analysis" workbook is recognised as-is: its title rows are skipped and its formula columns ignored.
- **Exports** use the same `goodsWhere()` and `goodsOrderBy()` as the list, so a file always matches the screen. Totals are SUM formulas with exact cached results; the margin total is profit ÷ revenue.
- **Archiving** hides goods from lists and totals; archived goods, clients, suppliers and categories cannot be edited or chosen until restored.

## Layout

```text
prisma/
  schema.prisma          full data model (goods, history, snapshots, audit, imports, settings)
  seed.ts, seed-data/    demo data generated from the reference spreadsheet
  sql/enable-rls.sql
prisma.config.ts         Prisma 7 config: connection URL, migrations path, seed command
src/
  config/env.ts          validated environment
  prisma/                PrismaService (pg driver adapter)
  common/
    errors/              stable error codes, AppException, global exception filter
    validation/          strict ValidationPipe → VALIDATION_FAILED with per-field messages
    pagination/          list envelope { data, meta, context }
    logging/             request IDs and access log
    finance/             pricing.ts (decimal maths) and shipment.ts (state rules), with tests
  modules/
    auth/                Supabase JWT verification (JWKS or legacy secret), global auth + role guards, /auth/me
    audit/               AuditService.record(entry, tx) — writes inside the caller's transaction
    health/
    settings/            pricing defaults
    lookups/             dropdown options in one request
    clients/  suppliers/  categories/
    goods/               list query builder, financial planner, service, controller
    dashboard/           period resolver, pure summary builder, grouped queries
    imports/             column aliases, file reading, pure row validation, template, review and commit
    exports/             goods and client workbooks, plain-language filter summary
```

## Conventions

- Money is never a JavaScript number in business logic: `decimal.js` in code, `NUMERIC` in the database, decimal strings over the wire.
- Every write goes through a transaction that also writes its `AuditLog` row.
- Throw `AppException` with an `ErrorCode`; the filter produces `{ error: { code, message, fields?, requestId } }`.
- Protect routes with `@Roles(Role.ADMIN, …)`. Routes without `@Roles` are open to any signed-in user; `@Public()` skips authentication.

## Tests

```bash
npm test            # unit tests, no database needed
cp .env.test.example .env.test   # point at a DISPOSABLE database
npm run test:e2e    # the API over HTTP against that database (it is wiped)
```

Covers pricing (the worked examples from `docs/PHASE-0-DECISIONS.md`), the override rules, shipment transitions and corrections, check-in permissions, the goods filter and sort builder, the role guard, account linking, and audit serialisation.
