# .omo Directory Standard & Index

> **Purpose:** Defines the `.omo/` directory structure, file conventions, and serves as the index for all engineering system specifications.
>
> **Status:** Active · **Version:** 1.0.0
>
> **Applies to:** All agents operating within this repository.

---

## Directory Structure

```
.omo/
├── INDEX.md                        # THIS FILE — directory standard + index
├── CONSTITUTION.md                 # Company Constitution — principles, standards, rules
│
├── agents/                         # Agent Role Specifications
│   ├── ceo.md                      #   CEO — orchestrator, final approval
│   ├── planner.md                  #   Planner — task decomposition, sequencing
│   ├── architect.md                #   Architect — design decisions, structure
│   ├── issue-splitter.md           #   Issue Splitter — atomic issue breakdown
│   ├── repair-agent.md             #   Repair Agent — single-issue fix executor
│   ├── reviewer.md                 #   Reviewer — independent code review
│   ├── qa.md                       #   QA — test validation, regression
│   ├── security.md                 #   Security — read-only security validation
│   ├── rca.md                      #   RCA — root cause analysis
│   ├── release-manager.md          #   Release Manager — pipeline gatekeeper
│   └── engineering-director.md     #   Engineering Director — proactive health
│
├── inspectors/                     # Inspector Specifications
│   ├── secrets.md                  #   Secrets Inspector
│   ├── dependency.md               #   Dependency Inspector
│   ├── schema-drift.md             #   Schema Drift Inspector
│   ├── rls.md                      #   RLS Inspector
│   ├── release-readiness.md        #   Release Readiness Inspector
│   ├── permission-matrix.md        #   Permission Matrix Inspector
│   ├── api-contract.md             #   API Contract Inspector
│   ├── state-management.md         #   State Management Inspector
│   ├── memory-leak.md              #   Memory Leak Inspector
│   └── observability.md            #   Observability Inspector
│
├── workflow/                       # Workflow Engine
│   ├── pipeline.md                 #   Full pipeline from Audit to Release
│   └── gates.md                    #   Quality Gates 1–6 with PASS/FAIL
│
├── formats/                        # Standard Format Specifications
│   ├── issue.md                    #   Issue format
│   ├── rca.md                      #   Root Cause Analysis format
│   ├── review.md                   #   Code Review format
│   ├── release.md                  #   Release format
│   └── engineering-health-report.md #   Engineering Director health report
│
├── templates/                      # Reusable Templates
│   ├── issue-template.md           #   Issue template for repair cycles
│   ├── rca-template.md             #   RCA template
│   └── review-template.md          #   Review template
│
├── plans/                          # Implementation Plans (pre-existing)
│   └── *.md                        #   Plan documents per feature/issue
│
└── run-continuation/              # Session Continuation State (pre-existing)
    └── *.json                      #   Serialized session state
```

---

## File Conventions

### Frontmatter

Every specification file MUST have YAML frontmatter:

```yaml
---
title: "Specification Name"
type: specification
status: active              # active | draft | superseded
version: "1.0.0"
applies_to: ["agent-type"]  # which agent roles use this
last_reviewed: "2026-07-30"
supersedes: []              # path to superseded spec, if any
---
```

### Content Structure

Every specification follows this template:

1. **Purpose** — one-paragraph statement of why this exists
2. **Scope** — what is and is not covered
3. **Specification** — the detailed specification
4. **Relations** — links to related specs
5. **Version History** — change log

### File Naming

- Lowercase with hyphens: `schema-drift.md`
- One concept per file
- No numeric prefixes (ordering is by directory index)

### Cross-References

- Reference other `.omo/` files by relative path: `../agents/ceo.md`
- Reference code by absolute project path: `src/app/api/`
- External references: `[Engineering Meta-Skills](../../Brain/07%20-%20Knowledge/Engineering%20Meta-Skills.md)`

---

## File Index

| File | Purpose | Applies To |
|------|---------|------------|
| `CONSTITUTION.md` | Engineering principles, standards, rules | All agents |
| `agents/ceo.md` | CEO role specification | CEO agent |
| `agents/planner.md` | Planner role specification | Planner agent |
| `agents/architect.md` | Architect role specification | Architect agent |
| `agents/issue-splitter.md` | Issue Splitter role specification | Issue Splitter agent |
| `agents/repair-agent.md` | Repair Agent role specification | All repair agents |
| `agents/reviewer.md` | Reviewer role specification | All review agents |
| `agents/qa.md` | QA role specification | QA agent |
| `agents/security.md` | Security role specification | Security agent |
| `agents/rca.md` | RCA role specification | RCA agent |
| `agents/release-manager.md` | Release Manager specification | Release Manager |
| `agents/engineering-director.md` | Engineering Director specification | Engineering Director |
| `inspectors/secrets.md` | Secrets Inspector specification | Secrets Inspector |
| `inspectors/dependency.md` | Dependency Inspector specification | Dependency Inspector |
| `inspectors/schema-drift.md` | Schema Drift Inspector specification | Schema Drift Inspector |
| `inspectors/rls.md` | RLS Inspector specification | RLS Inspector |
| `inspectors/release-readiness.md` | Release Readiness Inspector spec | Release Readiness Inspector |
| `inspectors/permission-matrix.md` | Permission Matrix Inspector spec | Permission Matrix Inspector |
| `inspectors/api-contract.md` | API Contract Inspector spec | API Contract Inspector |
| `inspectors/state-management.md` | State Management Inspector spec | State Management Inspector |
| `inspectors/memory-leak.md` | Memory Leak Inspector spec | Memory Leak Inspector |
| `inspectors/observability.md` | Observability Inspector spec | Observability Inspector |
| `workflow/pipeline.md` | Complete workflow pipeline | All agents |
| `workflow/gates.md` | Quality Gates 1–6 | All agents, Release Manager |
| `formats/issue.md` | Standard issue format | Issue Splitter, Repair, Review |
| `formats/rca.md` | Standard RCA format | RCA agent |
| `formats/review.md` | Standard review format | Reviewer agents |
| `formats/release.md` | Standard release format | Release Manager |
| `formats/engineering-health-report.md` | Health report format | Engineering Director |
| `templates/issue-template.md` | Reusable issue template | Issue Splitter |
| `templates/rca-template.md` | Reusable RCA template | RCA agent |
| `templates/review-template.md` | Reusable review template | Reviewer |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation — full engineering system specification |
