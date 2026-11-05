# Ghostfolio — User Guide

## What is Ghostfolio?

Ghostfolio is an **open source personal wealth management application**. It lets you track stocks, ETFs, cryptocurrencies, bonds, and other assets across multiple brokerage accounts in one place. It calculates your portfolio's performance, shows allocation breakdowns, flags portfolio risks, and projects retirement readiness — all without sharing your data with third parties.

**Access your instance:** http://localhost:3333

---

## Core Concepts

Before using the app, understand the three-level data hierarchy:

```
Platform  ──────────────────────────────────────────────────────
│  (Optional grouping, e.g. "Fidelity", "Coinbase")             │
│                                                                │
│   Account  ──────────────────────────────────────────────────  │
│   │  (e.g. "Trading Account", "Roth IRA", "Cold Wallet")   │  │
│   │                                                          │  │
│   │   Activity  ────────────────────────────────────────────  │  │
│   │   (BUY / SELL / DIVIDEND / FEE / INTEREST / LIABILITY)  │  │
│   └──────────────────────────────────────────────────────────  │
└────────────────────────────────────────────────────────────────
```

| Concept           | Description                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| **Platform**      | The broker, bank, or exchange (e.g. Fidelity, Coinbase). Optional — accounts can exist without one. |
| **Account**       | A specific account at a platform with a base currency. All activities belong to an account.         |
| **Activity**      | A single financial event: buying a stock, receiving a dividend, paying a fee, etc.                  |
| **Asset Profile** | Market data record for a symbol (price history, sector, country, etc.). Shared across all users.    |

---

## Navigation Map

```
http://localhost:3333
│
├── /home               ← Dashboard (default after login)
│   ├── /home           → Overview tab  (performance chart)
│   ├── /home/holdings  → Holdings tab  (positions list)
│   ├── /home/summary   → Summary tab   (totals by period)
│   ├── /home/watchlist → Watchlist tab (tracked symbols)
│   └── /home/markets   → Markets tab   (indices, fear & greed)
│
├── /portfolio          ← Deep portfolio analysis
│   ├── /portfolio              → Analysis tab    (charts by period)
│   ├── /portfolio/activities   → Activities tab  (full transaction log)
│   ├── /portfolio/allocations  → Allocations tab (pie breakdowns)
│   ├── /portfolio/fire         → FIRE tab         (retirement calculator)
│   └── /portfolio/x-ray        → X-Ray tab        (risk rules)
│
├── /accounts           ← Account management
│
├── /admin              ← Admin Control (ADMIN role only)
│   ├── /admin/market-data → Asset profiles & price data
│   ├── /admin/jobs        → Background job queue
│   ├── /admin/settings    → Platforms, tags, currencies, system
│   └── /admin/users       → User management
│
└── /account            ← Your personal settings
    ├── /account         → Security token, API keys, language
    └── /account/access  → Share portfolio with others
```

---

## First-Time Setup Flow

```
Register / Sign In
       │
       ▼
Create a Platform (optional)
  Admin Control → Settings → Add Platform
       │
       ▼
Create an Account
  Accounts → Add Account
  - Name (required)
  - Currency (required, e.g. USD)
  - Platform (optional)
       │
       ▼
Add Activities (transactions)
  Portfolio → Activities → +
       │
       ▼
View Dashboard
  Home → Overview
```

---

## Feature Reference

---

### 1. Home — Overview (`/home`)

The main dashboard. Shows an **investment performance chart** for your whole portfolio.

**Tabs:**

| Tab       | What you see                                                     |
| --------- | ---------------------------------------------------------------- |
| Overview  | Performance chart (line), current value, gain/loss               |
| Holdings  | Table of all open positions with current value and performance   |
| Summary   | Performance figures by period: Today, WTD, MTD, YTD, 1Y, 5Y, Max |
| Watchlist | Symbols you track without owning                                 |
| Markets   | Global market indices + Fear & Greed indicators                  |

**Date range selector** (top of page): `1d` · `WTD` · `MTD` · `YTD` · `1Y` · `5Y` · `Max` and individual calendar years.

---

### 2. Accounts (`/accounts`)

