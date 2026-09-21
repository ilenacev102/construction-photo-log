---
title: "Schema Drift Inspector Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["schema-drift-inspector"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Schema Drift Inspector

> **Purpose:** Detects differences between database migration files, ORM models, and the actual database schema. Prevents deployment failures caused by migration drift.

---

## What It Checks

1. **Migration vs. database** — Compare migration files to actual database schema (if database is accessible).
2. **Migration vs. migration** — Check for duplicate migration IDs, out-of-order migrations, or missing migrations.
3. **Migration vs. ORM models** — Compare database schema to TypeScript types, Prisma/SchemaQL models, or Drizzle definitions.
4. **Missing columns** — Columns referenced in code but not in migrations.
5. **Orphaned indexes** — Indexes that reference non-existent columns.
6. **Duplicate migrations** — Migration files in multiple directories (e.g., `supabase/migrations/` and `web/supabase/migrations/`).
7. **Migration naming** — Check for consistent timestamp-based or sequential naming.
8. **Down migrations** — Verify each migration has a rollback.

---

## What It Ignores

1. Auto-generated migration files from ORM tools (must still be in correct directory).
2. Seed data migrations (must be explicitly tagged).

---

## Severity Classification

| Severity | Definition | Response |
|----------|------------|----------|
| **CRITICAL** | Migration references non-existent column/index — would crash on deploy | Block release, fix immediately |
| **DUPLICATE** | Migration files in multiple directories — deployment chaos | Fix before next deploy |
| **HIGH** | Column in code but not in migration | Fix this cycle |
| **MEDIUM** | Missing down migration, inconsistent naming | Fix next cycle |
| **LOW** | Stylistic inconsistencies in migration files | Backlog |

---

## Failure Conditions

**FAIL** if:
- Any CRITICAL finding (would crash deployment)
- Any DUPLICATE migration directory
- Migration-to-code drift for actively used columns

**WARNING** if:
- Missing down migrations
- Inconsistent naming
- Orphaned indexes (no crash risk, but cleanup needed)

**PASS** if:
- No CRITICAL findings
- No DUPLICATE findings
- All migrations are in one directory

---

## Output

```yaml
findings:
  - severity: "critical"
    detail: "Migration 20260725000011 references idx_photos_user_id but photos.user_id column does not exist"
    files:
      - "supabase/migrations/20260725000011_add_indexes.sql"
      - "supabase/migrations/schema.sql"
    recommendation: "Add user_id column to photos table or remove the index reference"
  - severity: "duplicate"
    detail: "Migration directories found in both supabase/migrations/ and web/supabase/migrations/"
    directories:
      - "supabase/migrations/"
      - "web/supabase/migrations/"
    recommendation: "Consolidate to single migration directory"
summary:
  critical: 1
  duplicate: 1
  high: 0
  medium: 2
  low: 3
  verdict: "FAIL"
```

---

## Relations

- `workflow/gates.md` — validates Gate 5 (Release Readiness)
- `agents/architect.md` — reports schema issues to Architect
- `agents/release-manager.md` — critical for release planning

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
