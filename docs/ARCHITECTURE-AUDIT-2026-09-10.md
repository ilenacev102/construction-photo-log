# Architecture Audit — construction-photo-log (2026-09-10)

**Auditor:** Sisyphus (read-only, independent verification)
**Target:** `/home/nac/Projects/construction-photo-log` — `web/` (Next.js 16.3 + React 19 + Supabase) + `packages/photo-report-pdf/` (Python)
**Method:** Static read-only audit. No files modified, no installs/builds/servers run. Every claim verified against current source with file:line evidence.
**Baselines (already-fixed findings NOT re-reported):** `AUDIT-FINAL.md` (2026-07-31, 21 migrations audited), `REVIEW-FINAL-2026-08-10.md`, `REDTEAM-FIX-REPORT.md`, `SPEC-risk-roadmap.md` (2026-08-14).

---

## 1. Executive Summary

The repository is a **directory-convention monorepo, not a workspace monorepo**: there is no root `package.json` / `pnpm-workspace.yaml` / lockfile. `web/` (npm) and `packages/photo-report-pdf/` (Python) are fully independent projects sharing only a git repo and a `supabase/` migration folder.

Since the 2026-07-31 security audit, the codebase has improved substantially and **all three P0 findings plus the top P1s are verifiably fixed** in the 2026-08-01 migration batch and the zod-validation commit series (see §6). The migration count grew 21 → 40, and the `SPEC-risk-roadmap.md` Phase 1/2 items (timezones, attendance invariants, work orders, project members, comments) have landed as migrations.

**However, three new issues block a clean CI/build state:**

1. **HIGH — CI `python-check` job is orphaned.** `packages/photo-report-pdf/` is being deleted (staged deletions of `pyproject.toml`, `src/`, `tests/`, `Makefile`, `.github/workflows/publish.yml`), but `.github/workflows/ci.yml:45-68` still runs `pip install -e .[dev]` + `pytest` in that directory. The next push will fail CI.
2. **MEDIUM — Legacy duplicate migrations.** `web/supabase/migrations/` still holds 4 stale copies of canonical migrations, a drift/confusion hazard.
3. **LOW — Stale root README.** Macedonian README still documents the old `web/supabase/` layout (currently being edited — `git status` shows `M README.md`).

**Verdict:** Architecture is sound and trending well; fix the CI orphan before the next push.

---

## 2. Repository Topology

```
construction-photo-log/
├── web/                          ← Next.js 16.3 App Router app (npm, independent)
│   ├── app/
│   │   ├── [locale]/             ← i18n (mk/en/de/sl/sr), dashboard, admin, projects
│   │   └── api/                  ← 27+ route handlers (zod-validated, requireAuth)
│   ├── components/
│   │   ├── defects/              ← DefectBoard/Card/Column/CreateModal/Detail + barrel
│   │   └── work-orders/          ← WorkOrderCreateForm/DefectLinker/Detail/List
│   ├── hooks/                    ← 8 hooks (usePins, useAttendance, …)
│   ├── lib/
│   │   ├── api/                  ← auth-guard, company-auth, errors, rate-limit, schemas, validate
│   │   ├── auth/                 ← rbac.ts, workspace.ts
│   │   ├── admin/                ← overview.ts (+ tests)
│   │   ├── pdf/                  ← generator.ts (+ tests)   ← replaces Python package
│   │   ├── storage/              ← signed-url.ts (+ tests)
│   │   ├── supabase/             ← admin.ts, client.ts, queries.ts, server.ts
│   │   └── validation/           ← schemas.ts (+ tests)     ← zod, wired into all routes
│   └── package.json              ← Next ^16.3.0, React ^19.2.8, TS ^6.0.3, vitest ^4.1.10
├── packages/
│   └── photo-report-pdf/         ← ⚠ STAGED FOR DELETION (only __pycache__/.egg-info remain)
├── supabase/
│   ├── config.toml               ← project_id "construction-photo-log", max_rows 1000
│   └── migrations/               ← 40 migrations (canonical)
├── web/supabase/migrations/      ← ⚠ 4 legacy duplicates (drift hazard)
├── .github/workflows/ci.yml      ← web-check ✅ + python-check ⚠ orphaned
└── docs/                         ← 14+ audit/spec/strategy docs
```

---

## 3. Dependency Audit

