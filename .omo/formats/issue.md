---
title: "Issue Format Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["issue-splitter", "repair-agent", "reviewer"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Issue Format

> **Purpose:** Defines the standard format for every issue in the Repair Company workflow. Every issue produced by the Issue Splitter MUST conform to this format.

---

## Structure

Every issue is a YAML document with the following fields:

```yaml
---
id: "PREFIX-NNN"              # Unique issue identifier
title: "Short descriptive title"
severity: "critical"          # critical | high | medium | low | cosmetic
priority: 0                   # 0 (immediate) | 1 (next) | 2 (soon) | 3 (backlog)
phase: "tier-0"               # tier-0 | tier-1 | tier-2 | baseline | emergency
status: "open"                # open | assigned | in-progress | review | security-review | qa | rca | done | blocked
files:                        # Files involved in this issue
  - "path/to/file1.ts"
  - "path/to/file2.ts"
dependencies: []              # Issue IDs this depends on
reviewer: ""                  # Agent role assigned for review
security_review: false        # Does this need a security review?
tests_required: true          # Are tests required for this change?
rollback: ""                  # Rollback strategy description
risk: ""                      # Risk assessment of the change
owner: ""                     # Agent session/ID assigned
created: "2026-07-30"         # ISO date
source: ""                    # Source — audit finding, bug report, etc.
acceptance_criteria:          # List of conditions that define "done"
  - "Condition 1"
  - "Condition 2"
context: ""                   # Additional context for the repair agent
---
```

---

## Field Descriptions

### `id`
- Format: `{PREFIX}-{NNN}`
- Prefixes:
  - `SEC` — Security
  - `ARCH` — Architecture
  - `BACKEND` — Backend/API
  - `FRONTEND` — Frontend/UI
  - `DB` — Database
  - `QA` — Testing/Quality
  - `PERF` — Performance
  - `DEVOPS` — DevOps/Infrastructure
  - `I18N` — Internationalization
  - `ACCESS` — Accessibility
  - `DEP` — Dependencies
  - `DOC` — Documentation
- Numbers are zero-padded to 3 digits: `SEC-001`

### `severity`
| Value | Definition | Response |
|-------|-----------|----------|
| **critical** | Exploitable vulnerability, data loss, crash | Stop all work, fix immediately |
| **high** | Significant functional gap, incorrect behavior | Fix before next release |
| **medium** | Suboptimal but working, limited impact | Fix when convenient |
| **low** | Cosmetic, nice-to-have | Backlog |
| **cosmetic** | Style, formatting, minor UX | Backlog |

### `priority`
| Value | Meaning |
|-------|---------|
| 0 | Immediate — blocks all other work |
| 1 | Next cycle — high priority |
| 2 | Soon — after current cycle |
| 3 | Backlog — when resources permit |

### `phase`
| Value | Meaning |
|-------|---------|
| `emergency` | Phase 2 — immediate isolated fixes, no business logic change |
| `tier-0` | Phase 4 — blockers post-regression suite |
| `tier-1` | Phase 6 — validation, auth, tests, monitoring |
| `tier-2` | Phase 7 — optimization, refactoring, UX |
| `baseline` | Phase 1 — baseline documentation only |

### `status`
| Value | Meaning |
|-------|---------|
| `open` | Created, not yet assigned |
| `assigned` | Repair agent assigned |
| `in-progress` | Repair agent working |
| `review` | In code review |
| `security-review` | In security review |
| `qa` | In QA validation |
| `rca` | RCA in progress |
| `done` | Completed and merged |
| `blocked` | Blocked by dependency or external factor |

### `rollback`
Must describe how to undo the change:
- Simple revert commit
- Feature flag disable
- Database migration revert
- Configuration change

### `risk`
Assessment of what could go wrong:
- What could break?
- What is the blast radius?
- What monitoring would catch a failure?

---

## Example

```yaml
---
id: "SEC-001"
title: "Remove SERVICE_ROLE_KEY from .env.local"
severity: "critical"
priority: 0
phase: "emergency"
status: "open"
files:
  - ".env.local"
  - "src/lib/supabase/client.ts"
dependencies: []
reviewer: "security-reviewer"
security_review: true
tests_required: false
rollback: "Restore .env.local from git"
risk: "Low — purely config change. Auth flow must still work."
owner: ""
created: "2026-07-30"
source: "Security Audit SEC-001"
acceptance_criteria:
  - "No SERVICE_ROLE_KEY value in .env.local or any committed file"
  - "Application still connects to Supabase"
  - "All authenticated flows continue to work"
context: "The service role key grants full database access bypassing RLS. It was accidentally committed for local development convenience."
---
```

---

## Relations

- `templates/issue-template.md` — usable template
- `formats/rca.md` — RCA format for completed issues
- `formats/review.md` — review format for issue review
- `agents/issue-splitter.md` — agent that creates issues in this format

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
