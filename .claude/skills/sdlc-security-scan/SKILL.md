---
name: sdlc-security-scan
description: >
  Phase 7 sub-skill. Security scan of implementation files — secrets, injection,
  auth/authz, PII handling, OWASP Top 10. Invoked as security-auditor by the review skill.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

# Security Scan Skill — Ghostfolio

You are performing a security scan for Ghostfolio. No compliance frameworks (GDPR/PCI/HIPAA) apply. No PII data is handled. Focus on code-level security.

## Severity Levels

- **Critical** — Exploitable immediately, data breach risk
- **High** — Significant risk, fix before deployment
- **Medium** — Real risk, address in sprint
- **Low** — Minor risk, address in backlog

## Scan Procedure

### Step 1: Secrets Detection

```
Patterns to find:
- API keys: /api[_-]?key\s*[:=]\s*['"][^'"]{8,}/i
- Passwords: password\s*[:=]\s*['"][^'"]+['"]
- JWT secrets: (jwt|secret|token)[_-]?secret\s*[:=]
- Database URLs with creds: (postgres|redis)://[^:]+:[^@]+@
- Private keys: -----BEGIN.*PRIVATE KEY-----
```

Also check: `.env` files committed (`.env` without `.example` suffix), hardcoded connection strings.

### Step 2: Dependency Audit

```bash
npm audit --audit-level=high 2>/dev/null
```

### Step 3: Injection Vulnerabilities

**SQL Injection:** Check for raw string concatenation in Prisma queries or database calls.
**Command Injection:** `exec()`, `execSync()` with user-controlled input.
**XSS:** `innerHTML = userInput` in Angular templates.

### Step 4: Authentication & Authorization

- JWT verification: `verify()` called (not just `decode()`)
- NestJS `@UseGuards(AuthGuard('jwt'))` on protected routes
- No hardcoded credentials in source files

### Step 5: Ghostfolio-Specific

- API keys for data providers (Yahoo Finance, Alpha Vantage, etc.) must be in environment variables — never hardcoded
- `ANTHROPIC_API_KEY`, `DATABASE_URL`, `REDIS_PASSWORD`, `JWT_SECRET_KEY` must come from env vars
- No credentials in `docker-compose.yml` files committed to repo (dev defaults are acceptable)

### Step 6: No PII/Compliance Checks Required

Ghostfolio is a personal finance tool with no GDPR/PCI/HIPAA obligations. Skip PII compliance checks.

## Output Format

```
## Security Scan Report

**Scope:** [files scanned]

### Summary
[2-3 sentences on overall security posture]

### Findings

#### [CRITICAL|HIGH|MEDIUM|LOW] — [Finding Title]
- **Location:** `path/to/file.ts:line`
- **Issue:** [What was found]
- **Risk:** [Impact]
- **Remediation:** [Fix]

### Totals
Critical: N | High: N | Medium: N | Low: N
```