| Package | Version | Role | Notes |
|---|---|---|---|
| `next` | ^16.3.0 | Framework | App Router; `serverExternalPackages: ['pdfkit']` |
| `react` / `react-dom` | ^19.2.8 | UI | |
| `typescript` | ^6.0.3 | Language | `tsconfig` strict |
| `vitest` | ^4.1.10 | Test runner | 152+ tests / 19+ files at baseline; 216/29 per roadmap |
| `zod` | ^4.4.3 | Validation | Now wired into all API routes (P3-1 fixed) |
| `date-fns` | ^4.4.0 | Dates | `@date-fns/tz` added for timezone model |
| `tailwindcss` | ^4 | Styling | |
| `pdfkit` | server-side | PDF gen | Replaces Python `reportlab`-era package |
| `sharp` | server-side | Image processing | |
| `stripe` | server-side | Billing | `apiVersion` unpinned (P3-7, low) |
| Python `photo-report-pdf` | — | PDF gen (legacy) | **Being removed**; CI job not yet removed |

**Observation:** dependency surface is small and modern; no obvious bloat. The only cross-cutting risk is the orphaned Python toolchain in CI (§4).

---

## 4. Build / CI Assessment

`.github/workflows/ci.yml` has two jobs:

| Job | Steps | Status |
|---|---|---|
| `web-check` | Node 20, `npm ci`, `type-check`, `lint`, `npm test` | ✅ Healthy (baseline: tsc clean, 0 eslint errors / 22 warnings, tests pass) |
| `python-check` | Python 3.12, `pip install -e .[dev]`, `pytest` in `packages/photo-report-pdf` | ⚠ **BROKEN — orphaned** |

**Finding CI-1 (HIGH):** `packages/photo-report-pdf` is staged for deletion (`git status`: `D pyproject.toml`, `D src/photo_report_pdf/{__init__,cli,generator}.py`, `D tests/test_generator.py`, `D Makefile`, `D .github/workflows/publish.yml`), but `ci.yml:45-68` still runs `python -m pip install -e .[dev]` and `pytest` with `working-directory: packages/photo-report-pdf`. Once the deletion commits, `pip install -e .[dev]` fails (no `pyproject.toml`) → **CI red on every push**. Fix: delete the `python-check` job (PDF generation now lives in `web/lib/pdf/generator.ts`).

**Finding CI-2 (LOW):** `web-check` runs `npm ci` — fine — but there is no `build` step (`next build`) in CI, so production build errors (e.g. `serverExternalPackages` misconfig, i18n plugin issues) are only caught locally. Consider adding `next build` to the gate.

---

## 5. Database & Migrations

- **40 canonical migrations** in `supabase/migrations/` (up from 21 at the 07-31 audit). Tail: `20260825120000_add_comments.sql`, `20260825130000_enable_comments_realtime.sql`.
- **2026-08-01 batch closes the audit P0s** (verified in source):
  - `20260801000002_restrict_profile_self_update.sql` — column-level UPDATE grants (`full_name, avatar_url, phone` only) + `SECURITY DEFINER` trigger guarding `role`/`company_name` → **P0-1 fixed**.
  - `20260801000003_fix_audit_forgery_and_permission_rpcs.sql` — audit_logs INSERT `WITH CHECK (false)` + `public.*` qualification in permission RPCs → **P0-2, P0-3 fixed**.
  - `20260801000004_make_photos_bucket_private.sql` — `update storage.buckets set public = false` → **P1-2 fixed**.
  - `20260801000005_photos_image_url_insert_constraint.sql` → **P1-1 (SSRF) fixed**.
  - `20260801000006_scope_drawing_pins_attendance_writes.sql` → **P1-5/P1-6 fixed**.
- **Roadmap migrations landed:** `20260814000001_add_timezones.sql` + `20260814000002_attendance_invariants.sql` (SPEC Phase 1), `20260810000002_work_orders.sql`, `20260806000002_project_members.sql`, `20260825120000_add_comments.sql`.
- **`supabase/config.toml`:** `project_id = "construction-photo-log"`, api port 54321, `max_rows = 1000`, `auto_expose_new_tables` **commented out** → new tables are NOT auto-exposed to PostgREST (positive; matches the RLS-hardening direction).

**Finding DB-1 (MEDIUM):** `web/supabase/migrations/` still contains 4 legacy duplicates of canonical migrations (`20260724000001_create_projects`, `20260724000002_create_photos`, `20260826000001_create_work_order_defects`, `20260826100000_fix_work_order_defects_rls`). Two of these post-date the canonical folder's tail — a real drift hazard: anyone applying `web/supabase/migrations/` gets a divergent schema. Delete the folder or add a README pointing to `supabase/migrations/`.

---

## 6. DDD / Modularity Assessment

