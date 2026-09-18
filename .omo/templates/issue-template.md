<!--
TEMPLATE: Issue Document
PURPOSE: Each issue tracks a single atomic problem from discovery to closure
USAGE: Created by Issue Splitter, consumed by Repair Agent, Reviewer, QA, CEO
-->

# Issue: [Short Descriptive Title]

**Issue ID:** `ISS-YYYYMMDD-NNN`
**Source:** [Audit finding / Inspector report / Manual discovery]
**Tier:** [0 / 1 / 2]
**Status:** `open | in_progress | review | qa | ceo_approval | closed` (select one)
**Assigned To:** [Agent name]
**Created:** [YYYY-MM-DD]

---

## Description

[Concise description of the issue — what, where, why it matters. 2-4 sentences.]

---

## Location

- **File(s):** `path/to/file.ts` (line 42-57)
- **Component:** [Component name if frontend]
- **Endpoint:** [Route if backend]

---

## Severity

| Dimension | Value | Rationale |
|-----------|-------|-----------|
| Impact | `critical / high / medium / low` | What breaks if this is not fixed |
| Likelihood | `certain / likely / possible / rare` | How likely is this to cause a real issue |
| Priority | `P0 / P1 / P2 / P3` | Computed from Impact × Likelihood |

---

## Expected Behavior

[What should happen after the fix. Concrete, verifiable. Write in present tense.]

---

## Actual Behavior

[What currently happens. Include error messages, screenshots, logs — any evidence.]

---

## Reproduction Steps

1. Step one
2. Step two
3. ...

*(Omit if not applicable — e.g. code cleanliness issues)*

---

## Acceptance Criteria

- [ ] Criterion 1 — specific, verifiable
- [ ] Criterion 2 — specific, verifiable
- [ ] All existing tests still pass
- [ ] No new lint/type errors introduced

---

## RCA Reference

**RCA ID:** `RCA-YYYYMMDD-NNN`
**Root Cause Category:** `logic | auth | config | validation | race | memory | performance | design | unknown`
**Preventive Action:** [Brief description]

---

## Review Verdict

**Reviewer:** [Agent name]
**Verdict:** `approve | changes_requested | reject` (select one)
- **PASS:** [N] checks pass, [N] warning(s)
- **FAIL:** [N] issue(s) — [list briefly]

**Decision:** `merge | fix_first | escalate` (select one)

---

## Security Verdict (if applicable)

**Security Reviewer:** [Agent name]
**Verdict:** `pass | fail`
**Findings:** [None / list]

---

## QA Verdict

**QA Agent:** [Agent name]
**Verdict:** `pass | fail`
**Evidence:** [Build output, test output, smoke test result]

---

## CEO Decision

**Date:** [YYYY-MM-DD]
**Decision:** `approve | reject | defer | reassign`

**Rationale:** [Why this decision was made]

---

## Closure Notes

**Merged:** [YYYY-MM-DD]
**Commit:** `[commit hash]`
**Closing RCA:** `RCA-YYYYMMDD-NNN`
**Time to Close:** [N] days

---

## Relations

- Blocks: `ISS-...` (if this blocks another issue)
- Blocked by: `ISS-...` (if this is blocked by another issue)
- Related RCA: `RCA-...`
- Related Review: `REV-...`
