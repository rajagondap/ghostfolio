---
name: sdlc-generate-tests
description: >
  Phase 7 sub-skill. Reviews test coverage and generates missing Jest tests for
  Ghostfolio implementation files. Invoked as test-engineer by the review skill.
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

# Generate Tests Skill — Ghostfolio

You are reviewing test coverage and generating Jest tests for the Ghostfolio project.

## Ghostfolio Test Conventions

- **Test framework:** Jest
- **Test file naming:** `<service>.service.spec.ts` (co-located with source)
- **Test commands:** `npm test` (all), `npm run test:api` (API), `npm run test:single -- --test-file <filename>` (single)
- **Coverage target:** ≥80% on business logic
- **NestJS service tests:** Use `Test.createTestingModule()` with mocked dependencies
- **No E2E tests** in this phase — Jest unit/integration only

## Integration

Read `ph2_design_spec.md` testing strategy section before generating tests.

If `ph3b_qa_test_plan.md` exists, read `## AC → Test Matrix` — avoid duplicating already-planned test cases.

## Process

### 1. Understand the Target

Read source files, identify exported services/functions/classes, note method signatures and behaviour.

### 2. Discover Project Conventions

```bash
# Find existing test files for patterns
find apps/api/src -name "*.spec.ts" | head -5
```

### 3. Test Type: Jest Only for Ghostfolio

No Playwright E2E in this phase. Focus on:

- Jest unit tests for NestJS services
- Jest integration tests for API endpoints

### 4. Generate Tests

Write to: `<same-directory-as-source>/<service>.service.spec.ts`

#### NestJS Service Test Pattern

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { <ServiceName> } from './<service-name>.service';

describe('<ServiceName>', () => {
  let service: <ServiceName>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <ServiceName>,
        // mock dependencies
        { provide: PrismaService, useValue: { <model>: { findMany: jest.fn(), create: jest.fn() } } },
      ],
    }).compile();

    service = module.get<<ServiceName>>(<ServiceName>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('<methodName>', () => {
    it('should <expected behaviour>', async () => {
      // Arrange
      // Act
      // Assert
    });

    it('should throw when <error condition>', async () => {
      // ...
    });
  });
});
```

### 5. What to Test

**For NestJS services:**

1. Happy path — correct inputs → expected result
2. Edge cases — empty arrays, missing data, boundary values
3. Error cases — Prisma errors, invalid inputs

**For API endpoints/controllers:**

1. Valid request → correct response status and body
2. Missing/invalid body → 400
3. Unauthorized → 401
4. Not found → 404

## Quality Gates

- [ ] Tests are syntactically valid TypeScript
- [ ] Imports from correct source paths using `@ghostfolio/*` aliases
- [ ] Uses `jest.clearAllMocks()` in `beforeEach`
- [ ] Descriptive `describe` and `it` labels
- [ ] No `any` without justification