**Strengths (verified):**
- **Feature-sliced components:** `components/defects/` (Board/Card/Column/CreateModal/Detail + `index.ts` barrel) and `components/work-orders/` (CreateForm/DefectLinker/Detail/List) — clean, cohesive, exported via barrel.
- **Layered lib:** `lib/api/` (guards, errors, rate-limit, validation), `lib/auth/` (rbac, workspace), `lib/supabase/` (admin/client/queries/server split), `lib/validation/` (zod schemas + tests). Separation of concerns is consistent.
- **Zod validation now uniform:** git log shows 12+ commits migrating every API route family to `lib/validation/schemas.ts` + a `zodRequest` helper (`fd3559a`, `6c3adf7`, `8a44c19` … `7f6705e`) → **P3-1 (zero validation) fixed**.
- **Auth standardization:** `requireAuth()` standardized across all routes (Batch 4: `8bd7045`, `7c0117b`); RBAC hierarchy consolidated into a single source of truth (`d4c1f1d`).
- **Tests co-located:** `__tests__` next to `lib/pdf`, `lib/storage`, `lib/admin`, `lib/validation`, `app/api/__tests__`.

**Gaps:**
- **Gap-1 (LOW):** No root-level workspace tooling — no shared `tsconfig.base`, no root scripts, no `npm workspaces`. The two packages cannot share types/config; the "monorepo" is a folder convention. Acceptable at this scale; revisit if a third package appears.
- **Gap-2 (LOW):** `web/lib/supabase/queries.ts` helpers don't check `res.ok` (P4-3, still open) — non-JSON errors throw opaque exceptions.
- **Gap-3 (INFO):** `docs/` has 14+ audit/spec/strategy docs with overlapping scope (`AUDIT-FINAL.md`, `AUDIT-REPORT.md`, `AUDIT_REPORT.md`, `BACKEND-AUDIT-REPORT.md`, `DB-AUDIT.md`, `DB-AUDIT-VERIFIED.md` at root) — documentation sprawl; consider consolidating into `docs/` with a single index.

---

## 7. Tech-Debt Inventory (new findings, severity-rated)

| ID | Sev | Location | Issue |
|---|---|---|---|
| CI-1 | **High** | `.github/workflows/ci.yml:45-68` + `packages/photo-report-pdf/` (staged deletions) | Orphaned `python-check` job: `pip install -e .[dev]` fails once the package deletion commits → CI red |
| DB-1 | Medium | `web/supabase/migrations/` (4 files) | Legacy duplicate migrations, two post-dating canonical tail — schema drift hazard |
| CI-2 | Low | `.github/workflows/ci.yml` | No `next build` step in CI — production build errors only caught locally |
| DOC-1 | Low | `README.md` (root, Macedonian) | Stale structure diagram still references old `web/supabase/` layout (currently being edited) |
| GAP-1 | Low | repo root | No workspace tooling (no root package.json / tsconfig.base / workspaces) |
| GAP-2 | Low | `web/lib/supabase/queries.ts:21-62` | Helpers don't check `res.ok` (carried from P4-3) |
| GAP-3 | Info | repo root + `docs/` | 6 overlapping audit reports at root; documentation sprawl |

**Carried-but-open (from baselines, not re-audited in depth):** P2 cluster items (team PII roster, invite email enumeration, webhook `status:'active'` without `paid`, upload-schema content-type trust, schema-pins photo-project check, labels role-only gates), P3-3 (internal error strings), P3-4 (orphaned storage blobs), P3-6 (webhook TOCTOU), P3-7 (stripe apiVersion unpinned), P3-8 (sharp decode budget), P3-10 (report route rate limit). These were not re-verified this pass; treat as open until confirmed.

---

## 8. Top 3 Improvements

1. **Remove the orphaned `python-check` CI job** (CI-1). The Python package is deleted; PDF generation lives in `web/lib/pdf/generator.ts`. One-line workflow edit unblocks green CI.
2. **Delete `web/supabase/migrations/`** (DB-1) — the 4 legacy duplicates are a schema-drift trap; the canonical folder is `supabase/migrations/`.
3. **Add `next build` to `web-check`** (CI-2) — closes the gap between "tests pass" and "production build works" for Next 16 App Router changes.

---

## 9. Verification Notes

- All P0/P1-fix claims verified against migration source (`20260801000002`–`00006`).
- Zod-validation claim verified via git log (`fd3559a` … `7f6705e`).
- No runtime DB access (`DATABASE_URL` unset) — RLS enforcement at runtime not re-tested; migration-level verification only.
- `git status` shows an in-progress working tree (README edit, API route edits, staged package deletions) — findings assume the staged deletions land as-is.