Manage your brokerage/investment accounts.

#### Create an Account

```
Accounts page → [ + Add Account ] button
  ├── Name           (required, e.g. "My Roth IRA")
  ├── Currency       (required, e.g. USD, EUR, GBP)
  ├── Platform       (optional dropdown)
  ├── Balance        (optional cash balance)
  └── Comment        (optional, max 2000 chars)
```

#### Account Detail View

Click any account to see:

- All activities linked to it
- Current cash balance
- Account-level performance

#### Transfer Cash Balance

Move cash between accounts:
`Accounts → Transfer Cash Balance`

---

### 3. Portfolio — Activities (`/portfolio/activities`)

Your complete transaction log. Every buy, sell, and income event lives here.

#### Activity Types

| Type        | When to use                                |
| ----------- | ------------------------------------------ |
| `BUY`       | Purchase of a stock, ETF, crypto, etc.     |
| `SELL`      | Sale of a holding                          |
| `DIVIDEND`  | Dividend income received                   |
| `FEE`       | Brokerage or custody fee                   |
| `INTEREST`  | Interest income (e.g. from bonds, savings) |
| `LIABILITY` | A debt or obligation (negative asset)      |

#### Add an Activity

```
Portfolio → Activities → [ + ] button
  ├── Type        (BUY / SELL / DIVIDEND / FEE / INTEREST / LIABILITY)
  ├── Date        (required, ISO date picker)
  ├── Account     (required, pick from your accounts)
  ├── Symbol      (search by name or ticker, e.g. "MSFT", "VOO")
  │     └── Data Source auto-selected: YAHOO / COINGECKO / MANUAL
  ├── Quantity    (required for BUY/SELL)
  ├── Unit Price  (required for BUY/SELL)
  ├── Fee         (optional, brokerage commission)
  └── Comment     (optional, max 2000 chars)
```

#### Validation Rules

| Field        | Rule                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------- |
| Symbol       | Max 255 characters                                                                           |
| Search query | Min 2 characters, max 255 characters                                                         |
| Comment      | Max 2,000 characters                                                                         |
| Date         | Must be in the past or today                                                                 |
| Quantity     | Must be > 0 for BUY/SELL                                                                     |
| Unit Price   | Must be ≥ 0                                                                                  |
| Fee          | Must be ≥ 0                                                                                  |
| Duplicate    | System warns if identical activity (same symbol, date, type, quantity, price) already exists |

#### Import / Export

- **Export**: Portfolio → Activities → Export icon → downloads CSV
- **Import CSV**: Portfolio → Activities → Import icon → upload file
- **Import via API**:
  ```
  POST http://localhost:3333/api/v1/import
  Authorization: Bearer <token>
  Body: { "activities": [ { "type": "BUY", "symbol": "MSFT", ... } ] }
  ```

#### Tags on Activities

Assign tags to categorise activities (e.g. "Retirement", "Growth"). Tags are created in Admin Control → Settings.

System tags (auto-assigned, cannot be deleted):

- `Draft` — activity is pending/unconfirmed
- `Emergency Fund` — marks emergency fund assets
- `Exclude from Analysis` — hides from portfolio calculations

---

### 4. Portfolio — Analysis (`/portfolio`)

Charts and metrics for your portfolio over time.

- **Performance chart** with investment vs. current value areas
- **Compare with benchmark** (e.g. S&P 500, Bitcoin, Gold) — set up via Admin Control → Market Data
- **Net/Gross performance** with and without currency effects

---

### 5. Portfolio — Allocations (`/portfolio/allocations`)

Breakdown of your portfolio across multiple dimensions:

| View            | Groups by                                                    |
| --------------- | ------------------------------------------------------------ |
| Asset Class     | Equity, Fixed Income, Cryptocurrency, Commodity, Real Estate |
| Asset Sub-Class | ETF, Stock, Bond, Mutual Fund, etc.                          |
| Account         | Each of your accounts                                        |
| Platform        | Each broker/bank                                             |
| Currency        | USD, EUR, GBP, etc.                                          |
| Country         | Country of domicile                                          |
| Sector          | Technology, Healthcare, Finance, etc.                        |

