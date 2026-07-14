# REAS Valuation Model — Web App Plan

Goal: a web application that reproduces the "REAS Valuation Model.xlsm" (Pencil Valuation Model)
so a valuer can enter all inputs in the browser, run the model instantly (no macros), and read the
key outputs — an Executive Summary page and Cash Flow pages — with the same numbers the
spreadsheet would produce.

---

## 1. What the spreadsheet does (reverse-engineered)

A 10-year monthly DCF + static capitalisation valuation model for a multi-tenant commercial
property (office/retail/car parking etc.).

**Input sheets (to be reproduced in full):**

| Sheet | Contents |
|---|---|
| `IP_Assumptions` | 1.0 General (purpose, valuation date, property details, adopted value) · 2.0 Selling & acquisition costs · 3.0 Vacant-space profiles ×10 (lease term, review frequency, ratchet, renewal probability, leasing commissions, letting-up allowances by expiry year, incentives by expiry year) · 4.0 Static (cap) assumptions (core cap rate, PV discount rate, reversion window, capex deduction, vacancy allowance, sensitivities) · 5.0 DCF assumptions (period, discount rate, terminal yield, sensitivities) · 6.0 Other income sources ×6 (fixed-term / perpetuity) · 7.0 Capex switches (fixed, sinking fund, upgrades on expiry/renewal, specified-by-date rows) & structural R&M · 8.0 Growth rates by model year (CPI, capex, outgoings, car parking) · 9.0 Market rent growth tables (Office, Retail: face/effective, letting-up, incentives) |
| `IP_Schedule` | Tenancy schedule, one row per tenancy: suite, use, NLA, market rent (net/gross $/m², outgoings override), growth profile, status (Leased/Vacant), tenant name, lease start/expiry, next review, review structure (types per year: CPI/Fixed/Market/Manual with override values), vacant-space profile assignment, base rent (Net/Gross/Semi-Gross, $ p.a., ratchet), recoveries (yes/no, base-year amount, % of outgoings), car parking (spaces, rent), outstanding rent-free / incentives (months, % free, upfront) |
| `IP_Outgoings` | Statutory expenses, operating expenses, non-recoverables (each with $/NLA and PCA-benchmark comparison), recoverable totals |

**Engine (hidden machinery in Excel, replaced by code):**

- `CF_Tenant` computes ONE tenant at a time on a monthly timeline (Model Start = month after
  valuation date, 120+ months): up to 10 successive tenancy generations (current lease → renewal
  cycles from the vacant-space profile), occupancy/review/commencement/expiry flags, market rent
  growth compounding, base-rent review logic (CPI, fixed %, to-market, manual, ratchet clauses),
  car-parking rent, recoveries (net vs gross leases, growth-inflated outgoings), and
  renewal-probability-weighted downtime (letting-up), incentives, leasing commissions and capital
  upgrades on each expiry.
- A VBA macro loops the active tenant and snapshots results into hidden `DT_*` data-table sheets
  (base lease income, outgoings recovered, commissions, incentives, market rent, letting-up,
  capital upgrades). **The web app removes this entirely — the engine just loops over tenants in
  code**, so results are always live (no "Update Calcs Ctrl+U").
- `CF_Building` aggregates tenants + building outgoings (grown), additional income, capex.
- `Calc_DCF`: monthly discounting, terminal value at terminal yield (gross-up of month-121 market
  income less outgoings, plus reversions, less selling costs), NPV, capital value net of
  acquisition costs, resultant IRR, 3×3 discount-rate × terminal-yield sensitivity.
- `Calc_Cap`: static capitalisation — net market income ÷ core cap rate, ± PV adjustments
  (rental reversions, letting-up, commissions, outstanding + upcoming incentives, capex,
  additional income, manual adjustment), plus yield analysis (passing initial, fully-leased,
  equivalent market, reversionary) and cap-rate sensitivity row.

**Output sheets (key ones to reproduce):**

- `OP_Exec` / `DCF-Output` — executive summary: property + valuation details, rental profile by
  use, DCF analysis, capitalisation analysis, reconciliation, adopted value, key yields/IRR,
  sensitivity tables.
- `OP_CashFlow_A` / `OP_CashFlow_M` — annual and monthly cash flows: building-level P&L
  (gross lease income, recoveries, additional income, outgoings, commissions, incentives, capex,
  net cash flow, running yield) and per-tenant breakdowns by category.

---

## 2. Proposed architecture

