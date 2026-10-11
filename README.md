# WonderImport

Internal platform for the importation business: goods from supplier purchase to client delivery, with the cost, price and profit of every item.

```text
wonderimport/
  backend/    NestJS API, Prisma 7.10, Supabase PostgreSQL + Auth
  frontend/   Next.js 16 web app, Tailwind CSS 4, Zustand, Axios
  docs/
    PHASE-0-DECISIONS.md          business rules, field dictionary, roles, calculations, visual system
    design/dashboard-preview.html target dashboard design, built from the reference spreadsheet
    RUNBOOK.md                    deploy, configure, back up, restore, incidents
    SECURITY.md                   controls, accepted risks, pre-release checks
    ACCESSIBILITY.md              WCAG 2.1 AA review and automated checks
    RELEASE-CHECKLIST.md          tick-list for each release
  .github/workflows/              CI (typecheck, unit, API end-to-end, web build) and staging browser tests
```

## Tests

| Command | Where | What |
|---|---|---|
| `npm test` | `backend/` | Unit tests: pricing, shipment rules, financial planner, dashboard and client totals, import parsing and validation, upload checks, the route access matrix, guards, audit |
| `npm run test:e2e` | `backend/` | The API over HTTP against a disposable Postgres (`.env.test`): security, permissions, goods lifecycle, reconciliation, import, export, people |
| `npm run test:e2e` | `frontend/` | Playwright against a running staging app: workflows, keyboard use, and an axe WCAG 2.1 AA scan of every screen in both themes and on a phone |

After the first `npm install` in each folder, commit the `package-lock.json` files and `backend/prisma/migrations/`; CI and production rely on them.

## Run locally (no Docker)

1. Create a Supabase project.
2. Backend: follow `backend/README.md` (env, migrate, secure, seed, `npm run dev` on port 4000).
3. Frontend: follow `frontend/README.md` (env, `npm run dev` on port 3000).
4. Sign in with the administrator email you set as `SEED_ADMIN_EMAIL`.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Decisions, field dictionary, role matrix, calculation examples, visual system | Done |
| 1 | Auth, roles, full data model, audit log, error/validation conventions, health, app shell, UI primitives | Done |
| 2 | Clients, suppliers, categories; goods table, create/edit, status updates, China check-in, history | Done |
| 3 | Dashboard (key figures, shipping route, leading clients, recent goods), client profitability | Done |
| 4 | Spreadsheet import with review, filtered Excel export | Done |
| 5 | End-to-end tests, security hardening, accessibility fixes, people management, import undo, runbooks, CI | Done |
