---
name: sdlc-build-codebase-index
user-invocable: true
description: >
  Build a persistent codebase index for targeted exploration. Use when user says
  "build index", "index codebase", "create repo map", or when the SDLC pipeline
  needs pre-requirements exploration optimization.
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
context: fork
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

# Build Codebase Index — Ghostfolio

Build a persistent codebase index that maps files to modules, domain concepts, and import relationships. Enables targeted exploration during SDLC pipeline phases.

## Arguments

| Argument             | Required                |
| -------------------- | ----------------------- |
| `--path=<repo-path>` | No — defaults to CWD    |
| `--force`            | No — force full rebuild |

## Process

### Step 1: Verify Target and Write Access

```bash
mkdir -p .codebase-index && touch .codebase-index/.write-check && rm .codebase-index/.write-check && echo "WRITE_OK" || echo "WRITE_BLOCKED"
```

If WRITE_BLOCKED: stop and ask user to add write permission.

### Step 2: Scan File Structure

Ghostfolio-specific include patterns:

```
apps/api/src/**/*.ts
apps/client/src/**/*.ts
apps/client/src/**/*.html
libs/common/src/**/*.ts
libs/ui/src/**/*.ts
prisma/schema.prisma
```

Exclude: `node_modules/`, `dist/`, `build/`, `.git/`, `coverage/`, `*.spec.ts`

### Step 3: Build Module Map

For each file, extract:

- Module/component name
- Exported symbols (services, functions, interfaces, enums)
- Import dependencies (what it imports)
- Domain concept (portfolio, activity, account, market-data, exchange-rate, etc.)

### Step 4: Rank by Importance

Rank files by:

1. Import count (how many other files import this)
2. Domain centrality (portfolio.service.ts > peripheral utility)

### Step 5: Write Index Files

Write `.codebase-index/repo-map.md` — compact LLM-readable repo map:

```markdown
# Ghostfolio Codebase Map

## Core Services (by import rank)

- `apps/api/src/app/portfolio/portfolio.service.ts` — Core portfolio calculation engine
- `apps/api/src/services/exchange-rate-data/exchange-rate-data.service.ts` — Currency conversion
  ...

## Domain Concepts

- **portfolio**: portfolio.service.ts, portfolio.module.ts
- **activities**: activities/ directory
- **exchange-rates**: exchange-rate-data.service.ts
  ...
```

Write `.codebase-index/index.json` — structured programmatic index.

### Step 6: Report

```
Codebase Index Built
  Files indexed: N
  Modules mapped: N
  Domain concepts: N
  Index location: .codebase-index/
```
