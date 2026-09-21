# 🔍 Comprehensive Audit Report: Construction Photo Log

**Date:** July 2026  
**Application:** Next.js 16 + Supabase + next-intl i18n + Python PDF  
**Repository:** `/home/nac/Projects/construction-photo-log`

---

## Executive Summary

A comprehensive 5-dimensional audit was performed across **Security**, **Architecture & Code Quality**, **Frontend/UI/UX/SEO**, **Database & Backend**, and **DevOps/Testing/Deployment**. The application is a **feature-rich prototype** with serious structural, security, and operational gaps that must be addressed before production deployment.

### Overall Scores by Dimension

| Dimension | Score | Verdict |
|-----------|-------|---------|
| **Security** | 3/10 | 4 critical, 9 high — service key leaked, no auth on key endpoints |
| **Architecture** | 4/10 | God route (948 lines), no tests, inconsistent data access |
| **Frontend/UX/SEO** | 4/10 | i18n broken, no SEO, accessibility violations |
| **Database/Backend** | 4/10 | Schema drift, no pagination, RLS bypassed by design |
| **DevOps/Testing** | 2/10 | Zero frontend tests, no CI/CD, no Docker, no monitoring |
| **OVERALL** | **3.4/10** | **Critical remediation required before production** |

---

## 🔴 CRITICAL FINDINGS (Fix Immediately — Production Blockers)

| # | Dimension | Issue | File(s) | Impact |
|---|-----------|-------|---------|--------|
| **C1** | Security | **Service role key leaked** in `.env.local` | `web/.env.local:3` | Complete DB compromise |
| **C2** | Security | **No auth on `deleteProject`** | `db/route.ts:262-268` | Any user can delete any project |
| **C3** | Security | **No auth on `updateUserRole`** — privilege escalation | `db/route.ts:664-675` | Any user can become admin |
| **C4** | Security | **No auth on `updateUserPermission`** | `db/route.ts:734-749` | Any user can grant any permission |
| **C5** | DB | **`photos.user_id` column missing** in migrations | `20260724000002_create_photos.sql` | Fresh deploy crashes on first photo insert |
| **C6** | DB | **`profiles.email` column missing** | `20260725000004_create_user_profiles.sql` | Invite flow broken |
| **C7** | DevOps | **Zero frontend tests** | Entire `web/` app | No regression safety net |
| **C8** | DevOps | **No CI/CD for web app** | `web/` (Python has CI, web does not) | No automated quality gates |
| **C9** | DevOps | **Hardcoded Python path** in report route | `report/route.ts:50` | Breaks on any other machine |
| **C10** | Architecture | **God route: 948-line single API handler** | `db/route.ts` | Untestable, unmaintainable |

---

## 🟠 HIGH SEVERITY FINDINGS (Fix This Sprint)

### Security
| # | Issue | File | Fix |
|---|-------|------|-----|
| H1 | No auth on `getAllProfiles` | `db/route.ts:654-661` | Add admin role check |
| H2 | No auth on `getSubscriptions` | `db/route.ts:645-651` | Add admin role check |
| H3 | Mass assignment in `createDailyLog` | `db/route.ts:340-352` | Whitelist fields |
| H4 | Mass assignment in `updateDailyLog` | `db/route.ts:354-367` | Whitelist fields |
| H5 | Conditional auth in `createDailyLog` | `db/route.ts:343-344` | Make project_id required |
| H6 | Auth bypass in `getProject` (no company = see all) | `db/route.ts:238-245` | Always check ownership |
| H7 | No CSRF on any endpoint | All API routes | Add Origin/Referer validation |
| H8 | Open redirect in auth callback | `auth/callback/route.ts:9` | Validate `next` parameter |
| H9 | No rate limiting | All API routes | Implement per-IP throttling |

