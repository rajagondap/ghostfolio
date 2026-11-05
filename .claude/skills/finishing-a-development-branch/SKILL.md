---
name: finishing-a-development-branch
user-invocable: false
description: >
  Use when implementation is complete and you need to verify readiness before
  creating a PR. Triggers on "I'm done", "ready to create PR", "feature complete",
  "finish this branch", or when SDLC pipeline reaches the PR creation boundary.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - PowerShell
context: fork
---

# Finishing a Development Branch

You are performing the final quality gate before PR creation on Ghostfolio. Verify the branch is truly ready — tests pass, code is clean, and git hygiene is correct.

## Iron Laws

- NEVER DECLARE A BRANCH DONE WITHOUT RUNNING THE FULL TEST SUITE.
- NEVER COMMIT DEBUG LOGS, TODO COMMENTS, OR .only()/.skip() IN THE FINAL STATE.
- NEVER PUSH WITHOUT CHECKING BRANCH IS REBASED ON LATEST MAIN.

---

## Process

### Step 1: Run Full Test Suite

```bash
npm test
```

**If tests fail:** STOP. Do not proceed. Fix failures first.
**If tests pass:** Record the count and continue.

### Step 2: Code Cleanliness Check

```bash
# Find debug statements in changed files
git diff main --name-only -- '*.ts' '*.tsx' '*.js' '*.jsx' | xargs grep -n 'console\.log\|console\.debug\|debugger' 2>/dev/null

# Find TODO/FIXME in changed files
git diff main --name-only -- '*.ts' '*.tsx' '*.js' '*.jsx' | xargs grep -n 'TODO\|FIXME\|HACK\|XXX' 2>/dev/null

# Find .skip() and .only() in test files
git diff main --name-only -- '*.test.*' '*.spec.*' | xargs grep -n '\.skip\|\.only' 2>/dev/null
```

**If any found:** Report them and ask user whether to fix or proceed.

### Step 3: Ghostfolio-Specific Checks

```bash
# Check for .env references being committed
git diff main --name-only | grep '\.env$'

# Check format
npm run format:check

# Check lint
npm run lint
```

**Additional checks:**
- [ ] If database schema changed: a Prisma migration was created (not just `database:push`)
- [ ] If new API endpoint: endpoint follows existing patterns in `apps/api/src/app/endpoints/`
- [ ] If new shared utility: added to `libs/common/src/index.ts` exports

### Step 4: Git Hygiene

```bash
# Verify branch name
git branch --show-current

# Check commits
git log main..HEAD --oneline

# Check no .env files staged
git diff main --name-only | grep '\.env$'

# Check branch is not behind main
git fetch origin main && git log HEAD..origin/main --oneline
```

**If branch is behind main:**
```bash
git rebase origin/main
# Re-run tests after rebase
```

### Step 5: Pre-PR Summary

```
## Branch Readiness Report

**Branch:** <branch-name>
**Tests:** X passing, 0 failing
**Code cleanliness:** [clean | N issues found]
**Ghostfolio checks:** [all pass | N items flagged]
**Git hygiene:** [clean | needs rebase]

**Ready for PR:** [Yes | No — N items need attention]
```

### Step 6: Create PR

When all checks pass, create the PR with `gh`:

```bash
gh pr create \
  --title "<type>: <short description>" \
  --body "$(cat <<'EOF'
## Summary
- <bullet: what changed>
- <bullet: why>

## Test plan
- [ ] All tests pass (`npm test`)
- [ ] Manually verified in browser

## Related
Closes #<issue-number>
EOF
)"
```
