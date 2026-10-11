# Security review

Scope: the web app, the API, and their use of Supabase. Reviewed for the first release.

## What is protected, and from whom

The system holds client names and contacts, purchase costs, selling prices and margins. The main risks are: someone outside the business reading it; a signed-in person doing more than their role allows; a malicious or malformed spreadsheet; and data being changed without a trace.

## Controls

| Area | Control | Where |
|---|---|---|
| Sign-in | Supabase Auth; the API verifies every access token (JWKS signing keys, or the legacy secret) including issuer and audience | `modules/auth/supabase-token.verifier.ts` |
| Provisioning | A valid Supabase login is not enough: the email must exist in WonderImport and be active. Deactivation is immediate | `modules/auth/auth.service.ts` |
| Authorisation | Global guards: every route needs a signed-in user except `GET /health`; roles on every route that changes data | `auth.guard.ts`, `roles.guard.ts` |
| Access matrix | `route-access.spec.ts` compares every route's access with a reviewed list; viewers can never change data; adding a route fails the test until reviewed | `src/route-access.spec.ts` |
| Lockout | The last active administrator cannot be demoted or deactivated; administrators cannot remove their own access | `modules/users/users.service.ts` |
| Database exposure | Row-level security on every table (no policies), so Supabase's public Data API cannot read them with the browser key | `prisma/sql/enable-rls.sql` |
| Secrets | Service-role key and database URLs live only on the API server. The web app only has the publishable key | `.env.example` files |
| Input | Strict validation; unknown fields rejected; money as bounded decimal strings; JSON bodies ≤ 256 KB | `common/validation/` |
| Uploads | ≤ 5 MB, ≤ 2,000 goods, .xlsx or .csv only, checked by content (zip signature, UTF-8, no binary), padded sheets refused, first sheet only, files never stored | `modules/imports/import-file.ts` |
| Imports | Never create clients, suppliers or categories; nothing saved before review; commit re-validates in one transaction | `modules/imports/` |
| Spreadsheet formulas | Text from users is written to Excel as text cells, never as formulas | `modules/exports/workbooks.ts` |
| Rate limits | 300 requests/min per IP; uploads 10/min; exports 20/min; `429 RATE_LIMITED` | `app.module.ts` |
| HTTP headers (API) | Helmet: CSP `default-src 'none'`, no framing, nosniff, HSTS; `Cache-Control: no-store`; CORS limited to `WEB_ORIGIN` and the methods used | `app.setup.ts` |
| HTTP headers (web) | CSP limiting connections to the API and Supabase, `frame-ancestors 'none'`, nosniff, strict referrer, permissions policy, HSTS | `frontend/next.config.ts` |
| Configuration | Production refuses a localhost `WEB_ORIGIN` or a non-HTTPS Supabase URL | `config/env.ts` |
| Audit | Every create, edit, status change, check-in, price override, archive, import, export and account change is recorded with who, when, before and after, in the same transaction as the change | `modules/audit/` |
| Errors | Responses carry a code, a message and a request ID; no stack traces or SQL reach the client | `http-exception.filter.ts` |

## Accepted risks and follow-ups

- **Inline scripts in the web CSP.** Next.js needs `'unsafe-inline'` without a nonce setup. Low risk here (no user HTML is rendered), but moving to nonces is a reasonable later improvement.
- **Rate limits are per API instance** (in memory). With several instances, use a shared store (Redis) for the throttler.
- **Audit log retention** is unlimited. Decide a retention period with the business.
- **Exports leave the system.** They are audited, but once downloaded they are outside WonderImport's control.
- **Session length** follows Supabase settings. Consider shorter refresh-token lifetimes for shared computers.

## Checks to run before each release

`npm test` and `npm run test:e2e` (backend) cover authentication, provisioning, deactivation, the role matrix, body limits, unknown fields, fake uploads, and the security headers. Run `npm audit --omit=dev` in both folders and review anything high or critical.
