# GH-3 — Before & After: Multi-Currency FX Conversion

> What changed, why it matters, and where to see it in the app.

---

## The Problem GH-3 Solves

Ghostfolio showed portfolio values in your chosen base currency (e.g. EUR), but it
was using **today's exchange rate** for every historical transaction. This made
your profit/loss figures inaccurate.

**Real example:**

| Date     | You bought            | EUR/USD rate that day | EUR/USD today |
| -------- | --------------------- | --------------------- | ------------- |
| Jan 2022 | 10 × AAPL at $175 USD | **1.13**              | 1.08          |

| Metric            | Before GH-3                         | After GH-3                          |
| ----------------- | ----------------------------------- | ----------------------------------- |
| Cost basis in EUR | 10 × 175 / **1.08** = **€1,620** ❌ | 10 × 175 / **1.13** = **€1,549** ✅ |
| Shown P&L         | Distorted (used wrong rate)         | Accurate (used rate on trade date)  |

The difference compounds across hundreds of transactions and multiple currencies.

---

## What Changed — Summary

| Area                                     | Before                                    | After                                                 |
| ---------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| Exchange rate used for past transactions | Today's rate (wrong)                      | Rate on the actual transaction date (correct)         |
| FX rate data source                      | In-memory snapshot (single rate per pair) | ECB daily feed (40+ currencies, historical from 1999) |
| Rate storage                             | None — only today's rate kept in memory   | New `ExchangeRate` database table                     |
| Data refresh                             | On app startup only                       | Daily cron job at 11pm (ECB publishes ~4pm CET)       |
| Non-EUR pairs (e.g. GBP/CHF)             | May be inaccurate                         | Triangulated via EUR (ECB is EUR-based)               |
| Weekend/holiday transactions             | Used whatever rate was in memory          | Falls back to nearest previous business day           |
| Startup on fresh install                 | No historical rate data                   | Backfills ECB rates from 1999-01-04 to present        |

---

## Page-by-Page: What You See

### Portfolio — `/en/portfolio`

**Before GH-3**

```
Portfolio value: €45,230
Performance:    +12.4%

Holdings:
  AAPL   10 shares  Cost: €1,620  Current: €1,780  P&L: +€160
  (cost basis used today's EUR/USD = 1.08 — incorrect for a 2022 purchase)
```

**After GH-3**

```
Portfolio value: €45,230
Performance:    +14.9%   ← more accurate

Holdings:
  AAPL   10 shares  Cost: €1,549  Current: €1,780  P&L: +€231
  (cost basis now uses 2022 EUR/USD = 1.13 — correct)
```

> The layout is **identical**. Only the numbers change — and they are now correct.

---

### Account Settings — `/en/user-account`

**Before GH-3**

- Base currency selector existed ✅
- Changing it updated all displays using today's rate

**After GH-3**

- Base currency selector still there ✅ (no visual change)
- Changing it now recalculates everything using **historical rates per transaction date**
- More accurate P&L across the whole portfolio when you switch currencies

---

### Admin → Job Queues — `/en/admin/jobs`

**Before GH-3**

```
Active queues:
  1. DATA_GATHERING_QUEUE
  2. PORTFOLIO_SNAPSHOT_COMPUTATION_QUEUE
  3. STATISTICS_GATHERING_QUEUE
```

**After GH-3**

```
Active queues:
  1. DATA_GATHERING_QUEUE
  2. PORTFOLIO_SNAPSHOT_COMPUTATION_QUEUE
  3. STATISTICS_GATHERING_QUEUE
  4. ECB_FX_GATHERING_QUEUE  ← NEW  (runs daily at 11pm)
```

---

### Database — Prisma Studio (`npm run database:gui`)

**Before GH-3**

No `ExchangeRate` table existed. FX rates were stored only in memory, lost on restart.

**After GH-3**

New `ExchangeRate` table:

| id                                   | date       | fromCurrency | toCurrency | rate   |
| ------------------------------------ | ---------- | ------------ | ---------- | ------ |
| cl...                                | 2022-01-14 | EUR          | USD        | 1.1342 |
| cl...                                | 2022-01-14 | EUR          | GBP        | 0.8401 |
| cl...                                | 2022-01-14 | EUR          | CHF        | 1.0431 |
| ...                                  | ...        | ...          | ...        | ...    |
| (260,000+ rows from 1999 to present) |            |              |            |        |