Each view shows a **pie / treemap chart** and a ranked table.

---

### 6. Portfolio — X-Ray (`/portfolio/x-ray`)

X-Ray runs automated **risk analysis rules** on your portfolio and highlights issues.

#### Rule Categories

| Category                     | What it checks                                |
| ---------------------------- | --------------------------------------------- |
| **Account Cluster Risk**     | Too much concentration in a single account    |
| **Asset Class Risk**         | Equity or fixed income exceeds safe threshold |
| **Currency Risk**            | Too much exposure in non-base currencies      |
| **Economic Market Risk**     | Developed vs. emerging markets imbalance      |
| **Emergency Fund**           | Whether an emergency fund is set up           |
| **Fee Ratio**                | Total fees as % of investment volume          |
| **Liquidity / Buying Power** | Cash available relative to portfolio          |
| **Regional Risk**            | Concentration in one geographic region        |

Each rule shows: **status**, **current value**, **threshold**, and a **remediation hint**.

---

### 7. Portfolio — FIRE (`/portfolio/fire`)

**FIRE** = Financial Independence, Retire Early calculator.

Inputs (set in your account settings):

- **Savings Rate** — monthly savings amount
- **Annual Interest Rate** — expected portfolio growth rate
- **Projected Total Amount** — your target nest egg
- **Retirement Date** — target retirement date

Outputs:

- How much you can withdraw **per year / per month** today based on the **4% Safe Withdrawal Rate (SWR)**
- Projected withdrawal amount at your target retirement date

---

### 8. Markets (`/home/markets`)

Global market snapshot:

- Major indices (S&P 500, Nasdaq, DAX, etc.) — configured by admin via Admin Control → Market Data → Include in Benchmark / Markets
- **Fear & Greed Index** for stocks and cryptocurrencies
- Each entry links to a detail chart

---

### 9. Watchlist (`/home/watchlist`)

Track symbols you don't own but want to monitor.

```
Home → Watchlist → [ + Add to Watchlist ]
  └── Search and select any symbol
```

Watchlist items appear on the Watchlist tab with current price and daily change.

---

### 10. Admin Control (`/admin`) — ADMIN role only

#### Market Data (`/admin/market-data`)

Manage asset profiles — the underlying market data records.

Key actions per asset profile:

- **Gather Historical Market Data** — fetch full price history from the data provider
- **Include in Benchmark / Markets** — makes the asset appear in the Markets page and as a comparison benchmark
- **Edit asset profile** — manually override sector, country, name
- **Add Manually** — create a custom asset not available from any provider

**Add a currency pair manually:**

1. Admin Control → Market Data → `+`
2. Switch to _Add Currency_
3. Enter e.g. `EUR`
4. Click _Filter by Currencies_ → find `USDEUR`
5. Click _Gather Historical Market Data_

#### Job Queue (`/admin/jobs`)

Monitor background data-gathering tasks:

- `DATA_GATHERING_QUEUE` — fetches asset prices from providers
- `PORTFOLIO_SNAPSHOT_COMPUTATION_QUEUE` — recomputes portfolio snapshots
- `STATISTICS_GATHERING_QUEUE` — collects platform statistics

Each job shows: status, attempt count, progress, error if failed.

#### Settings (`/admin/settings`)

| Setting        | What it does                                    |
| -------------- | ----------------------------------------------- |
| Add Platform   | Create a broker/bank (name + optional logo URL) |
| Add Tag        | Create a custom tag for activities/accounts     |
| Currencies     | Manage which currencies are tracked             |
| System Message | Show a banner to all users                      |
| Read-Only Mode | Lock the instance from new data                 |
| User Signup    | Enable/disable new user registration            |

#### Users (`/admin/users`)

- View all registered users
- See last login, subscription type
- Impersonate a user (to help with support)
- Delete a user

---

### 11. User Settings (`/account`)

Personal settings for your account.