### Architecture
| # | Issue | File | Fix |
|---|-------|------|-----|
| H10 | RLS completely bypassed (service_role everywhere) | `admin.ts`, `db/route.ts` | Use anon key + RLS for user ops |
| H11 | Inconsistent data access — 2 paths to same data | `useDefects.ts`, `usePins.ts`, `useAttendance.ts` | Unify through single service layer |
| H12 | Duplicated `callApi` in 7+ files | Multiple files | Consolidate into `lib/supabase/api-client.ts` |
| H13 | Memory leaks in 4/6 hooks | `useRole.ts`, `useDefects.ts`, `usePins.ts`, `useTrades.ts` | Add cleanup to useEffect |
| H14 | Synchronous PDF generation blocks server | `report/route.ts:50` | Use async exec |
| H15 | Stale closures in useDefects/useAttendance | `useDefects.ts:77`, `useAttendance.ts:71-88` | Fix dependency arrays |
| H16 | Mixed i18n — hardcoded Macedonian in 9+ components | `PhotoCard.tsx`, `PhotoMap.tsx`, `DailyLogForm.tsx`, etc. | Extract all strings to translation files |
| H17 | No request timeout/AbortController | All fetch calls | Add timeout handling |

### Frontend/UX
| # | Issue | File | Fix |
|---|-------|------|-----|
| H18 | No sitemap.xml, robots.txt, Open Graph | `public/`, `layout.tsx` | Add SEO infrastructure |
| H19 | Root layout hardcodes `lang="mk"` for ALL locales | `layout.tsx:21` | Dynamic lang attribute |
| H20 | Missing focus traps in all modals | `DefectBoard.tsx`, `PermissionEditor.tsx`, schema page | Implement focus trapping |
| H21 | Keyboard navigation broken in tables/cards | `DefectBoard.tsx:167-237`, `AuditLogViewer.tsx:139-140` | Add role, tabindex, key handlers |
| H22 | Missing `loading="lazy"` on all photos | `PhotoCard.tsx:28-33`, all img tags | Add lazy loading |
| H23 | No error.tsx/loading.tsx in locale routes | Missing `[locale]/error.tsx`, `[locale]/loading.tsx` | Add per-locale error/loading UI |
| H24 | No multiple file upload support | `PhotoUpload.tsx:89` | Add `multiple` attribute |

### Database
| # | Issue | File | Fix |
|---|-------|------|-----|
| H25 | Duplicate migration directories | `supabase/migrations/` (16) vs `web/supabase/migrations/` (2) | Consolidate to one location |
| H26 | No pagination on any list endpoint | `db/route.ts:286-293`, `380-395`, `602-619` | Add `.range()` with sensible limits |
| H27 | ILIKE with leading wildcard for permissions | `db/route.ts:199-207` | Use proper project_permissions table |
| H28 | Missing ON DELETE CASCADE on 4 FK columns | `daily_logs`, `attendance`, `defects`, `pins` | Add cascade deletes |

### DevOps
| # | Issue | File | Fix |
|---|-------|------|-----|
| H29 | No Docker configuration | Entire repo | Add Dockerfile + docker-compose |
| H30 | No monitoring/error tracking | Entire app | Add Sentry + structured logging |
| H31 | No environment separation (staging/prod) | `.env.local` | Create separate Supabase projects |
| H32 | No caching strategy | Entire app | Add SWR/stale-while-revalidate |
| H33 | No health check endpoints | Missing `/_health` | Add health check route |
| H34 | No pre-commit hooks | Missing `.husky/` | Add husky + lint-staged |

---

## 🟡 MEDIUM SEVERITY FINDINGS (Fix This Month)

### Security
| # | Issue | File |
|---|-------|------|
| M1 | Stored XSS via `dangerouslySetInnerHTML` in blog | `blog/[slug]/page.tsx:84` |
| M2 | No file type/size validation on uploads | `upload/route.ts`, `upload-schema/route.ts` |
| M3 | Upload endpoints bypass project access checks | `upload/route.ts`, `upload-schema/route.ts` |
| M4 | No security headers (CSP, HSTS, XFO) | Entire app — `next.config.ts` |
| M5 | `useDefects` calls Supabase directly (bypasses proxy) | `useDefects.ts:17-33` |
| M6 | No auth on `getAuditLogs` | `db/route.ts:562-579` |
| M7 | Weak password policy (min 6 chars, no complexity) | `config.toml:182,185` |

