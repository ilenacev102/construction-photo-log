---
title: "Phase 1 — Baseline Report"
type: report
phase: 1
status: complete
date: "2026-07-30"
owner: "Sisyphus"
---

# Baseline Report

> **Project:** Construction Photo Log
> **Date:** 2026-07-30
> **Owner:** Sisyphus (Phase 1)

---

## Summary

| Check | Status | Details |
|-------|--------|---------|
| Web Build (next build) | ✅ PASS | Compiled successfully, 29 pages |
| TypeScript (tsc --noEmit) | ✅ PASS | Zero errors |
| ESLint | ❌ FAIL | 38 errors, 43 warnings |
| Python Tests (pytest) | ⚠️ 1/9 FAIL | 8 pass, 1 fail (locale assertion) |
| Python Lint (ruff) | ❌ FAIL | 10 issues (6 auto-fixable) |
| Python Types (mypy) | ❌ FAIL | 5 errors (3 = missing stubs) |

**Gate 1 Verdict:** ❌ FAIL — Lint does not pass, Python tests have 1 failure, Python lint and typecheck fail.

---

## Frontend (web/)

### Build ✅

```
Next.js 16.2.11 (Turbopack)
Compiled successfully in 7.4s
✓ 29 pages generated
```

**Warnings (non-blocking):**
1. Middleware → Proxy deprecation notice
2. NFT tracing warning in route `/api/report` — dynamic import issue in `next.config.ts`

### TypeScript ✅

Zero type errors. Clean compilation.

### ESLint ❌ — 38 errors, 43 warnings

| Category | Count | Severity | Files |
|----------|-------|----------|-------|
| `set-state-in-effect` | 15 | error | hooks/: useAttendance, useDefects, useLabels, usePermissions, useSubscription; components/: AuditLogViewer, DefectBoard, PermissionEditor, RoleDashboard, DrawingCanvas; pages/: admin, schema, pricing |
| `no-explicit-any` | 16 | error | API routes: attendance, daily-logs, pins, report, schema-pins, subscriptions/webhook, team; i18n/request |
| `immutability` | 1 | error | pricing/page.tsx — window.location.href mutation |
| `no-unescaped-entities` | 2 | error | labels/page.tsx — curly quotes |
| `no-unused-vars` | 15 | warning | Various pages and components |
| `no-img-element` | 10 | warning | Various components — should use next/Image |
| `exhaustive-deps` | 3 | warning | DrawingCanvas, PhotoMap |
| `no-unused-vars` (import) | 5 | warning | API route files |

---

## Python (packages/photo-report-pdf/)

### Tests ⚠️ — 8/9 pass, 1 failure

```
FAILED test_header_text_in_pdf
  AssertionError: 'Test Report' not in PDF text
  — The PDF uses Macedonian labels (language='mk') but test expects English text
  — Root cause: test hardcodes English assertion, generator uses locale
```

### Ruff ❌ — 10 issues

| Code | Count | Severity | Fixable |
|------|-------|----------|---------|
| I001 (import sort) | 2 | style | ✅ auto-fix |
| RUF022 (__all__ sort) | 1 | style | ✅ auto-fix |
| UP045 (X | None) | 3 | style | ✅ auto-fix |
| BLE001 (blind except) | 1 | correctness | manual fix |
| SIM115 (context mgr) | 1 | style | manual fix |
| DTZ001 (naive datetime) | 2 | correctness | manual fix |

### Mypy ❌ — 5 errors

| Error | Count | Type |
|-------|-------|------|
| Missing reportlab stubs | 3 | `import-untyped` — fix: `pip install types-reportlab` |
| Generator return type | 1 | `misc` — needs `Generator` annotation |
| Document not iterable | 1 | `attr-defined` — `__enter__` vs `__iter__` |

---

## Baseline Decisions

1. **Build + TypeScript are solid** — no compilation or type issues in frontend
2. **ESLint errors are the main blocker** — set-state-in-effect is the dominant pattern violation (15 occurrences across 10 files)
3. **Python test failure is a locale issue** — not a logic bug. Test needs to either use Macedonian assertion or generator needs to support English
4. **Python lint issues are mostly auto-fixable** — 6/10 are style (import sort, type annotation syntax)
5. **Python type issues are mostly missing stubs** — 3/5 are missing reportlab stubs

---

## Relations

- Pipeline: `workflow/pipeline.md` Phase 1 → Phase 2
- Gate: `workflow/gates.md` Gate 1 — Blocking (lint fails)
- Issues to create: ESLint errors (38 errors → Tier 0/1), Python test failure (Tier 1), Python lint/style (Tier 1)