**Client-only SPA — no backend.** The model is pure deterministic arithmetic; a few thousand
tenant-months compute in well under a millisecond in JS. Everything runs in the browser,
recalculating live on every input change (a genuine improvement over the macro-driven workbook).

- **Stack:** Vite + React + TypeScript. No server, deployable as static files (GitHub Pages /
  Vercel / any static host).
- **Engine:** a pure, UI-free TypeScript library (`src/engine/`) so it is unit-testable in
  isolation and reusable later (CLI, API, Excel export).
- **State:** single JSON document mirroring the three input sheets; React context + reducer;
  autosaved to `localStorage`; **Export / Import JSON** buttons so valuations can be saved,
  shared, and version-controlled. Ships with the workbook's default assumption values as the
  starting template.
- **Numbers:** plain IEEE doubles (same as Excel); date arithmetic ported to match Excel's
  `EOMONTH` month-end conventions exactly.

### 2.1 Repository layout

```
package.json            # npm workspaces root
packages/engine/        # pure TS model library (shared with v2 backend later)
apps/web/               # Vite + React SPA
  src/
    engine -> imports @pencil/engine
      types.ts            # Input schema (assumptions, tenancy rows, outgoings) + result types
      dates.ts            # EOMONTH-style month-end helpers, model timeline
      growth.ts           # CPI/capex/outgoings/market growth curves, compound indices
      marketRent.ts       # Office/Retail market rent tables (face/effective, incentives, letting-up)
      tenant.ts           # Port of CF_Tenant: per-tenant monthly cash flow (the core)
      building.ts         # Port of CF_Building: aggregation, outgoings, other income, capex
      cap.ts              # Port of Calc_Cap: static capitalisation + yields + sensitivity
      dcf.ts              # Port of Calc_DCF: NPV, terminal value, IRR, sensitivity matrices
      validate.ts         # Input validation mirroring the workbook's error checks & lists
      index.ts            # runModel(inputs) -> ModelResults (one pure function)
    state/                # store, localStorage persistence, JSON import/export, defaults
    components/           # form controls with labels+units+help, data grid, tables, charts
    pages/
      inputs/
        GeneralPage.tsx       # IP_Assumptions §1–2 (property, dates, costs, valuers)
        ProfilesPage.tsx      # §3 vacant-space profiles (10 columns)
        ValuationPage.tsx     # §4 static + §5 DCF assumptions
        OtherIncomePage.tsx   # §6 other income sources
        CapexPage.tsx         # §7 capex & R&M switches + specified capex table
        GrowthPage.tsx        # §8–9 growth-rate and market-rent tables
        TenancyPage.tsx       # IP_Schedule grid (add/duplicate/delete tenant, per-row detail)
        OutgoingsPage.tsx     # IP_Outgoings
      outputs/
        SummaryPage.tsx       # Executive summary (OP_Exec + DCF-Output content)
        CashflowPage.tsx      # Annual & monthly cash flow (OP_CashFlow_A/M + Calc_DCF views)
        TenancyPage.tsx       # Tenancy summary + market rental profile (OP_Tenancy)
        AnalysisPage.tsx      # Top-10 by area/income, expiry profile, WALE (OP_Analysis)
        RatesPage.tsx         # Office/Retail growth forecasts (OP_Rates)
        ReportPage.tsx        # Full report + PDF download (OP_Report)
  test/
    fixtures/             # Input + expected-output cases
    engine/*.test.ts      # Vitest unit + parity tests
tools/
  extract_workbook.py     # openpyxl script that dumps workbook formulas/values (already used
                          # for reverse-engineering; kept for regression reference)
PLAN.md
```

### 2.2 Engine design notes (fidelity-critical points)

1. **Timeline:** Model Start = valuation date if it is the 1st, else first of next month;
   monthly periods to `discountPeriod × 12 (+12 for terminal lookahead)`; cumulative time factor
   uses actual days / 365 exactly as `Calc_DCF` row 15.
2. **Tenancy generations:** for each tenant, generation 1 = current lease (or vacant profile
   letting-up first); generations 2–10 generated from the assigned vacant-space profile (term,
   reviews to market, downtime = probability-weighted letting-up months from the expiry-year
   table, incentives from the expiry-year table, renewal vs new commissions weighted by renewal
   probability). Matches `IP_Schedule` cols DZ–ET and `CF_Tenant` §2.
3. **Review engine:** per-review-type resolution (CPI ­– trailing-year CPI, Fixed %, Market
   override, Manual $), ratchet = `MAX(previous, market)` when enabled — port of `CF_Tenant`
   §3.1 rows 154–200 including the override/car-park interaction.
