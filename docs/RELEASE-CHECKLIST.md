# Release checklist

Copy this into the release ticket and tick each line.

## Before deploying to staging

- [ ] CI green: backend typecheck, unit tests, API end-to-end tests; web typecheck and build
- [ ] `npm audit --omit=dev` reviewed in `backend/` and `frontend/` (no unresolved high or critical)
- [ ] New migrations are additive and committed in `backend/prisma/migrations/`
- [ ] `route-access.spec.ts` updated for any new route, and the change reviewed by a second person

## Staging

- [ ] `npx prisma migrate deploy` and `npm run db:secure` ran without errors
- [ ] Browser tests (staging) workflow passed, including the accessibility scan in both themes and on phone
- [ ] Manual pass with a screen reader: sign in, add a good, move it a stage, import, export
- [ ] Import the original *Final Importation Analysis* workbook into staging: 219 of 222 rows importable, 26 repeats left unticked, 3 rows to fix
- [ ] Dashboard figures open goods lists that add up to the same totals
- [ ] An exported file opens in Excel with a totals row and an "About this export" sheet
- [ ] As a viewer: no Add, Edit, Import or Export controls, and the API refuses writes

## Production

- [ ] Manual `pg_dump` taken and stored (see RUNBOOK §4)
- [ ] Production variables set: `NODE_ENV=production`, `WEB_ORIGIN`, `TRUST_PROXY`, HTTPS Supabase URL; the service-role key (if used) only on the API
- [ ] Supabase: public sign-ups off, Site URL and `/auth/confirm` redirect set, Point-in-Time Recovery on
- [ ] `npx prisma migrate deploy`, then `npm run db:secure` if tables were added
- [ ] API deployed; `GET /api/health` returns `ok`; uptime monitor watching it
- [ ] Web app deployed (built with production `NEXT_PUBLIC_*` values)
- [ ] Sign in as an administrator; dashboard loads; one good can be opened
- [ ] Logs watched for 15 minutes; no 5xx errors
