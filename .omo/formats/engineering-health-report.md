---
title: "Engineering Health Report Format Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["engineering-director"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Engineering Health Report Format

> **Purpose:** Defines the standard format for the Engineering Director's daily Engineering Health Report.

---

## Structure

```yaml
---
id: "EHR-YYYY-MM-DD"
date: "2026-07-30"
author: "engineering-director"
status: "completed"
period: "daily"                # daily | weekly | per-cycle
---
```

## Sections

### 1. Executive Summary

One-paragraph health assessment of the project.

```
Executive Summary:
The project is in STABLE condition after addressing 3 Tier 0 issues.
Technical debt is decreasing (delta: -2.3%). Module boundary discipline
is being maintained. No new architectural degradation detected.
```

### 2. Quality Metrics

| Metric | Current | Previous | Delta | Trend | Threshold |
|--------|---------|----------|-------|-------|-----------|
| Build Status | ✅ PASS | ✅ PASS | — | → | Must PASS |
| Lint Errors | 0 | 0 | 0 | → | Must be 0 |
| Type Errors | 0 | 0 | 0 | → | Must be 0 |
| Test Coverage | 23% | 0% | +23% | ↑ | Target 60% |
| Critical Issues Open | 0 | 4 | -4 | ↓ | Must be 0 |
| High Issues Open | 5 | 12 | -7 | ↓ | Target 0 |
| Medium Issues Open | 14 | 18 | -4 | ↓ | — |
| Module Size Violations | 3 | 6 | -3 | ↓ | Target 0 |
| Duplication Ratio | 2.1% | 2.1% | 0 | → | < 5% |

### 3. Technical Debt Analysis

```
Current Technical Debt:
- Estimated effort to clear: 18 story points
- Debt ratio: 8.3% (down from 10.1%)
- Highest debt area: src/lib/ (utilities need consolidation)
- New debt this cycle: 0 (all changes were debt reduction)
```

### 4. Module Health

List of modules (directories) and their health status:

```
src/app/api/           ● HEALTHY   — consistent patterns, all routes authenticated
src/app/[locale]/      ⚠️ MONITOR — component sizes growing (PhotoCard 180→215 lines)
src/lib/               ⚠️ REFACTOR — duplicated helpers across 3 files
src/components/        ● HEALTHY   — well-structured, good separation
src/hooks/             ● HEALTHY   — clean custom hooks
```

**Legend:**
- ● HEALTHY — no concerns
- ⚠️ MONITOR — watching for degradation
- ⚠️ REFACTOR — known issues, plan exists
- ❌ CRITICAL — needs immediate attention

### 5. Trend Analysis

```
Trends over the last 5 reports:
- Issues opened per cycle: 12 → 8 → 5 → 3 → 2 (decreasing)
- Issues closed per cycle: 0 → 4 → 8 → 6 → 4 (stable)
- Build failures: 0 in all cycles
- New module violations: 1 → 1 → 0 → 0 → 0 (improving)

Assessment: Quality is improving. The repair pipeline is effective.
The rate of new issues is decreasing, indicating process improvements
are preventing recurrence.
```

### 6. Risk Flag

Any new risks detected:

```
🚩 Risk: Module boundary erosion in src/components/
   Details: PhotoCard added 35 lines this sprint — approaching 250 limit
   Recommendation: Split into PhotoCard + PhotoCardActions before next sprint

🚩 Risk: Dependencies not updated in 3 weeks
   Details: 5 packages behind latest patch
   Recommendation: Run dependency update next cycle
```

### 7. Recommendations

Prioritized recommendations for the next cycle:

```
Priority 1:
- Split PhotoCard component (approaching size limit)
- Run dependency updates
- Review duplicate utility consolidation

Priority 2:
- Begin integration test coverage for auth flows
- Add Sentry error tracking

Priority 3:
- Start i18n namespace cleanup
- Performance audit for bundle size
```

### 8. Process Health

```
Process Adherence:
- Agent role boundaries respected: ✅
- Review independence maintained: ✅
- Security reviews completed for all Tier 0 issues: ✅
- RCA completed for all closed issues: 3/3 (100%)
- Quality Gates respected: ✅

Process Violations:
- None in this cycle.
```

---

## Relations

- `agents/engineering-director.md` — agent that produces this report
- `CONSTITUTION.md` — rules that the report validates against

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
