# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development Setup

```bash
npm install
docker compose -f docker/docker-compose.dev.yml up -d  # Start PostgreSQL and Redis
npm run database:setup                                   # Initialize DB schema and seed
```

Copy `.env.dev` to `.env` and fill in the placeholder values before starting.

### Running the App

```bash
npm run start:server    # Start NestJS API (http://localhost:3333)
npm run watch:server    # Build API in watch mode for VS Code debugger ("Debug API" launch config)
npm run start:client    # Start Angular client (https://localhost:4200/en)
npm run start:storybook # Start component library
```

The client requires SSL certs (`localhost.cert` / `localhost.pem`) — generate them with `openssl` as described in DEVELOPMENT.md.

### Testing

```bash
npm test                          # Run all tests (uses .env.example)
npm run test:api                  # API tests only
npm run test:common               # Common lib tests only
npm run test:ui                   # UI lib tests only
npm run test:single               # Single test file: nx run api:test --test-file <filename>
```

### Code Quality

```bash
npm run lint          # ESLint all projects
npm run format:check  # Prettier format check
npm run format:write  # Auto-fix formatting
```

### Database

```bash
npm run database:push           # Sync schema to DB (prototyping/dev)
npm run database:gui            # Open Prisma Studio GUI
npm run prisma migrate dev --name <migration_name>  # Create a migration
npm run database:generate-typings                   # Regenerate Prisma client typings
```

### Build

```bash
npm run build:production   # Full production build (API + client + Storybook)
```

## SDLC Pipeline

This project uses the Agentic SDLC Pipeline. Key commands available in Claude Code:

| Command | Purpose |
|---------|---------|
| `/sdlc --ticket=GH-<N>` | Run full pipeline for a GitHub Issue |
| `/sdlc-status --ticket=GH-<N>` | Check pipeline progress and scores |
| `/sdlc-artifacts --ticket=GH-<N>` | List all pipeline artifacts |
| `/sdlc-blockers --ticket=GH-<N>` | Show critical findings blocking the pipeline |
| `/sdlc-retry --ticket=GH-<N> --phase=<phase>` | Re-run a single phase |
| `/sdlc-doctor` | Validate workspace setup |
| `/sdlc-clean --ticket=GH-<N>` | Remove artifacts for a ticket |

Standalone skills (auto-triggered by context):
- `systematic-debugging` — structured root cause analysis before any fix attempt
- `writing-plans` — creates `.claude/plans/<task>.md` for multi-step tasks
- `executing-plans` — executes plans step-by-step with per-step verification
- `finishing-a-development-branch` — pre-PR quality gate (tests, lint, git hygiene)
- `session-learnings` — captures session insights to improve CLAUDE.md

### SDLC Artifact Paths

All pipeline artifacts are written to `docs/artifacts/<ticketId>/`:
- `ph1_problem_spec.md` — requirements and acceptance criteria
- `ph2_design_spec.md` — architecture and component design
- `ph3_design_review.md` — design review score and findings
- `ph4_implementation_plan.md` — ordered implementation steps
- `ph5_6_impl_manifest.md` — implementation manifest (files touched)
- `ph8_verification_report.md` — verification score and AC coverage
- `ph9_risk_assessment.md` — risk assessment and go/no-go
- `.state/pipeline_state_<ticket>.json` — full pipeline state

**Never create pipeline artifacts outside `docs/artifacts/`.**

### Codebase Index

When exploring this codebase, always check `.codebase-index/` first:
1. If `.codebase-index/repo-map.md` exists, read it before doing broad Glob/Grep scans
2. If `.codebase-index/index.json` exists, use it to look up modules, keywords, and file dependencies
3. Only fall back to standard Glob/Grep if no index exists

---

## Architecture

Ghostfolio is an **Nx monorepo** with two apps and two libraries:

```
apps/api/      — NestJS backend
apps/client/   — Angular frontend
libs/common/   — Shared TypeScript utilities, DTOs, enums, interfaces, helpers
libs/ui/       — Reusable Angular UI components (also published as Storybook)
prisma/        — Database schema (PostgreSQL via Prisma), migrations, seed
```

### Path Aliases

| Alias | Resolves to |
|---|---|
| `@ghostfolio/api/*` | `apps/api/src/*` |
| `@ghostfolio/common` | `libs/common/src/index.ts` |
| `@ghostfolio/ui` | `libs/ui/src/index.ts` |
| `@ghostfolio/prisma/*` | Generated Prisma client types |

### Backend (`apps/api`)

NestJS feature modules live in `apps/api/src/app/`:
- **`portfolio/`** — Core portfolio calculation engine (`portfolio.service.ts`, `calculator/`)
- **`activities/`** — Trade/transaction management
- **`account/`** — Account and balance tracking
- **`endpoints/`** — REST API modules (asset-profiles, benchmarks, mcp, public, etc.)
- **`auth/`**, **`auth-device/`** — JWT + WebAuthn authentication

Shared backend services live in `apps/api/src/services/`:
- **`data-provider/`** — Pluggable market data adapters: Yahoo Finance, CoinGecko, Alpha Vantage, EOD Historical Data, Financial Modeling Prep, Google Sheets, Manual, and the premium Ghostfolio provider
- **`queues/`** — Three Bull queues: `DATA_GATHERING_QUEUE`, `PORTFOLIO_SNAPSHOT_COMPUTATION_QUEUE`, `STATISTICS_GATHERING_QUEUE`
- **`prisma/`** — Database access via `PrismaService`
- **`exchange-rate-data/`** — Currency conversion
- **`cron/`** — Scheduled jobs for data refresh and snapshot computation
- **`symbol-profile/`** — Asset profile enrichment (sectors, countries, holdings)

### Frontend (`apps/client`)

Angular pages in `apps/client/src/app/pages/` map to routes (home, portfolio, accounts, markets, admin, user-account, etc.).

### Shared Libraries

- **`libs/common/src/lib/config.ts`** — All app-wide constants (queues, rate limits, tag IDs, property keys, supported currencies/languages)
- **`libs/common/src/lib/helper.ts`** — Pure utility functions shared between API and client
- **`libs/ui/src/lib/`** — Standalone Angular components (charts, tables, dialogs, selectors, etc.)

### Data Flow

1. A user activity (BUY/SELL/DIVIDEND/etc.) is stored in the `Order` Prisma model.
2. The `DATA_GATHERING_QUEUE` fetches market prices from data providers and stores them in `MarketData`.
3. The `PORTFOLIO_SNAPSHOT_COMPUTATION_QUEUE` calculates portfolio snapshots triggered by activity changes.
4. The `portfolio.service.ts` aggregates snapshots, calculates performance metrics (ROAI, net/gross performance), and applies portfolio analysis rules.

### Experimental Features

- **Backend**: Remove a permission in `UserService` using `without()`.
- **Frontend**: Gate UI with `@if (user?.settings?.isExperimentalFeatures) {}` in Angular templates.

### Environment Variables

Key variables (full list in README.md):
- `DATABASE_URL`, `POSTGRES_*` — PostgreSQL connection
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` — Redis connection
- `ACCESS_TOKEN_SALT`, `JWT_SECRET_KEY` — Security (required, random strings)
- `ENABLE_FEATURE_MCP` — Enable Model Context Protocol server at `/mcp`
- `ENABLE_FEATURE_AUTH_OIDC` — Enable OpenID Connect authentication
