---
title: "Permission Matrix Inspector Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["permission-matrix-inspector"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Permission Matrix Inspector

> **Purpose:** Audits the complete permission and role model. Ensures every API endpoint, UI route, and data operation has correct authorization guards consistent with the defined role matrix.

---

## What It Checks

1. **Role definition** — Are user roles clearly defined (admin, manager, worker, viewer)?
2. **Permission mapping** — Does every role have a documented set of permitted operations?
3. **API guard consistency** — Do all API endpoints check permissions before returning data?
4. **Route protection** — Are all frontend routes protected by authorization checks?
5. **UI element visibility** — Do UI elements hide/show correctly based on user role?
6. **Data scoping** — Can users of one company see data from another company?
7. **Ownership checks** — Can a user modify data they don't own?
8. **Admin escalation** — Are admin-only operations properly protected?

---

## What It Ignores

1. Authentication (auth is verified by Security agent) — this assumes auth is working.
2. Database-level RLS (verified by RLS Inspector).

---

## Severity Classification

| Severity | Definition | Response |
|----------|------------|----------|
| **CRITICAL** | Unauthenticated user can access admin-only endpoint | Block release, fix immediately |
| **HIGH** | Regular user can access another company's data | Fix this cycle |
| **MEDIUM** | Missing permission check on non-critical endpoint | Fix next cycle |
| **LOW** | UI element visible but operation correctly blocked at API | Fix when convenient |

---

## Failure Conditions

**FAIL** if:
- Any endpoint accessible without correct role
- Cross-company data access possible
- Admin operations accessible to non-admin roles

**WARNING** if:
- UI shows actions user cannot perform
- Inconsistent permission pattern across similar endpoints

**PASS** if:
- All role-gated endpoints check correctly
- Company isolation is maintained
- Admin operations are admin-only

---

## Relations

- `agents/security.md` — permissions are a security concern
- `CONSTITUTION.md` — Section 4.4 (Authentication & Authorization)
- `inspectors/rls.md` — complementary RLS check

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
