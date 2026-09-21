---
title: "State Management Inspector Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["state-management-inspector"]
last_reviewed: "2026-07-30"
supersedes: []
---

# State Management Inspector

> **Purpose:** Analyzes frontend state management for consistency, unnecessary re-renders, stale state, and anti-patterns. Detects React-specific issues like missing keys, unnecessary useEffect dependencies, and redundant state.

---

## What It Checks

1. **State consistency** — Is the same data stored in multiple places? Can it become inconsistent?
2. **Unnecessary re-renders** — Components re-rendering when props haven't changed.
3. **Missing React.memo** — Pure components that re-render on every parent update.
4. **Missing useMemo/useCallback** — Expensive computations or callbacks recreated on every render.
5. **useEffect dependency arrays** — Missing, incorrect, or stale dependencies.
6. **Stale closures** — Callbacks referencing stale state or props.
7. **Context fragmentation** — Too many separate contexts causing unnecessary re-renders.
8. **State lifting** — State lifted too high (cascading re-renders) or too low (duplicated state).
9. **Key reconciliation** — Missing or incorrect React keys in lists.

---

## What It Ignores

1. Third-party state management libraries (Redux, Zustand) — covered by pattern analysis.
2. Server state (React Query, SWR) — covered by cache consistency analysis.

---

## Severity Classification

| Severity | Definition | Response |
|----------|------------|----------|
| **HIGH** | Stale state causes incorrect UI | Fix immediately |
| **HIGH** | Infinite re-render loop | Fix immediately |
| **MEDIUM** | Unnecessary re-renders affecting performance | Fix next cycle |
| **MEDIUM** | Missing keys causing incorrect reconciliation | Fix next cycle |
| **LOW** | Missing React.memo on obviously pure components | Fix when convenient |

---

## Failure Conditions

**FAIL** if:
- State inconsistency that could show wrong data
- Infinite re-render loop
- Stale closure causing incorrect behavior

**WARNING** if:
- Missing memo/useMemo on obvious candidates
- Missing keys in stable lists
- useEffect with stale deps

**PASS** if:
- No state inconsistency
- No infinite re-renders
- Keys present on all lists
- Effect deps are correct

---

## Relations

- `agents/engineering-director.md` — feeds into Engineering Health Report
- `CONSTITUTION.md` — Section 2 (Coding Standards)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
