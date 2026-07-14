# Pencil Valuation Model

A web application port of the `REAS Valuation Model.xlsm` workbook: a 10-year monthly
discounted-cash-flow **and** static capitalisation valuation model for multi-tenant
commercial property, running entirely in the browser.

## Repository layout

| Path | What it is |
|---|---|
| `REAS Valuation Model.xlsm` | The original Excel workbook (source of the model logic) |
| `PLAN.md` | Reverse-engineering notes and the implementation plan |
| `packages/engine` | `@pencil/engine` — pure TypeScript port of the model (no browser/DOM deps) |
| `apps/web` | `@pencil/web` — React SPA: all input sheets + output pages + PDF report |

## Running

```bash
npm install
npm run dev        # dev server (apps/web)
npm test           # engine unit tests (vitest)
npm run build      # typecheck + production build -> apps/web/dist
```

`apps/web/dist` is fully static — host it anywhere (GitHub Pages, Vercel, S3…).

## What the app does

**Inputs** (mirroring `IP_Assumptions`, `IP_Schedule`, `IP_Outgoings`, each field with
units, tooltips carrying the workbook's instructions, and validation):
General & costs · Vacant space profiles (×10) · Static + DCF assumptions · Other income
(×6) · Capital expenditure · Growth rates & market rent growth · Tenancy schedule
(unlimited rows) · Outgoings.

**Outputs**: Executive Summary (values, yields, IRR, sensitivities) · Cash Flow (annual
& monthly, building + per-tenant, CSV export) · Tenancy summary & market rental profile ·
Analysis (WALE, top-10 tenants, lease expiry profile) · Growth forecasts (Office/Retail
rates tables) · Report page with client-side **PDF download**.

Everything recalculates live on each input change — the workbook's VBA "Update Calcs"
macro and hidden DT_* data tables are replaced by the engine looping over tenants in code.

**Storage**: valuations autosave to the browser (localStorage) as a named library, and can
be exported/imported as JSON documents (versioned with `schemaVersion`).

## v2 readiness (per-client backend + database)

- `@pencil/engine` is a pure, stateless package (`runModel(inputs) → results`) —
  a future `apps/api` imports it unchanged for server-side compute.
- All persistence goes through the `StorageAdapter` interface
  (`apps/web/src/platform/storage.ts`). v1 ships `LocalStorageAdapter`; v2 adds an
  `ApiStorageAdapter` with the same contract.
- Valuation documents carry `schemaVersion` with a migration registry
  (`packages/engine/src/migrations.ts`) shared by any future backend.

## Known deviations from the workbook

- The workbook re-adds the upfront incentive amount every month (`CF_Tenant` E358); the
  engine applies it once at model start.
- Semi-gross base-year recoveries use the tenant's pro-rata share as the base (the
  workbook compares against the whole building's outgoings, which misbehaves with
  multiple tenants).
- Excel's `ROUNDUP` on probability-weighted downtime is reproduced with a
  15-significant-digit snap so `10 × (1 − 0.7)` gives 3 months, not 4.
