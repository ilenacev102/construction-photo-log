---
title: "Release Format Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["release-manager"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Release Format

> **Purpose:** Defines the standard format for every release produced by the Release Manager. Every release MUST have a release document in this format.

---

## Structure

```yaml
---
id: "REL-NNN"
title: "Release N — Short Description"
date: "2026-07-30"
author: "release-manager"
status: "draft"                # draft | in-progress | approved | deployed | rollback
version: "x.y.z"
---
```

## Sections

### 1. Release Summary

| Field | Value |
|-------|-------|
| **Release ID** | REL-001 |
| **Version** | 1.2.0 |
| **Date** | 2026-07-30 |
| **Type** | patch | minor | major | emergency |
| **Issues Included** | SEC-001, SEC-002, DB-001 |
| **RCAs Filed** | RCA-SEC-001, RCA-SEC-002 |

### 2. Quality Gate Status

| Gate | Status | Evidence |
|------|--------|----------|
| Gate 1 — Build | ✅ PASS | Build exit code 0 |
| Gate 2 — No Critical Secrets | ✅ PASS | Secrets scan clean |
| Gate 3 — Regression Suite | ✅ PASS | 47/47 tests passing |
| Gate 4 — Security Review | ✅ PASS | No critical findings |
| Gate 5 — Release Readiness | ✅ PASS | All checks green |
| Gate 6 — Final Inspection | ✅ PASS | Board approved |

### 3. Changes in This Release

| ID | Title | Type | Risk | RCAs |
|----|-------|------|------|------|
| SEC-001 | Remove SERVICE_ROLE_KEY from .env.local | security | Low | RCA-SEC-001 |
| SEC-002 | Fix missing access control on audit-logs | security | Medium | RCA-SEC-002 |
| DB-001 | Fix migration drift in photos table | database | Medium | TBD |

### 4. Breaking Changes

List any breaking changes, migration steps, or configuration changes.

```
Breaking Changes:
- None in this release.

Database Migrations:
- 20260730000001_fix_photos_table.sql (add user_id column, remove invalid index)

Configuration Changes:
- .env.local template updated — SERVICE_ROLE_KEY removed, ANON_KEY added
```

### 5. Rollback Plan

```
Rollback:
1. Revert the release commit: `git revert <sha>`
2. Run migration rollback: `npx supabase migration down 20260730000001`
3. Verify application starts with previous version
4. Restore old .env.local if needed

Estimated rollback time: 5 minutes
```

### 6. Deployment Checklist

- [ ] Build passes
- [ ] All migrations tested against staging
- [ ] Rollback migration tested
- [ ] Feature flags verified
- [ ] Monitoring dashboards checked
- [ ] Alerts configured for new metrics
- [ ] Release notes sent to team
- [ ] Support team notified

### 7. Monitoring Period

```
Post-deployment monitoring: 48 hours
Key metrics to watch:
- Error rate (< 0.1% increase)
- P95 latency (< 10% increase)
- Auth success rate (> 99%)
- Database connection count
```

### 8. Release Approval

| Role | Decision | Date | Signature |
|------|----------|------|-----------|
| CEO | ✅ Approved | 2026-07-30 | ceo-agent |
| Security | ✅ Approved | 2026-07-30 | security-agent |
| QA | ✅ Approved | 2026-07-30 | qa-agent |

---

## Relations

- `workflow/gates.md` — quality gates referenced in this release
- `workflow/pipeline.md` — the pipeline that produced this release
- `agents/release-manager.md` — manager responsible for releases

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
