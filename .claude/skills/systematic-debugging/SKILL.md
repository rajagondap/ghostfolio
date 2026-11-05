---
name: systematic-debugging
user-invocable: false
description: >
  Use when encountering any bug, test failure, unexpected behavior, or production
  issue — before proposing fixes. Also use when previous fix attempts have failed.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - PowerShell
---

# Systematic Debugging

You are diagnosing a technical issue in the Ghostfolio codebase. Random fixes waste time and create new bugs. Your job is to find the root cause FIRST, then fix it.

## Iron Laws

- NEVER FIX WITHOUT ROOT CAUSE INVESTIGATION FIRST — symptom fixes are failure.
- NEVER ADD PERMANENT LOGGING TO DIAGNOSE — remove debug logs before committing.
- NEVER DISABLE A FAILING TEST — investigate why it fails.
- IF 3+ FIXES FAILED — STOP AND QUESTION THE ARCHITECTURE.
- NEVER BATCH MULTIPLE FIXES — one change at a time, verify after each.

---

## The Four Phases

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read error messages carefully** — stack traces, line numbers, file paths
2. **Reproduce consistently** — can you trigger it reliably? Exact steps?
3. **Check recent changes** — `git log --oneline -10`, `git diff`
4. **Trace the data flow** — where does the bad value originate? Fix at the source.
5. **Use git stash to verify baseline** — `git stash` → run tests → record → `git stash pop`

### Phase 2: Pattern Analysis

1. Find working examples — locate similar working code in the codebase
2. Compare differences — what's different between working and broken?
3. Check dependencies — what config or environment does this need?

### Phase 3: Hypothesis and Testing

1. Form a single hypothesis — "I think X is the root cause because Y"
2. Test minimally — smallest possible change to test the hypothesis
3. Verify before continuing — did it work? If not, form NEW hypothesis
4. Don't stack fixes — if hypothesis was wrong, revert and try a different one

### Phase 4: Implementation

1. Write a failing test — reproduces the bug, proves the fix works
2. Implement single fix — address the root cause, ONE change only
3. Verify fix — run full test suite: `npm test`
4. Check blast radius — grep for all usages of the changed code

**If 3+ fixes have failed:** STOP. Question the architecture.

---

## Ghostfolio-Specific Debugging Guide

### NestJS / API Issues
- **Prisma errors**: Check migration status with `npm run database:gui` (Prisma Studio)
- **Bull queue not processing**: Verify Redis is running (`podman ps`) and `REDIS_HOST`/`REDIS_PASSWORD` env vars are set
- **Module injection errors**: Check that the service is listed in the module's `providers` array
- **403/401 errors**: Check JWT middleware and `@UseGuards(AuthGuard('jwt'))`

### Angular / Client Issues
- **SSL errors on https://localhost:4200**: SSL certs missing — generate `localhost.cert` and `localhost.pem` with OpenSSL
- **API calls failing**: Check `proxy.conf.json` and that the API server is running on port 3333
- **Circular dependency in Angular**: Check `forwardRef()` usage, avoid importing modules that import back

### Portfolio Calculation Issues
- Data flows: `Order` → `MarketData` (via DATA_GATHERING_QUEUE) → `PortfolioSnapshot` (via PORTFOLIO_SNAPSHOT_COMPUTATION_QUEUE) → `portfolio.service.ts`
- If portfolio values are stale: the snapshot computation queue may not have run — check Redis/Bull queue status
- Exchange rate issues: check `exchange-rate-data.service.ts`

### Database Issues
- **Migration out of sync**: Run `npm run database:push` to sync schema, or create a migration
- **Seed data missing**: Run `npm run database:setup` to re-initialize
- **Connection refused**: Verify `gf-postgres` container is running and `DATABASE_URL` points to correct host

### Test Failures
- **Run all tests**: `npm test` (uses `.env.example`)
- **Run single test**: `npm run test:single -- --test-file <filename>`
- **Test isolation**: Each test should be independent — check for shared state