4. **Recoveries:** net leases recover tenant-share of grown recoverable outgoings × % recovered;
   gross/semi-gross handled as in `CF_Tenant` §4; base-year recoveries amount for current net
   leases.
5. **Statics:** `Calc_Cap` reversion adjustments use the tenant-level PV columns
   (`IP_Schedule` FB/FI/FP/FZ ranges) — these will be produced by the engine per tenant within
   the "reversion window" (`allowance captured for tenants expiring within N months`).
6. **IRR:** monthly cash flows + terminal proceeds vs adopted value, solved by bisection/Newton
   (Excel `IRR`-equivalent), annualised.
7. **Rounding:** reproduce the workbook's explicit rounds only (`ROUND(x,-5)` cap value,
   `ROUND(x,-3)` DCF capital value, `MROUND(...,10000)` on DCF-Output) and label them as such.

### 2.3 Input UX — "all inputs with clear instruction"

- Left-nav grouped exactly like the workbook's numbered sections so existing users can map
  Excel → web one-to-one.
- Every field gets: label, unit suffix (`%`, `$ p.a.`, `$/m²`, months, years), an **info tooltip
  with the instruction text** (taken from the workbook's own notes, e.g. the incentives
  net/gross-basis note, recoveries note, other-income CAP vs DCF treatment note), and inline
  validation (required fields, date ordering, enum lists identical to the workbook's data
  validation: use types, N/G, Leased/Vacant, review types, On/Off, Yes/No…).
- Tenancy schedule = master grid (No., suite, use, NLA, status, tenant, start, expiry, base
  rent, profile) + a per-tenant drawer for the long tail (reviews, recoveries, parking,
  incentives) so the grid stays readable.
- A persistent **error/check panel** replicating the workbook's error checks ("Inputs OK /
  Error in Inputs", 10-year-model bounds, profile-applied counts, both-R&M-switches check).
- Derived read-only fields shown in place, greyed, exactly where Excel shows them
  (e.g. gross market rent = net + outgoings, model start/end dates, totals row).

### 2.4 Output pages — "summary page and cashflow"

**Summary page** (mirrors `OP_Exec` + `DCF-Output`):
- Header: property, client/owner, valuation date, valuer, NLA, interest valued.
- Valuation summary cards: Capitalisation value, DCF value (after acquisition costs), Adopted
  value ($ and $/m² NLA), Resultant IRR, initial/fully-leased/equivalent/reversionary yields.
- Rental profile table by use (passing vs market, $ p.a. and $/m²) with outgoings and net income.
- DCF panel: annual net cash flow table, terminal value build-up, NPV walk (PV of CF, less
  purchase costs, capital value), discount-rate × terminal-yield sensitivity matrix (3×3) and
  cap-rate sensitivity strip.
- Capitalisation panel: core value build-up + each PV adjustment line.
- Charts (net income by year; sensitivity heat table).

**Cashflow page** (mirrors `OP_CashFlow_A`, `OP_CashFlow_M`, `Calc_DCF` §1–2):
- Toggle **Annual / Monthly**.
- Building cash flow statement: gross lease income, recoveries, additional income, outgoings
  (statutory/operating/non-recoverable), commissions, incentives, net CF pre-capex, capex lines,
  net cash flow, running yield, discount factors, discounted CF, cumulative NPV.
- Per-tenant breakdown tables by category (base lease income, recoveries, letting-up,
  commissions, incentives, capital upgrades) — the OP_CashFlow_A layout.
- CSV export of any table.

**Tenancy page** (mirrors `OP_Tenancy`): tenancy summary table (per tenant: suite, NLA, car
parks, status, lease type, tenant, start/expiry/term, reviews, passing rent $ p.a. and $/m²,
parking, outgoings recovered, total gross passing rent, totals row) and market rental profile
table (assigned profile assumptions: lease term, renewal probability, average growth, incentive,
commissions, capex on expiry, market rent $ p.a. / $/m²).

**Analysis page** (mirrors `OP_Analysis`): top-10 tenants by area (NLA, % of NLA, car parks)
with NLA-breakdown chart, top-10 by income with income-share chart, lease-expiry profile by
model year (tenant count, NLA, % expiring) with expiry chart, and WALE by income and by area.

**Rates page** (mirrors `OP_Rates`): Office and Retail growth-forecast tables — face gross/net
$/m² and growth %, incentive %, effective gross/net, outgoings $/m² — plus 3/5/10-year compound
averages, per model year.