| Section                   | Options                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Security Token**        | Your login access token — keep this private                                                                                      |
| **API Keys**              | Generate tokens for REST API access                                                                                              |
| **Language**              | 14 languages: English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, Korean, Turkish, Ukrainian, Chinese, Catalan |
| **Base Currency**         | The currency all values are converted to (e.g. USD)                                                                              |
| **Date Format**           | Display format for dates                                                                                                         |
| **Experimental Features** | Toggle access to beta features                                                                                                   |
| **Zen Mode**              | Minimalist view without monetary values                                                                                          |
| **Emergency Fund**        | Tag specific holdings as your emergency fund                                                                                     |
| **Savings Rate**          | Used in the FIRE calculator                                                                                                      |
| **WebAuthn / Passkey**    | Register a hardware key or biometric for login                                                                                   |

---

### 12. Access / Portfolio Sharing (`/account/access`)

Share your portfolio (read-only) with others or with AI clients.

#### Access Types

| Type            | Permission                           | Use case                      |
| --------------- | ------------------------------------ | ----------------------------- |
| Private         | Full view                            | Default, for yourself         |
| Public          | Restricted view (no monetary values) | Share anonymously             |
| View            | Full view with values                | Share with a trusted person   |
| MCP             | AI read access                       | Connect an AI assistant       |
| View and Manage | Full + import activities             | Delegate portfolio management |

#### How to share

1. Account → Access → _Grant Access_
2. Choose type and expiry
3. Copy the generated token/link
4. Recipient uses: `POST /api/v1/auth/anonymous` with the token → gets a Bearer token

---

### 13. Zen Mode (`/zen`)

A distraction-free view that hides all monetary values — useful for screen sharing without revealing private financial data. Toggle from User Settings.

---

### 14. Public Portfolio (`/p/<access-id>`)

If you grant a _Public_ access, anyone with the link can view your portfolio performance (relative % only, no absolute values).

---

## Data Providers

| Provider     | Asset types                       | Notes                                           |
| ------------ | --------------------------------- | ----------------------------------------------- |
| `YAHOO`      | Stocks, ETFs, mutual funds, forex | Free, default                                   |
| `COINGECKO`  | Cryptocurrencies                  | Free                                            |
| `MANUAL`     | Any custom asset                  | You enter prices manually or via scraper config |
| `GHOSTFOLIO` | All (professional)                | Requires Ghostfolio Premium subscription        |

---

## API Quick Reference

Obtain a Bearer token first:

```bash
POST http://localhost:3333/api/v1/auth/anonymous
Body: { "accessToken": "<YOUR_SECURITY_TOKEN>" }
# Returns: { "authToken": "eyJh..." }
```

Use in all subsequent requests:

```
Authorization: Bearer eyJh...
```

| Endpoint                             | Method   | Description                   |
| ------------------------------------ | -------- | ----------------------------- |
| `/api/v1/health`                     | GET      | Health check (no auth needed) |
| `/api/v1/auth/anonymous`             | POST     | Get Bearer token              |
| `/api/v1/import`                     | POST     | Import activities             |
| `/api/v1/export`                     | GET      | Export all activities         |
| `/api/v1/portfolio/performance`      | GET      | Portfolio performance         |
| `/api/v1/asset-profiles/:ds/:symbol` | PATCH    | Update asset profile (admin)  |
| `/api/v1/accounts`                   | GET/POST | List / create accounts        |
| `/api/v1/order`                      | GET/POST | List / create activities      |

---

## Roles

| Role    | Capabilities                                                                                 |
| ------- | -------------------------------------------------------------------------------------------- |
| `USER`  | Full access to own data, activities, accounts, settings                                      |
| `ADMIN` | All USER capabilities + Admin Control panel (market data, users, platforms, tags, job queue) |

The **first user to register** is automatically assigned the `ADMIN` role.

---

## In-App Help Pages

These pages are served from your local instance:

| Page               | URL                                         |
| ------------------ | ------------------------------------------- |
| FAQ (Self-Hosting) | http://localhost:3333/en/faq/self-hosting   |
| Resources & Guides | http://localhost:3333/en/resources          |
| Glossary           | http://localhost:3333/en/resources/glossary |
| Features           | http://localhost:3333/en/features           |
| Changelog          | http://localhost:3333/en/about/changelog    |
