# WonderImport operations runbook

Three parts run separately: the **web app** (`frontend/`, Next.js), the **API** (`backend/`, NestJS), and **Supabase** (PostgreSQL database and sign-in). The API is the only thing that touches the database; the browser talks to the API and to Supabase Auth.

## 1. Environments

Keep at least two Supabase projects: **staging** (tests and rehearsals) and **production**. The browser tests create data, so they run against staging only.

| Setting | Where | Notes |
|---|---|---|
| `DATABASE_URL` | API | Supabase transaction pooler, port 6543, `?pgbouncer=true` |
| `DIRECT_URL` | API (migrations) | Session pooler or direct connection, port 5432 |
| `SUPABASE_URL` | API, web (`NEXT_PUBLIC_SUPABASE_URL`) | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Web | Publishable/anon key only |
| `SUPABASE_SERVICE_ROLE_KEY` | API only, optional | Enables invitation emails. **Never** in the web app, never committed |
| `SUPABASE_JWT_SECRET` | API, only for legacy projects | Projects with JWT signing keys don't need it |
| `WEB_ORIGIN` | API | The web app's exact origin(s), comma-separated. Production refuses `localhost` |
| `NEXT_PUBLIC_API_URL` | Web | `https://api.<domain>/api` |
| `TRUST_PROXY` | API | `1` behind a load balancer (Render, Railway, Fly, Nginx) so rate limits see client IPs |
| `RATE_LIMIT_PER_MINUTE` | API | Default 300 per IP; uploads 10/min, exports 20/min are fixed |
| `DB_POOL_MAX` | API | Per instance. Keep instances × pool under the Supabase pooler limit for your plan |
| `NODE_ENV=production` | API | Turns on the production configuration checks |

## 2. First deployment

1. **Supabase (production project)**
   - Authentication → URL Configuration: Site URL = `https://<web domain>`; add `https://<web domain>/auth/confirm` to Redirect URLs.
   - Authentication → Providers: email enabled; turn off public sign-ups (people are invited).
   - Optional, recommended: edit the Invite and Reset Password email templates to link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` (or `type=recovery`).
2. **Database** (from `backend/`, with production `.env`):
   ```bash
   npm ci
   npx prisma migrate deploy      # applies the committed migrations
   npm run db:secure              # row-level security on every table
   SEED_DEMO_GOODS=false npm run db:seed   # pricing defaults, first admin, categories, stock client
   ```
   Commit `backend/prisma/migrations/` from development; production only ever runs `migrate deploy`.
3. **API** (any Node 22 host): build `npm ci && npm run build`, start `node dist/main.js`, health check `GET /api/health`. Set the variables above.
4. **Web app** (Vercel or any Node host): root directory `frontend/`, build `npm run build`, start `npm start`. Set the three `NEXT_PUBLIC_*` variables **before** building; they are baked into the bundle and into the content security policy.
5. **First administrator**: invite the `SEED_ADMIN_EMAIL` address in Supabase (Authentication → Users → Invite). On first sign-in the account links automatically. Add everyone else from **Settings → People**.

## 3. Releasing a new version

1. CI must be green (`.github/workflows/ci.yml`: typecheck, unit tests, API end-to-end tests, web build).
2. Deploy to staging, run **Browser tests (staging)** from GitHub Actions, and go through `docs/RELEASE-CHECKLIST.md`.
3. Production: `npx prisma migrate deploy` → `npm run db:secure` (only if the release adds tables) → deploy the API → deploy the web app.
4. Watch `GET /api/health` and the API logs for 15 minutes.

**Rolling back**: redeploy the previous API and web builds. Migrations are written to be additive (new columns and tables), so the previous build runs against the newer schema. Never run `migrate reset` on production.

## 4. Backups and restore

- **Automatic**: Supabase takes daily backups (retention depends on plan). For a business system, enable **Point-in-Time Recovery** on the production project.
- **Before every release and every large import**, take a manual dump:
  ```bash
  pg_dump "$DIRECT_URL" --format=custom --no-owner --file="wonderimport-$(date +%F-%H%M).dump"
  ```
  Store dumps outside Supabase (encrypted storage). They contain client contact details.
- **Restore drill (quarterly, into staging)**:
  ```bash
  pg_restore --clean --if-exists --no-owner --dbname="$STAGING_DIRECT_URL" wonderimport-YYYY-MM-DD-HHMM.dump
  cd backend && npm run db:secure
  ```
  Then sign in to staging and compare the dashboard totals with production at the dump time. Record the date and result.
- Exported Excel files are copies of business data; treat them like the dumps.

## 5. Monitoring

- `GET /api/health` returns `{ status, database, latencyMs }`; HTTP 503 when the database is unreachable. Point an uptime monitor at it (1-minute interval).
- Every API response carries `x-request-id`. Error messages in the web app show the same ID; search the API logs for it.
- API logs record method, path, status and duration per request, never tokens or bodies.

## 6. Incidents

| Situation | What to do |
|---|---|
| Web app shows "Cannot reach the WonderImport API" | Check `/api/health`. If it doesn't respond, restart the API and check its logs. If it reports `database: down`, check status.supabase.com and the project's pooler limits (`DB_POOL_MAX` × instances). |
| Everyone is signed out or gets "session expired" | Check the Supabase project is up. If JWT signing keys were rotated, the API picks up new public keys automatically; on a legacy project update `SUPABASE_JWT_SECRET` and restart. |
| A person signs in but sees "You don't have access yet" | Add their exact email in Settings → People. |
| Someone leaves the business | Settings → People → Deactivate. Takes effect on their next request. Also delete or ban them in Supabase Authentication. |
| The wrong file was imported | Open it in Imports → "Archive the goods from this import" (administrators). Goods are archived, not deleted, and each can be restored. |
| Many goods have the wrong exchange rate | Filter Goods to them, export to keep a record, then correct each (the history records old and new values). Change Settings → Pricing defaults so new goods use the right rate. |
| "Too many requests" | Normal limits are 300 requests per minute per IP. Behind a proxy without `TRUST_PROXY`, all users share one IP; set it. |
| A secret leaked (service-role key, database password) | Rotate it in Supabase immediately (Settings → API / Database), update the API's environment, restart. Review `audit_logs` for the exposure window. |
| Data looks wrong and the cause is unknown | Every change is in `audit_logs` (who, when, before, after). Each good's History panel shows its own trail. Restore from a dump into staging to compare if needed. |