### Architecture
| # | Issue | File |
|---|-------|------|
| M8 | Flat component folder — no domain organization | `components/` (22 files) |
| M9 | `as` type casts throughout (defeats strict mode) | 15+ files |
| M10 | Empty dependency arrays in useCallback/useEffect | 4 files |
| M11 | No pagination on photo/defect/attendance list | 4 endpoints in `db/route.ts` |
| M12 | SchemaPage is 619-line monolith | `schema/page.tsx` |
| M13 | Dashboard double-fetch pattern | `dashboard/page.tsx` + `RoleDashboard.tsx` |
| M14 | Profile hooks fetch profile twice on dashboard | `dashboard/page.tsx:16`, `RoleDashboard.tsx:91` |

### Frontend/UX
| # | Issue | File |
|---|-------|------|
| M15 | No skip-to-content navigation link | `Navbar.tsx`, `dashboard/layout.tsx` |
| M16 | No dark mode toggle (CSS exists) | `globals.css:86-118` (unreachable) |
| M17 | PhotoLightbox body scroll restoration bug | `PhotoLightbox.tsx:75-79` |
| M18 | LanguageSwitcher rendered twice on dashboard | `dashboard/layout.tsx:25` + `Navbar.tsx:69` |
| M19 | Inconsistent focus-visible indicators | Multiple components |
| M20 | No Next/Image optimization | All img tags |
| M21 | Focus management gaps in PhotoLightbox | `PhotoLightbox.tsx:54-72` |
| M22 | PhotoUpload doesn't revoke ObjectURLs | `PhotoUpload.tsx:28` |
| M23 | Small touch targets (< 24x24px) | Multiple components |
| M24 | No aria-describedby on form inputs | `AuthForm.tsx`, `DailyLogForm.tsx` |
| M25 | No bottom navigation for mobile | `Navbar.tsx` |
| M26 | Missing aria-live regions for dynamic content | All components |
| M27 | No structured data/JSON-LD | All pages |
| M28 | No hreflang/canonical for multi-locale | Missing from all layouts |
| M29 | RoleDashboard fetches everything for every role | `RoleDashboard.tsx:109-128` |
| M30 | DrawingCanvas `preserveAspectRatio="none"` | `DrawingCanvas.tsx:212` |
| M31 | Overuse of 'use client' | Most pages |
| M32 | No skeleton screens — only spinner pattern | All pages |

### Database
| # | Issue | File |
|---|-------|------|
| M33 | Service_role used for all user-facing ops | `admin.ts`, all API routes |
| M34 | N+1 query in `getProjectTeam` | `db/route.ts:751-766` |
| M35 | Missing CHECK constraints on 6+ columns | Various migrations |
| M36 | `taken_at` nullable — poor query plans | `photos.sql`, `indexes.sql` |
| M37 | Public storage bucket with permissive policies | `create_storage.sql` |
| M38 | Empty profile defaults on signup | `create_user_profiles.sql:37-47` |
| M39 | `company_name` is free-text tenant identifier | `create_user_profiles.sql:6` |

### DevOps
| # | Issue | File |
|---|-------|------|
| M40 | Missing pymupdf in Python test deps | `pyproject.toml` |
| M41 | Empty next.config.ts (no standalone, no image config) | `next.config.ts` |
| M42 | No API schema validation library | All API routes |
| M43 | No security headers in next.config | `next.config.ts` |

---

## 🟢 LOW SEVERITY (Nice to Fix)

| # | Dimension | Issue |
|---|-----------|-------|
| L1 | Security | Path traversal risk in upload filenames |
| L2 | Security | SSRF potential in report generation (URL fetch) |
| L3 | Security | EXIF extraction runs client-side (trust boundary) |
| L4 | Architecture | Identical SVG paths duplicated across 5+ files |
| L5 | Architecture | Unused imports in several files |
| L6 | Architecture | No barrel exports (`index.ts` files) |
| L7 | Architecture | Storage bucket name collision (photos + schemas) |
| L8 | Frontend | Inline SVG icons ~500+ lines that could use lucide-react |
| L9 | Frontend | `formatDate` duplicated across 4+ files |
| L10 | Frontend | Root error.tsx shows Macedonian for all locales |
| L11 | Frontend | No PWA manifest or service worker |
| L12 | Frontend | `suppressHydrationWarning` masks real issues |
| L13 | Frontend | No `next/font` Cyrillic subset |
| L14 | DB | Manual TypeScript types drift from actual schema |
| L15 | DB | `auth_role()` SECURITY DEFINER search_path risk |
| L16 | DB | execSync timeout may be insufficient for large reports |
| L17 | DB | Missing `updated_at` trigger on most tables |
| L18 | DevOps | No logging strategy (ad-hoc console.error) |
| L19 | DevOps | No Node.js version pinning |
| L20 | DevOps | Root .gitignore incomplete |
| L21 | DevOps | No backup strategy |

