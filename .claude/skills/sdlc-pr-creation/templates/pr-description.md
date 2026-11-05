# Pull Request Description Template — Ghostfolio

> **Client-specific:** This template is for Ghostfolio (rajagondap/ghostfolio).
> GitHub Issues are linked via `Closes #<ISSUE_NUM>` — no Jira base URL needed.

---

## Template

```markdown
### Ticket Reference

Closes #<ISSUE_NUM>

---

### Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (change that causes existing functionality to break)
- [ ] Refactoring (no functional change)
- [ ] Other (please explain):

---

### Context

**Before:**
[Describe the previous behavior]

**After:**
[Describe the new behavior]

---

### Architecture Document (if applicable)

[ph2_design_spec.md](docs/artifacts/<TICKET-ID>/ph2_design_spec.md)

---

### How Has This Been Tested?

- [ ] Unit tests added / updated and passing (`npm test`)
- [ ] Integration tests added / updated and passing (`npm run test:api`)
- [ ] Manually tested locally
- [ ] Database migration verified

---

### Checklist

- [ ] My code follows Ghostfolio's coding guidelines
- [ ] I have added or updated unit/integration tests
- [ ] All new and existing tests pass locally (`npm test`)
- [ ] Formatting passes (`npm run format:check`)
- [ ] Linting passes (`npm run lint`)
- [ ] My code does not introduce `console.log` in production code (use NestJS Logger)
- [ ] Path aliases used (`@ghostfolio/common`, `@ghostfolio/api/*`) not relative imports
- [ ] If Prisma schema changed: migration created and typings regenerated
- [ ] Performed a self-review of my own code
- [ ] Removed all unnecessary comments and logs

---

### SDLC Pipeline Artifacts

- [Requirements](docs/artifacts/<TICKET-ID>/ph1_problem_spec.md)
- [Architecture](docs/artifacts/<TICKET-ID>/ph2_design_spec.md)
- [Verification Report](docs/artifacts/<TICKET-ID>/ph8_verification_report.md)
- [Risk Assessment](docs/artifacts/<TICKET-ID>/ph9_risk_assessment.md)

---

### Anything else we should know?

[Additional context, caveats, or follow-up work]

🤖 Generated with [Claude Code](https://claude.com/claude-code) via Agentic SDLC Pipeline
```
