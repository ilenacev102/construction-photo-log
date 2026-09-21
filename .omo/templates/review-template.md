<!--
TEMPLATE: Review Document
PURPOSE: Every code diff must be reviewed before merge. This document records the review.
USAGE: Created by Reviewer Agent after Repair Agent completes work
-->

# Code Review: [Issue Title]

**Review ID:** `REV-YYYYMMDD-NNN`
**Issue ID:** `ISS-YYYYMMDD-NNN`
**Reviewer:** [Agent name]
**Date:** [YYYY-MM-DD]
**Files Changed:** [N]

---

## Summary

[1-2 sentence overview of what the diff does and whether it meets the issue's acceptance criteria.]

---

## Review Checklist

### Correctness

| # | Check | PASS/FAIL/NA | Note |
|---|-------|-------------|------|
| 1 | Code does what the issue describes | | |
| 2 | No logical errors or edge case misses | | |
| 3 | All acceptance criteria met | | |
| 4 | Error handling is appropriate | | |
| 5 | No regression risk introduced | | |

### Code Quality

| # | Check | PASS/FAIL/NA | Note |
|---|-------|-------------|------|
| 6 | Follows project style and conventions | | |
| 7 | No dead code or commented code | | |
| 8 | Variable/function names clear | | |
| 9 | No AI slop patterns | | |
| 10 | Appropriate comments (not too many, not too few) | | |

### Type Safety

| # | Check | PASS/FAIL/NA | Note |
|---|-------|-------------|------|
| 11 | No `as any` or `@ts-ignore` | | |
| 12 | No implicit `any` | | |
| 13 | Generic types are properly constrained | | |

### Security

| # | Check | PASS/FAIL/NA | Note |
|---|-------|-------------|------|
| 14 | No hardcoded secrets | | |
| 15 | Input validation present | | |
| 16 | No SQL injection vectors | | |
| 17 | No XSS vectors | | |
| 18 | RBAC/RLS respected (if applicable) | | |

### Testing

| # | Check | PASS/FAIL/NA | Note |
|---|-------|-------------|------|
| 19 | New code has tests (if testable) | | |
| 20 | Existing tests still pass | | |
| 21 | Edge cases covered | | |

### Build Integrity

| # | Check | PASS/FAIL/NA | Note |
|---|-------|-------------|------|
| 22 | Build compiles (`npm run build`) | | |
| 23 | Typecheck passes (`tsc --noEmit`) | | |
| 24 | Lint passes (`npm run lint`) | | |
| 25 | Tests pass (`npm test`) | | |

---

## Findings

### CRITICAL
- [List CRITICAL findings — must fix before merge]

### HIGH
- [List HIGH findings — should fix before merge]

### MEDIUM
- [List MEDIUM findings — fix in current or next cycle]

### LOW
- [List LOW findings — nice to have]

### SUGGESTION
- [List suggestions — not blocking]

---

## Verdict

```
Verdict: APPROVE / CHANGES_REQUESTED / REJECT

PASS:  [N] checks pass
WARN:  [N] warnings
FAIL:  [N] failures

Decision: MERGE / FIX_FIRST / ESCALATE
```

---

## Reviewer Notes

[Additional context, concerns, or praise for the author.]

---

## Relations

- Issue: `ISS-YYYYMMDD-NNN`
- RCA: `RCA-YYYYMMDD-NNN`
- Related reviews: [`REV-...`, `REV-...`]
