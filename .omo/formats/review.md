---
title: "Code Review Format Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["reviewer", "security"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Code Review Format

> **Purpose:** Defines the standard format for every code review. Every review produced by a Reviewer or Security agent MUST conform to this format.

---

## Structure

```yaml
---
id: "REVIEW-PREFIX-NNN"
issue_id: "PREFIX-NNN"
reviewer: "agent-role"        # reviewer | security
date: "2026-07-30"
status: "completed"            # completed | pending-fixes | re-review-needed
verdict: "PASS"                # PASS | FAIL
---
```

## Sections

### 1. Summary

One-paragraph assessment of the change.

```
Summary:
The change removes SERVICE_ROLE_KEY from .env.local and replaces it with
the anon key. The supabase client is updated to use the anon key. No
business logic is modified. The change is minimal and well-scoped.
```

### 2. Findings

Each finding follows this format:

```
## {severity}: {short description}

**File:** `path/to/file.ts` (line N)
**Category:** correctness | security | type-safety | error-handling | edge-cases | test-coverage | style | diff-discipline

**Observation:**
{Detailed description of what the reviewer observed}

**Recommendation:**
{What should be done about it}

**Response:**
{fixed | acknowledged | disputed} — {repair agent's response}
```

#### Severity Levels

| Severity | Meaning | Required Action |
|----------|---------|-----------------|
| **BLOCKING** | Must fix before merge | Cannot merge until resolved |
| **MAJOR** | Should fix before merge | Strongly recommended, may merge with CEO approval |
| **MINOR** | Should fix but not blocking | Can be deferred to follow-up issue |
| **NIT** | Style preference | Reviewer's opinion, author's choice |

### 3. Criteria Checklist

| Criterion | PASS/FAIL | Notes |
|-----------|-----------|-------|
| Correctness | | |
| Security | | |
| Type Safety | | |
| Error Handling | | |
| Edge Cases | | |
| Test Coverage | | |
| Style Compliance | | |
| Diff Discipline | | |

### 4. Verdict

```
Verdict: PASS
Blocking findings: 0
Major findings: 1
Minor findings: 2
Nits: 1

Conditions for PASS (if any):
- Minor findings addressed before merge (not blocking)
```

---

## Security Review Specifics

For Security reviews, the format is the same with these additions:

### Header

```yaml
reviewer: "security"
security_review: true
```

### Additional Criteria

| Criterion | PASS/FAIL | Notes |
|-----------|-----------|-------|
| Secrets Exposure | | |
| Injection Vectors | | |
| Authentication | | |
| Authorization | | |
| Input Validation | | |
| Output Encoding | | |
| Session Management | | |

### Vulnerability Classification

Every security finding must include:

```
**CWE:** CWE-200 (Exposure of Sensitive Information)
**CVSS Score:** 9.1 (Critical)
**Exploitability:** High — anyone with repo access could use the key
**Impact:** Full database access bypassing all RLS
```

---

## Relations

- `formats/issue.md` — the issue under review
- `templates/review-template.md` — usable review template
- `agents/reviewer.md` — reviewer agent specification
- `agents/security.md` — security agent specification

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
