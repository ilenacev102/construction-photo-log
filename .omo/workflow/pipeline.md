---
title: "Workflow Pipeline Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["all-agents"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Workflow Pipeline

> **Purpose:** Defines the complete workflow pipeline from audit to release. Every agent, issue, and phase fits into this pipeline.

---

## Overview

```
                     ┌──────────────────┐
                     │   Phase 0        │
                     │   Governance     │
                     │   (this file)    │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   Phase 1        │
                     │   Baseline       │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   Phase 2        │
                     │   Emergency Fixes│
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   Phase 3        │
                     │  Regression Suite│
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   Phase 4        │
                     │   Tier 0 Repair  │
                     │   (full cycle)   │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   Phase 5        │
                     │   Inspectors     │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   Phase 6        │
                     │   Tier 1         │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   Phase 7        │
                     │   Optimization   │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   Release        │
                     └──────────────────┘
```

---

## Phase 0 — Governance

**Goal:** Define rules, roles, and standards.

**Activities:**
- Load `.omo/CONSTITUTION.md`
- Load relevant agent specs
- Load workflow and gates
- Confirm understanding with CEO

**Inputs:** `.omo/` specification files
**Outputs:** Confirmed operating context
**Gate:** Constitution acknowledged by all agents

---

## Phase 1 — Baseline

**Goal:** Document current project state before any changes.

**Activities:**
1. Run build: `npm run build` (or equivalent)
2. Run typecheck: `npx tsc --noEmit`
3. Run lint: `npm run lint`
4. Run existing tests: `npm test`
5. Document results

**Inputs:** Current codebase
**Outputs:** Baseline report (build status, type errors, lint errors, test results)
**Gate:** Gate 1 — Build + Typecheck + Lint
**CEO Action:** Review baseline, decide if Phase 2 can start

---

## Phase 2 — Emergency Fixes

**Goal:** Fix critical security issues that are isolated and don't change business logic.

**Scope:** Only issues that are:
- Security-critical (secrets, injection, access control)
- Purely config or safety changes (no business logic modification)
- Isolated (one file, minimal diff)

**Activities per issue:**
1. Issue Splitter creates atomic issue
2. CEO assigns to Repair Agent
3. Repair Agent implements fix
4. Reviewer reviews
5. Security reviews (if applicable)
6. QA validates
7. CEO approves merge
8. RCA filed

**Inputs:** Baseline, audit findings
**Outputs:** Emergency fixes merged
**Gate:** Gate 2 — No Critical Secrets
**CEO Action:** Confirm no business logic changed

---

## Phase 3 — Regression Test Suite

**Goal:** Lock current behavior with tests. Without tests, no way to verify Tier 0 repairs don't break functionality.

**Activities:**
1. Identify critical paths: login, dashboard, create project, upload photo
2. Write integration tests for critical API endpoints
3. Write E2E tests for critical user flows
4. Ensure existing tests still pass
5. Document test coverage gaps

**Inputs:** Baseline, emergency fixes
**Outputs:** Regression test suite, test coverage report
**Gate:** Gate 3 — Regression Suite passes 100%
**CEO Action:** Review test coverage, approve Phase 4

---

## Phase 4 — Tier 0 Repair Workflow

**Goal:** Systematic repair of all Tier 0 issues using the full Repair Company workflow.

### Repair Cycle (per issue)

```
┌──────────────┐
│ Issue        │  Issue Splitter creates atomic issue
│ Created      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Repair       │  Repair Agent implements minimal fix
│ Agent        │  (build + typecheck + lint + test)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Review       │  Independent Reviewer evaluates diff
│ Agent        │  (classify findings, PASS/FAIL)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Security     │  If security_flagged: read-only security review
│ Review       │  (CRITICAL/HIGH/MEDIUM/LOW)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ QA           │  Run regression suite, verify acceptance criteria
│ Validation   │  (build + tests + smoke)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ CEO          │  Final review, approve merge
│ Approval     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Merge        │  Squash-merge with issue ID in message
│ & Close      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ RCA          │  Root Cause Analysis filed
│ Filed        │
└──────────────┘
```

**Inputs:** Tier 0 issues from Issue Splitter
**Outputs:** Fixed issues merged, RCAs filed
**Gate:** All Tier 0 issues resolved
**CEO Action:** Verify all issues closed, all RCAs filed

---

## Phase 5 — Mandatory Inspectors

**Goal:** Run the full inspector suite to validate system health.

**Inspectors to run:**

| Inspector | When | Gate |
|-----------|------|------|
| Secrets Inspector | Every cycle | Gate 2 |
| Dependency Inspector | Every cycle | Gate 2 |
| Schema Drift Inspector | Every cycle | Gate 5 |
| RLS Inspector | Every cycle | Gate 4 |
| Release Readiness Inspector | Every cycle | Gate 5 |
| Permission Matrix Inspector | Every 3 cycles | — |
| API Contract Inspector | Every 3 cycles | — |
| State Management Inspector | Every 3 cycles | — |
| Memory Leak Inspector | Every 3 cycles | — |
| Observability Inspector | Every cycle | Gate 5 |

**Inputs:** Current codebase
**Outputs:** Inspector reports
**Gate:** All mandatory inspectors PASS
**CEO Action:** Review inspector findings, resolve blockers

---

## Phase 6 — Tier 1

**Goal:** Systematic repair of Tier 1 issues: validation, authorization, logging, monitoring, integration tests, unit tests.

**Process:** Same Repair Cycle as Phase 4 (Split → Repair → Review → Security → QA → Merge → RCA)

**Inputs:** Tier 1 issues from Issue Splitter
**Outputs:** Tier 1 fixes merged
**Gate:** All Tier 1 issues resolved
**CEO Action:** Verify all issues closed

---

## Phase 7 — Optimization (Tier 2)

**Goal:** Performance optimization, refactoring, bundle size, N+1 queries, memory, UX, i18n, accessibility.

**Process:** Same Repair Cycle (Split → Repair → Review → QA → Merge → RCA)

**Inputs:** Tier 2 issues from Issue Splitter
**Outputs:** Tier 2 fixes merged
**Gate:** All Tier 2 issues resolved
**CEO Action:** Verify all issues closed

---

## Release

**Goal:** Produce a release with full documentation.

**Activities:**
1. Release Manager verifies all Gates 1–6
2. Release Manager produces release document
3. CEO, Security, QA approve
4. Deploy
5. Post-deployment monitoring (48h)

**Inputs:** All merged changes, inspector reports, gate results
**Outputs:** Release document, deployment
**Gate:** Gate 6 — Final Inspection Board approval
**CEO Action:** Sign off on release

---

## Engineering Director

The Engineering Director runs continuously across all phases:

- Before Phase 1: Initial health snapshot
- After Phase 4: Health delta
- After Phase 6: Health delta
- After Release: Full health report
- Continuous: Risk flag detection

---

## Relations

- `workflow/gates.md` — quality gates enforced during pipeline
- `formats/release.md` — release format produced at end
- `agents/ceo.md` — CEO manages pipeline transitions
- `agents/release-manager.md` — Release Manager handles final gates

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