---

## 🔥 Blocker-Specific Deep Dives

### 1. The RLS Problem 🏗️

The **entire application bypasses Row Level Security** by using `createAdminClient()` (service_role) for all database operations. RLS policies in 14+ migrations are **dead code**.

**Affected:** Every user-facing API operation across `db/route.ts`, `upload/route.ts`, `upload-schema/route.ts`
**Root cause:** `admin.ts` creates client with `SUPABASE_SERVICE_ROLE_KEY` which has the `bypassrls` attribute
**Fix path:** 
- Short-term: Audit every `case` in `db/route.ts` for correct access checks
- Medium-term: Switch user operations to anon key + proper RLS, keep admin key for admin-only ops
- Long-term: Add DB-level company isolation policies as defense-in-depth

### 2. The God Route Problem 🐉

A single 948-line file handles **40+ database actions** with no validation, no type safety, no tests.

**Affected:** `web/app/api/db/route.ts` — literally everything
**Fix:** Split into 7 domain-specific route files:
```
app/api/
├── projects/route.ts
├── photos/route.ts
├── defects/route.ts
├── attendance/route.ts
├── pins/route.ts
├── audit/route.ts
└── admin/route.ts
```

### 3. The Migration Drift Problem 🗄️

16 migrations in `supabase/migrations/` vs 2 in `web/supabase/migrations/`. The `photos` table migration is missing `user_id` column. The `profiles` table is missing `email` column.

**Impact:** `supabase db push` from root applies 2/16 migrations = broken schema. Fresh deploy crashes.
**Fix:** Consolidate to one directory, capture schema drift with `supabase db diff`, add missing columns.

### 4. The i18n Problem 🌐

5 locales configured (mk, en, de, sl, sr) but 9+ components have **hardcoded Macedonian strings**. Root layout hardcodes `lang="mk"`.

**Impact:** 4/5 locales see wrong or mixed-language UI. Screen readers mispronounce. SEO misclassifies.
**Fix:** Extract ALL user-facing strings to message files. Dynamic `lang` attribute.

### 5. The Testing Void 🧪

**Zero tests** across the entire Next.js application. The Python package has 9 tests but misses a dependency.

**Impact:** Cannot refactor safely. The 948-line god route is untestable by design.
**Fix:** Add Vitest + @testing-library/react for unit tests, Playwright for E2E.

---

## 🗺️ Prioritized Remediation Roadmap

### Sprint 1: Production Blocker Removal (Week 1)
| Priority | Item | Est. Effort |
|----------|------|-------------|
| P0 | Rotate SUPABASE_SERVICE_ROLE_KEY, remove from `.env.local` | 15min |
| P0 | Add auth checks to `deleteProject`, `updateUserRole`, `updateUserPermission` | 1h |
| P0 | Fix `photos.user_id` missing column in migration | 1h |
| P0 | Fix `profiles.email` missing column | 1h |
| P0 | Consolidate duplicate migration directories | 30min |
| P0 | Fix open redirect in auth callback | 15min |
| P1 | Add admin checks to `getAllProfiles`, `getSubscriptions`, `getAuditLogs` | 1h |
| P1 | Fix mass assignment in `createDailyLog`, `updateDailyLog` | 1h |
| P1 | Add project access check to upload endpoints | 1h |
| P1 | Add file type/size validation to upload endpoints | 1h |

