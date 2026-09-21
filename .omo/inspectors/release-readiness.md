---
title: "Release Readiness Inspector Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["release-readiness-inspector"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Release Readiness Inspector

> **Purpose:** Validates that the project is ready for deployment. Checks build integrity, migration safety, rollback capability, and deployment configuration.

---

## What It Checks

1. **Build integrity** — Does the project build without errors?
2. **TypeScript compilation** — Zero type errors in strict mode.
3. **Lint** — Zero lint errors.
4. **Test suite** — All tests pass.
5. **Migration ordering** — Migrations are sequential, no gaps, no duplicates.
6. **Migration test** — Can migrations run from scratch without error?
7. **Rollback test** — Can migrations be rolled back?
8. **Feature flags** — Are in-progress features behind feature flags?
9. **Environment config** — Are all required environment variables documented?
10. **CI/CD config** — Is the deployment pipeline configured correctly?
11. **Static assets** — Are all static files built and cache-busted?
12. **Docker build** — Does the Docker image build (if applicable)?

---

## What It Ignores

1. Features explicitly marked as "not ready" behind feature flags.
2. Documentation not yet written (documentation is not a release blocker).
3. Performance metrics (covered by other inspectors).

---

## Severity Classification

All findings are BLOCKING or NON-BLOCKING:

| Severity | Definition | Response |
|----------|------------|----------|
| **BLOCKING** | Build would fail, data would be lost, or rollback would be impossible | Block release, fix before deploy |
| **NON-BLOCKING** | Everything works but could be improved | Document for next release |

---

## Failure Conditions

**FAIL** if:
- Build does not compile
- Any test fails
- Migrations cannot run from scratch
- Rollback not tested or would fail
- Missing required environment variables

**PASS** if:
- Build compiles
- All tests pass
- Migrations work forward and backward
- Required env vars are documented
- Deployment pipeline is configured

---

## Output

```yaml
checks:
  - name: "Build"
    status: "PASS"
    detail: "npm run build exit code 0"
  - name: "TypeScript"
    status: "PASS"
    detail: "Zero type errors"
  - name: "Lint"
    status: "PASS"
    detail: "Zero lint errors"
  - name: "Tests"
    status: "PASS"
    detail: "47/47 tests passing"
  - name: "Migrations (apply)"
    status: "PASS"
    detail: "All 23 migrations apply successfully from scratch"
  - name: "Migrations (rollback)"
    status: "PASS"
    detail: "Last 3 migrations rollback successfully"
  - name: "Environment Variables"
    status: "WARNING"
    detail: "NEXT_PUBLIC_SUPABASE_ANON_KEY not documented in .env.example"
    recommendation: "Add to .env.example"
verdict: "PASS"
```

---

## Relations

- `workflow/gates.md` — validates Gate 5 (Release Readiness)
- `agents/release-manager.md` — primary consumer
- `agents/qa.md` — shares build/test results

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
