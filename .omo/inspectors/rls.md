---
title: "RLS Inspector Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["rls-inspector"]
last_reviewed: "2026-07-30"
supersedes: []
---

# RLS Inspector

> **Purpose:** Validates Row-Level Security policies across all database tables. Ensures every table has appropriate RLS enabled and policies correctly enforce multi-tenant isolation.

---

## What It Checks

1. **RLS enabled** — Every user-table has RLS enabled (exclude system tables, migrations).
2. **RLS policies** — Every table has at least a SELECT policy for authenticated users.
3. **Policy correctness** — Policies correctly check `user_id`, `company_id`, or equivalent tenant identifier.
4. **Service-role bypass** — Any client using `service_role` key that should use `anon` key instead.
5. **Missing policies** — Tables without INSERT, UPDATE, DELETE policies (if applicable).
6. **Policy consistency** — Policies follow consistent naming and pattern.
7. **Public access** — Tables with public (unauthenticated) access that shouldn't have it.
8. **Cross-tenant leakage** — Policies that might allow users from one company to access another's data.

---

## What It Ignores

1. System tables (e.g., `_migrations`, `_prisma_migrations`).
2. Tables explicitly designated as public reference data.
3. Tables managed entirely through server-side APIs with service-role authentication (must be documented).

---

## Severity Classification

| Severity | Definition | Response |
|----------|------------|----------|
| **CRITICAL** | User table without RLS enabled | Block release, fix immediately |
| **HIGH** | Missing INSERT/UPDATE/DELETE policy for authenticated users | Fix this cycle |
| **HIGH** | Policy doesn't check tenant identifier | Fix this cycle |
| **MEDIUM** | Inconsistent policy naming or pattern | Fix next cycle |
| **LOW** | Policy allows more access than necessary (e.g., all users can read all rows) | Review and tighten |

---

## Failure Conditions

**FAIL** if:
- Any user table without RLS enabled
- Service-role bypass on tables that should use anon key
- Policy missing tenant isolation check

**WARNING** if:
- Missing specific operation policies (INSERT/UPDATE/DELETE)
- Inconsistent patterns
- Overly permissive policies

**PASS** if:
- All user tables have RLS enabled
- All policies check tenant isolation
- All CRUD operations have appropriate policies
- No unnecessary service-role bypass

---

## Output

```yaml
findings:
  - severity: "critical"
    table: "photos"
    issue: "RLS is enabled but all queries use service_role key — RLS is effectively bypassed"
    recommendation: "Switch to anon key for client operations, keep service_role for server-only admin"
  - severity: "high"
    table: "audit_logs"
    issue: "No UPDATE policy — but no UPDATE policy needed for append-only table"
    recommendation: "Add policy COMMENT for clarity: 'audit_logs is append-only, UPDATE not applicable'"
summary:
  critical: 1
  high: 2
  medium: 3
  low: 1
  verdict: "FAIL"
```

---

## Relations

- `agents/security.md` — findings feed into Security review
- `CONSTITUTION.md` — Section 4.4 (Authentication & Authorization)
- `workflow/gates.md` — validates Gate 4 (Security Review)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