### Sprint 2: Architecture & Testing (Week 2)
| Priority | Item | Est. Effort |
|----------|------|-------------|
| P2 | Split `db/route.ts` into 7 domain routes | 4h |
| P2 | Create unified `callApi` with AbortController + timeout | 1h |
| P2 | Add Vitest + first test batch | 4h |
| P2 | Fix memory leaks in 4 hooks | 1h |
| P2 | Add Zod validation to API routes | 3h |
| P2 | Switch user ops to anon key, activate RLS policies | 4h |
| P3 | Add Sentry for error tracking | 2h |
| P3 | Add security headers (CSP, HSTS, XFO) in next.config | 1h |

### Sprint 3: Frontend & UX (Week 3)
| Priority | Item | Est. Effort |
|----------|------|-------------|
| P3 | Extract all hardcoded strings to i18n messages | 6h |
| P3 | Fix `lang="mk"` to dynamic locale | 1h |
| P3 | Add focus traps to all modals | 3h |
| P3 | Fix keyboard navigation in interactive elements | 3h |
| P3 | Add sitemap.xml, robots.txt, OG metadata | 2h |
| P3 | Add aria-live regions for dynamic content | 2h |
| P4 | Add multiple file upload | 2h |
| P4 | Add loading="lazy" to all images | 1h |
| P4 | Add error.tsx/loading.tsx to locale routes | 1h |

### Sprint 4: Infrastructure & Polish (Week 4)
| Priority | Item | Est. Effort |
|----------|------|-------------|
| P4 | Add GitHub Actions CI for web app | 3h |
| P4 | Add Dockerfile + docker-compose | 3h |
| P4 | Add rate limiting to API routes | 2h |
| P4 | No pagination on list endpoints | 3h |
| P5 | Add CORS/CSRF protection | 2h |
| P5 | Add health check endpoint | 1h |
| P5 | Add pre-commit hooks | 1h |
| P5 | Add dark mode toggle | 2h |
| P5 | Fix all accessibility issues (aria-describedby, skip-to-content, etc.) | 4h |

---

## Key Code Quality Metrics

| Metric | Current | Target |
|--------|---------|--------|
| API route file size | 948 lines (single file) | < 150 per domain route |
| Test coverage | 0% (web), ~70% (Python) | > 80% critical paths |
| Components per folder | 22 flat | Organized by domain |
| Hooks with cleanup | 2/6 (33%) | 6/6 (100%) |
| i18n coverage | ~60% of UI | > 95% of UI |
| Accessibility violations (estimated) | 30+ | 0 WCAG 2.1 AA |
| Missing ON DELETE CASCADE | 4 FK columns | 0 |
| API routes with rate limiting | 0/5 | 5/5 |
| CI/CD pipelines | 1/2 (Python only) | 2/2 |
| Docker support | None | Full |

---

## Quick Wins (< 1 hour each)

1. ✅ Rotate leaked service_role key (15 min)
2. ✅ Add `.env*` to root `.gitignore` (5 min)
3. ✅ Fix open redirect in auth callback (15 min)
4. ✅ Add auth check to `deleteProject`, `updateUserRole`, `updateUserPermission` (1h)
5. ✅ Add `loading="lazy"` to all images (15 min)
6. ✅ Fix `lang="mk"` hardcode (10 min)
7. ✅ Add Node.js version pinning (5 min)
8. ✅ Add health check endpoint (30 min)
9. ✅ Fix duplicate LanguageSwitcher on dashboard (5 min)
10. ✅ Add unused import cleanup (15 min)

---

## Conclusion

The application demonstrates strong functional ambition — multi-tenant RBAC, 5-locale i18n, photo management, defect tracking, daily logs, attendance, audit trails, and PDF reporting. However, rapid development has created significant technical debt:

- **Security**: 4 critical vulnerabilities including a leaked service key and privilege escalation vectors
- **Architecture**: A 948-line god route that is untestable and unmaintainable
- **Frontend**: Broken i18n for 4/5 locales, no SEO, accessibility violations throughout
- **Database**: Schema drift that prevents clean deployment, no pagination, RLS bypassed by design
- **DevOps**: Zero tests, no CI/CD, no Docker, no monitoring

**Estimated total remediation effort:** ~8-10 weeks for a single developer, or ~3-4 weeks for a team of 3.

**Recommendation:** Address the 10 Production Blocker items in Sprint 1 before any new feature development. The architecture debt (god route, inconsistent data access) should be tackled in Sprint 2 before it becomes impossible to refactor.
