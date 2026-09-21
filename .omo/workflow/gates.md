---
title: "Quality Gates Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["all-agents", "release-manager"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Quality Gates

> **Purpose:** Defines 6 Quality Gates with precise PASS/FAIL conditions. Every gate must be passed before the pipeline advances to the next phase.

---

## Gate 1 — Build Integrity

**Phase:** Baseline (Phase 1)
**Owner:** QA Agent
**Blocking:** Yes — pipeline cannot proceed without PASS

### Criteria

| # | Check | PASS Condition | Evidence Required |
|---|-------|----------------|-------------------|
| 1.1 | Build | `npm run build` or equivalent exits with code 0 | Build output |
| 1.2 | TypeScript | `npx tsc --noEmit` reports zero errors | TSC output |
| 1.3 | Lint | `npm run lint` or equivalent reports zero errors | Lint output |
| 1.4 | Existing Tests | `npm test` or equivalent exits with code 0 | Test output |

### Verdict

```
PASS:  All 4 checks pass
FAIL:  Any check fails

On FAIL:
  - If build or typecheck fails → Block pipeline, escalate to CEO
  - If lint or tests fail → Log as baseline issues, may proceed with CEO approval
```

---

## Gate 2 — No Critical Vulnerabilities

**Phase:** Emergency Fixes (Phase 2)
**Owner:** Secrets Inspector + Dependency Inspector
**Blocking:** Yes

### Criteria

| # | Check | PASS Condition | Evidence Required |
|---|-------|----------------|-------------------|
| 2.1 | Secrets | Zero CRITICAL secrets findings | Secrets Inspector report |
| 2.2 | Dependencies | Zero CRITICAL dependency vulnerabilities | Dependency Inspector report |
| 2.3 | Secrets (HIGH) | Zero or manageable HIGH findings | Secrets Inspector report |

### Verdict

```
PASS:  Zero CRITICAL secrets + Zero CRITICAL deps
FAIL:  Any CRITICAL finding

On FAIL:
  - Return to Phase 2 for the specific issue
  - All other work is BLOCKED until CRITICAL findings resolved

On WARNING (HIGH findings but no CRITICAL):
  - May proceed to Phase 3 with CEO approval
  - HIGH findings must be resolved in Phase 4 or Phase 6
```

---

## Gate 3 — Regression Suite

**Phase:** Regression Test Suite (Phase 3)
**Owner:** QA Agent
**Blocking:** Yes — Tier 0 cannot start without PASS

### Criteria

| # | Check | PASS Condition | Evidence Required |
|---|-------|----------------|-------------------|
| 3.1 | Test Suite | All tests pass (100%) | Test output |
| 3.2 | Coverage Baseline | Coverage percentage documented | Coverage report |
| 3.3 | Critical Path Coverage | Login, dashboard, upload, CRUD tested | Test list |
| 3.4 | No Flaky Tests | Every test passes 3 consecutive runs | Test output (3x) |

### Verdict

```
PASS:  All tests pass, no flaky tests
FAIL:  Any test fails

On FAIL:
  - If test failure is in code → Fix the code, not the test
  - If test is incorrect → Fix the test, document why
  - If test is flaky → Rewrite or remove, document in issue

Note: 100% pass rate is required. "Mostly passing" is FAIL.
```

---

## Gate 4 — Security Review

**Phase:** Tier 0 Repair (Phase 4)
**Owner:** Security Agent
**Blocking:** Yes

### Criteria

| # | Check | PASS Condition | Evidence Required |
|---|-------|----------------|-------------------|
| 4.1 | Security Review PASS | Security verdict is PASS | Security review document |
| 4.2 | No CRITICAL Findings | Zero unresolved CRITICAL | Security review findings |
| 4.3 | No HIGH Findings | Zero unresolved HIGH | Security review findings |
| 4.4 | RLS Validated | RLS Inspector PASS (if applicable) | RLS Inspector report |
| 4.5 | Permission Matrix | Permission Matrix PASS (if applicable) | Permission Matrix report |

### Verdict

```
PASS:  All checks pass
FAIL:  Any CRITICAL or HIGH finding unresolved

On FAIL:
  - CRITICAL → Block ALL work, return to Phase 2
  - HIGH → Block this release, fix in current cycle
  - MEDIUM/LOW → Document, may proceed with CEO approval
```

---

## Gate 5 — Release Readiness

**Phase:** Pre-Release
**Owner:** Release Readiness Inspector + Release Manager
**Blocking:** Yes — release cannot proceed without PASS

### Criteria

