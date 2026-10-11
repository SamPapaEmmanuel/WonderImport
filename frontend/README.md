# WonderImport — frontend

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4. Auth is Supabase; all data comes from the NestJS API through one Axios instance.

## Setup

```bash
cp .env.example .env.local    # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev                   # http://localhost:3000
```

In Supabase (Authentication → URL Configuration) set **Site URL** to `http://localhost:3000` and add `http://localhost:3000/auth/confirm` to **Redirect URLs**, so invitation and password-reset links land on the set-password screen.

## Layout

```text
src/
  proxy.ts                 Next 16 proxy: refreshes the Supabase session, redirects signed-out users to /login
  app/
    (auth)/                sign-in, set password, email-link handler
    (app)/                 protected screens inside the application shell
  features/                business screens, one folder per domain
    auth/  dashboard/  settings/
    goods/                 list, filters (URL-synced), inline status and check-in, form and detail drawers
    dashboard/             key figures, shipping route, leading clients, recent goods (every figure links to its goods)
    clients/               list with profitability, client detail page
    imports/               upload with defaults, row-by-row review, commit, rows-to-fix download
    exports/  reports/     Excel downloads (Goods and Clients export their current view; Reports has presets)
    master-data/  lookups/
  components/
    ui/                    primitives: Button, Input, Select, Field, Panel, DataTable, Dialog, badges, states
    layout/                AppShell, Sidebar, Topbar, MobileNav, SessionGate, PageHeader
  lib/
    axios-instance.ts      token attach, refresh-once on 401, ApiError normalisation
    supabase/              browser, server and proxy clients
    format.ts status.ts roles.ts types.ts
  stores/                  Zustand: UI preferences, signed-in user
```

## Browser tests

```bash
npx playwright install chromium
E2E_BASE_URL=https://staging.example E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
```

Run against staging only; the tests create goods and imports. `e2e/a11y.spec.ts` fails on any serious or critical WCAG 2.1 AA issue.

## Security headers

`next.config.ts` sets a content security policy that only allows connections to this site, `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SUPABASE_URL`, so set those before `npm run build`.

## How the Goods workspace keeps state

The URL holds every filter, the sort, the page and the open good (`?good=<id>`), using exactly the API's query keys, so the same string is sent to `GET /api/goods`. Links can be shared, Back works, and the Excel export uses the same query. The last query is kept in session storage (Zustand) and restored when Goods is opened without one. Status moves and check-ins update the row immediately and roll back if the server refuses.

## Design tokens

Defined once in `src/app/globals.css` and exposed as Tailwind colours (`bg-fjord`, `text-ink-2`, `border-line`, …). Light and dark themes share the same names. See `docs/PHASE-0-DECISIONS.md` §7 and `docs/design/dashboard-preview.html`.
