# Ghostfolio — SDLC Pipeline Intake

## Organisation
- **Name:** Ghostfolio
- **Industry:** Personal Finance / Open Source
- **Compliance:** None (open source project, no regulated data processing in pipeline)
- **Ticket prefix:** GH (GitHub Issues)

## Workflow (ALM System)
- **PM System:** GitHub Issues
- **Auth strategy:** gh-cli (ambient auth via `gh auth login`)
- **Org:** ghostfolio
- **Repo:** ghostfolio

## SCM
- **SCM:** GitHub
- **Auth strategy:** gh-cli
- **Org:** ghostfolio
- **Default branch:** main

## Branching Convention
- **Branch naming:** `<type>/<short-description>`
  - Examples: `feature/add-crypto-support`, `fix/portfolio-calculation-bug`, `chore/update-dependencies`
- **Target branch:** main
- **PR title format:** `<type>: <short description>` (e.g., `feat: add Revolut import`, `fix: correct dividend calculation`)

## QA Workflow
- **Test management:** None (no external test management tool)
- **Test framework:** Jest (unit/integration), no E2E configured
- **Test commands:**
  - All: `npm test`
  - API only: `npm run test:api`
  - Common lib: `npm run test:common`
  - UI lib: `npm run test:ui`
  - Single file: `npm run test:single -- --test-file <filename>`

## Feature Flags
- **System:** None

## APM / Observability
- **Tool:** None (self-hosted, open source)

## Tech Stack
- **Monorepo:** Nx
- **Backend:** NestJS + TypeScript (`apps/api/`)
- **Frontend:** Angular + TypeScript (`apps/client/`)
- **Shared libraries:** `libs/common/` (utilities, DTOs, enums), `libs/ui/` (Angular components)
- **Database:** PostgreSQL 15 via Prisma ORM
- **Queue:** Bull (Redis-backed) — 3 queues: DATA_GATHERING, PORTFOLIO_SNAPSHOT_COMPUTATION, STATISTICS_GATHERING
- **Package manager:** npm
- **CI/CD:** GitHub Actions (`.github/workflows/`)
- **Container runtime:** Podman (Docker alternative)

## Domain Model
- **Type:** Single (personal portfolio tracker, single-user model)
- **Key entities:** User, Account, Order (activities/trades), MarketData, PortfolioSnapshot

## Key Paths
- API modules: `apps/api/src/app/`
- Shared constants/config: `libs/common/src/lib/config.ts`
- Shared utilities: `libs/common/src/lib/helper.ts`
- Data providers: `apps/api/src/services/data-provider/`
- Portfolio engine: `apps/api/src/app/portfolio/`
- Prisma schema: `prisma/schema.prisma`
- SDLC artifacts: `docs/artifacts/<ticket>/`