| # | Check | PASS Condition | Evidence Required |
|---|-------|----------------|-------------------|
| 5.1 | Build | Build compiles | Build output |
| 5.2 | Tests | All tests pass | Test output |
| 5.3 | Migrations | Migrations run from scratch without error | Migration test output |
| 5.4 | Rollback | Migrations rollback successfully | Rollback test output |
| 5.5 | Environment | Required env vars documented | `.env.example` check |
| 5.6 | Schema Drift | Schema Drift Inspector PASS | Schema Drift report |
| 5.7 | Observability | Observability Inspector PASS or WARNING | Observability report |

### Verdict

```
PASS:  All 7 checks pass
FAIL:  Any of 5.1–5.4 fails

On FAIL:
  - 5.1 (build): Block immediately
  - 5.2 (tests): Return to Phase 4/6
  - 5.3 (migrations): Return to repair with Schema Drift issues
  - 5.4 (rollback): Return to repair — rollback is mandatory
  - 5.5–5.7 (env, schema, observability): May proceed with CEO approval for WARNING, FAIL blocks
```

---

## Gate 6 — Final Inspection Board

**Phase:** Release Approval
**Owner:** CEO Agent
**Blocking:** Yes — final gate before release

### Criteria

| # | Check | PASS Condition | Evidence Required |
|---|-------|----------------|-------------------|
| 6.1 | All Gates 1–5 PASS | Gate history shows all PASS | Gate records |
| 6.2 | All Issues Closed | Zero open issues in cycle | Issue tracker |
| 6.3 | All RCAs Filed | 100% of closed issues have RCA | RCA documents |
| 6.4 | All Reviews PASS | Every issue review verdict PASS | Review documents |
| 6.5 | Security Review PASS | Security verdict PASS | Security review |
| 6.6 | QA Validation PASS | QA validation PASS | QA report |
| 6.7 | Engineer Health Report | Engineering Director report reviewed | EHR document |
| 6.8 | Rollback Plan | Release rollback plan documented | Release document |

### Verdict

```
PASS:  All 8 checks pass, CEO signs off
FAIL:  Any check fails

On FAIL:
  - CEO decides whether to fix, defer, or cancel the release
  - Only the CEO can override a Gate 6 failure, and must document the rationale
```

---

## Gate Overrides

### Who can override
- Only the **CEO Agent** can override a Quality Gate.
- Override must be documented with rationale.
- Overrides are recorded in the Engineering Health Report.

### When override is permitted
- **Gate 1** (build): Never override. Build must compile.
- **Gate 2** (secrets): Never override for CRITICAL. May override HIGH with documented risk acceptance.
- **Gate 3** (tests): Never override. Tests must pass.
- **Gate 4** (security): Never override for CRITICAL or HIGH. May override MEDIUM/LOW.
- **Gate 5** (release readiness): Never override for build, migration, or rollback failures.
- **Gate 6** (final): Override only with CTO approval documented.

---

## Gate State Machine

```
         ┌─────────┐
         │ Gate 1  │───FAIL──→ Blocked
         └────┬────┘
              │ PASS
              ▼
         ┌─────────┐
         │ Gate 2  │───FAIL──→ Phase 2
         └────┬────┘
              │ PASS
              ▼
         ┌─────────┐
         │ Gate 3  │───FAIL──→ Phase 3
         └────┬────┘
              │ PASS
              ▼
    ┌────────────────────┐
    │  Phase 4 (Tier 0)  │
    └─────────┬──────────┘
              │
              ▼
         ┌─────────┐
         │ Gate 4  │───FAIL──→ Phase 2/4
         └────┬────┘
              │ PASS
              ▼
    ┌────────────────────┐
    │  Phase 5 (Insp.)   │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │  Phase 6 (Tier 1)  │
    └─────────┬──────────┘
              │
              ▼
         ┌─────────┐
         │ Gate 5  │───FAIL──→ Phase 4/6
         └────┬────┘
              │ PASS
              ▼
    ┌────────────────────┐
    │  Phase 7 (Tier 2)  │
    └─────────┬──────────┘
              │
              ▼
         ┌─────────┐
         │ Gate 6  │───FAIL──→ CEO decision
         └────┬────┘
              │ PASS
              ▼
         ┌─────────┐
         │ RELEASE │
         └─────────┘
```

---

## Relations

- `workflow/pipeline.md` — the pipeline these gates protect
- `agents/release-manager.md` — gatekeeper role
- `agents/ceo.md` — override authority
- `formats/release.md` — gate results included in release document

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
