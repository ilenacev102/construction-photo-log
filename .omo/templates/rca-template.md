<!--
TEMPLATE: Root Cause Analysis Document
PURPOSE: Every merged issue must have an RCA. This prevents repeated failures.
USAGE: Created by RCA Agent after merge, reviewed by Engineering Director
-->

# Root Cause Analysis: [Issue Title]

**RCA ID:** `RCA-YYYYMMDD-NNN`
**Issue ID:** `ISS-YYYYMMDD-NNN`
**Author:** [RCA Agent name]
**Date:** [YYYY-MM-DD]

---

## Summary

[1-2 sentences summarizing the issue and its root cause.]

**Root Cause Category:** `logic | auth | config | validation | race | memory | performance | design | unknown | process`

---

## 5 Whys Analysis

| Why # | Question | Answer |
|-------|----------|--------|
| 1 | Why did [symptom] happen? | [Direct cause] |
| 2 | Why did [cause 1] happen? | [Underlying cause] |
| 3 | Why did [cause 2] happen? | [Deeper cause] |
| 4 | Why did [cause 3] happen? | [Systemic cause] |
| 5 | Why did [cause 4] happen? | **Root cause** |

---

## Root Cause Statement

[Single sentence identifying the fundamental reason the issue occurred.]

---

## Contributing Factors

- [Factor 1]
- [Factor 2]
- ...

---

## Fix Analysis

**What was done:** [Brief description of the fix]

**Was this a fix of:** `symptom | cause | both` (select one)

**Could the fix have been predicted?** `yes | no` — [Rationale]

---

## Preventive Actions

| # | Action | Owner | Deadline |
|---|--------|-------|----------|
| 1 | [Action to prevent recurrence] | [Agent] | [YYYY-MM-DD] |
| 2 | [Action to detect similar issues earlier] | [Agent] | [YYYY-MM-DD] |

---

## Detection Gap

**How was this discovered?** `audit | inspector | production_incident | manual_testing | customer_report`

**Should this have been caught earlier?** `yes | no`

**If yes, where:** [Which gate, inspector, or test should have caught it]

---

## Lessons Learned

[What the team should learn from this issue. Keep factual, no blame.]

---

## Engineering Director Notes

[Optional: ED's analysis of trends, patterns, systemic risks]

---

## Relations

- Issue: `ISS-YYYYMMDD-NNN`
- Review: `REV-YYYYMMDD-NNN`
- Related issues: [`ISS-...`, `ISS-...`]
- Preventive action tickets: [`ISS-...`, `ISS-...`]