**Report page + PDF** (mirrors `OP_Report`): printable valuation report — property and valuation
particulars, vacancy schedule, outstanding incentives, DCF transaction costs, DCF present-value
summary, NPV and IRR sensitivity matrices, static (capitalisation) calculation summary, adopted
value and valuer sign-off. A **Download PDF** button generates a paginated PDF client-side
(jsPDF + autotable); the page also carries a print stylesheet as a fallback.

Out of scope for v1 (deferred to v2+): Excel round-trip import/export, multi-scenario
comparison, authentication and server-side storage.

---

## 2.5 v2-readiness (per-client backend + database later)

v2 will add a backend per client and a database. v1 is structured so that step is additive,
not a rewrite:

1. **npm-workspaces monorepo:** `packages/engine` (pure TypeScript, zero browser/DOM
   dependencies) + `apps/web` (Vite React SPA). In v2 an `apps/api` service imports the very
   same engine package to compute server-side — no duplicated model logic.
2. **Storage behind an interface:** all persistence goes through a `StorageAdapter`
   (`list / load / save / remove`). v1 ships `LocalStorageAdapter`; v2 adds an
   `ApiStorageAdapter` (REST/JSON) with the same contract — the UI doesn't change.
   v1 already supports **multiple named valuations** (a local library), which maps 1:1 onto
   the future `clients/valuations` database schema.
3. **Versioned document schema:** every valuation JSON carries `schemaVersion`; a migration
   registry upgrades older documents on load. The same JSON is the v2 API payload and DB
   document format.
4. **Pure-function engine API:** `runModel(inputs) → results` is stateless and synchronous, so
   it can run in the browser (v1), in a worker, or on a server (v2) unchanged.
5. **No browser-globals in engine or state logic**; environment-specific code (localStorage,
   file download, PDF) is isolated in `apps/web/src/platform/`.

---

## 3. Verification strategy

- **Unit tests** (Vitest) per engine module: date helpers vs `EOMONTH` cases; growth compounding
  vs §8 workings (`RATE` cross-checks); review-type matrix; recoveries net/gross cases;
  terminal-value formula; IRR solver.
- **Parity fixtures:** the workbook's cached values give spot-checks (e.g. `Calc_Cap!D32`,
  `Calc_DCF!D174`, IP_Schedule totals). Caveat: the workbook's DT_* data tables are stale
  (macro not re-run before save), so building-level cached numbers are only used where they are
  formula-live; the primary source of truth is the formula semantics extracted with the
  included tooling. I will also build 2–3 hand-computed mini-cases (single tenant, no growth;
  tenant + renewal cycle; vacant suite) and verify against manual spreadsheet math.
- **End-to-end:** Playwright smoke test — load defaults, edit a tenant, see summary values
  change, export/import JSON round-trip.

## 4. Implementation phases

1. **Engine core** — types, dates, growth, tenant cash flow, building aggregation + tests.
2. **Valuations** — cap + DCF + IRR + sensitivities + analytics (WALE, expiry, top-10) + tests.
3. **Input UI** — all eight input pages with instructions, validation, persistence, defaults.
4. **Output UI** — Summary, Cashflow, Tenancy, Analysis, Rates pages; CSV export; charts.
5. **Report & PDF** — Report page + client-side PDF generation.
6. **Polish & ship** — error-check panel, responsive layout, README with usage guide, static
   build; deploy (GitHub Pages via Actions, or Vercel — to confirm).

Each phase lands as commits on `claude/reas-valuation-web-plan-pqrmcj`.

## 5. Decisions assumed (flag if you want these changed)

| Decision | Assumption |
|---|---|
| Hosting/backend | v1: pure client-side SPA, static hosting, no login, data in browser + JSON export. v2: per-client backend + DB via the adapter/monorepo seams in §2.5 |
| Framework | React + TypeScript + Vite; engine as separate workspace package |
| Outputs in v1 | Summary, Cashflow (annual & monthly), Tenancy, Analysis, Rates, Report + PDF |
| PDF | Client-side jsPDF; print stylesheet as fallback |
| Tenant count | Unlimited rows (workbook template ships with 2); engine loops natively |
| Excel features dropped | VBA macros (Update Calcs / Insert Tenant / protect), print-layout working sheets |
| Currency/locale | AUD formatting `$`, m² areas, per-annum conventions as in workbook |
| Known workbook quirk | `CF_Tenant` adds the upfront incentive amount in every month; the web engine applies it once (documented correction) |