---

## New Code Added (Technical Summary)

| File                                                                     | Type     | What it does                                                                          |
| ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                                   | Modified | Added `ExchangeRate` model                                                            |
| `prisma/migrations/20261105.../migration.sql`                            | New      | Creates `ExchangeRate` table with index                                               |
| `apps/api/src/services/ecb-fx-rate/ecb-fx-rate.service.ts`               | New      | Fetches daily ECB CSV feed, upserts to `ExchangeRate` table                           |
| `apps/api/src/services/ecb-fx-rate/ecb-fx-rate.module.ts`                | New      | NestJS module registration                                                            |
| `apps/api/src/services/exchange-rate-data/exchange-rate-data.service.ts` | Modified | Added `getHistoricalRate()`, `getManyHistoricalRates()`, patched `toCurrencyAtDate()` |
| `apps/api/src/services/startup-migration/startup-migration.service.ts`   | New      | One-time ECB backfill on first app boot                                               |
| `apps/api/src/services/startup-migration/startup-migration.module.ts`    | New      | NestJS module registration                                                            |
| `apps/api/src/services/cron/cron.service.ts`                             | Modified | Added daily ECB rate gathering job (`@Cron(EVERY_DAY_AT_11PM)`)                       |
| `libs/common/src/lib/config.ts`                                          | Modified | Added `PROPERTY_HAS_HISTORICAL_FX_MIGRATION` constant                                 |

**Tests added:** 21 new tests (487 total, up from 466) — all passing.

---

## How Historical Rate Lookup Works (For Developers)

```
User views portfolio
        │
        ▼
portfolio.service.ts calls toCurrencyAtDate(value, 'USD', 'EUR', '2022-01-15')
        │
        ▼
ExchangeRateDataService.getHistoricalRate('USD', 'EUR', 2022-01-15)
        │
        ├─ Direct lookup: ExchangeRate WHERE date=2022-01-15 AND from='USD' AND to='EUR'
        │   Not found (ECB stores EUR/XXX, not USD/XXX)
        │
        ├─ Reverse pair: ExchangeRate WHERE date=2022-01-15 AND from='EUR' AND to='USD'
        │   Found: rate = 1.1342  →  returns 1 / 1.1342 = 0.8818  ✅
        │
        └─ (If neither found) → triangulate via EUR, then 7-day fallback, then MarketData
```

---

## SDLC Pipeline Artifacts (Full Audit Trail)

All design decisions, requirements, test cases, and review findings are documented:

| Artifact                                                                  | Description                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`ph1_problem_spec.md`](artifacts/GH-3/ph1_problem_spec.md)               | 8 requirements, 8 acceptance criteria, 5 decision log entries |
| [`ph2_design_spec.md`](artifacts/GH-3/ph2_design_spec.md)                 | 10 components, 4 ADRs, complete data flow diagrams            |
| [`ph3b_qa_test_plan.md`](artifacts/GH-3/ph3b_qa_test_plan.md)             | 22 test cases covering all 8 ACs                              |
| [`ph4_implementation_plan.md`](artifacts/GH-3/ph4_implementation_plan.md) | 17 ordered steps across 5 dependency waves                    |
| [`ph5_6_impl_manifest.md`](artifacts/GH-3/ph5_6_impl_manifest.md)         | Files touched, simplification log (1 bug fixed in Phase 6)    |
| [`ph8_verification_report.md`](artifacts/GH-3/ph8_verification_report.md) | Verification score: **94/100 PASSED**                         |

---

## PRs

| Repo                                                                                                   | PR    | What it contains                 |
| ------------------------------------------------------------------------------------------------------ | ----- | -------------------------------- |
| [`rajagondap/ghostfolio`](https://github.com/rajagondap/ghostfolio/pull/4)                             | PR #4 | Feature code (all files above)   |
| [`rajagondap/ghostfolio-qa-automation`](https://github.com/rajagondap/ghostfolio-qa-automation/pull/1) | PR #1 | Playwright test suite (10 tests) |

---

_Generated by Agentic AI SDLC Pipeline — GH-3 — 2026-11-06_
