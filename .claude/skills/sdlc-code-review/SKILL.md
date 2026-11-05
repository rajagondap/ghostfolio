---
name: sdlc-code-review
description: >
  Phase 7 sub-skill. Reviews implementation files for code quality, type safety,
  spec compliance, and design adherence. Invoked as spec-reviewer agent by the
  review orchestration skill.
allowed-tools:
  - Read
  - Grep
  - Glob
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

# Code Review Skill

You are performing a code review for Ghostfolio. Follow this structured checklist and produce actionable, specific feedback.

## Ghostfolio-Specific Standards (apply first)

- **Path aliases**: Use `@ghostfolio/common`, `@ghostfolio/api/*`, `@ghostfolio/ui` — flag any `../../../` relative imports
- **Logger**: Use `private readonly logger = new Logger(ServiceName.name)` — flag any `console.log` in production code
- **NestJS DI**: Never use TypeScript `!` on injected properties — breaks DI container
- **Prisma**: Never write raw SQL — use Prisma query builder
- **TypeScript**: Strict mode — no `any` without justification comment
- **Async**: `async/await` over `.then()` chains

## Review Checklist

### 1. TypeScript & Type Safety

- No `any` without documented justification
- All public APIs explicitly typed
- Strict mode compatible

### 2. Naming Conventions

- `camelCase` — variables, functions, methods
- `PascalCase` — classes, interfaces, types, NestJS services/controllers
- `SCREAMING_SNAKE_CASE` — constants
- `kebab-case` — file names

### 3. Error Handling

- No empty `catch` blocks
- Errors typed (not `catch (e: any)`)
- Async errors propagated or handled

### 4. Code Structure

- Functions: single responsibility, under 50 lines
- Files: under 300 lines
- Max nesting depth: 3 levels — use early returns
- No commented-out code committed
- No debug logs

### 5. Imports

- No unused imports
- `@ghostfolio/*` path aliases used (not relative `../../..`)
- No circular dependencies

### 6. NestJS Patterns

- Services registered in module `providers[]`
- No manual `new Service()` — use DI
- `@Injectable()` on all services

### 7. Prisma/Database

- `PrismaService` used (not direct Prisma client)
- No raw SQL strings
- Transactions used for multi-step operations

## Output Format

```
## Code Review

### Summary
[One-paragraph overall assessment]

### Critical (must fix before merge)
- `file.ts:42` — [Issue]. **Fix:** [specific suggestion]

### Major (should fix before merge)
- `file.ts:18` — [Issue]. **Fix:** [specific suggestion]

### Minor / Suggestions
- `file.ts:7` — [Suggestion]

### Positives
- [What was done well]

### Stats
Critical: N | Major: N | Minor: N
```
