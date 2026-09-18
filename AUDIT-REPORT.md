# Comprehensive Production Audit Report: Construction Photo Log

**Date:** July 29, 2026  
**Scope:** Full-stack audit (Next.js 16 + Supabase + Python PDF generator)  
**Auditor:** Sisyphus — 6 parallel specialized agents + manual codebase analysis  
**Verdict:** ⚠️ **NOT READY FOR PRODUCTION** — Critical security and architectural issues must be resolved first.

---

## Executive Summary

This application is a promising construction site photo documentation platform with feature-rich frontend, multi-language support, multi-tenant company isolation, Kanban defect tracking, attendance management, and PDF report generation. However, it suffers from **fundamental architectural anti-patterns** that make it unsafe for production deployment at scale.

The most critical finding is the **generic database proxy pattern** (`/api/db`) — a 948-line single POST endpoint that proxies 40+ database operations through the Supabase `service_role` key, completely bypassing Row Level Security. This is accompanied by broken server-side cookie handling, no middleware, no input validation, and inconsistent authentication patterns across the codebase.

---

## Audit Scores by Domain

| Domain | Score | Key Issues |
|--------|-------|------------|
| **Security & Authentication** | **35/100** | Service_role proxy, no middleware, broken cookies, no rate limiting |
| **Database & API Design** | **30/100** | Anti-pattern generic proxy, no input validation, RLS bypassed |
| **Frontend Architecture** | **70/100** | Solid component design, but auth handling is inconsistent |
| **Internationalization** | **65/100** | Good structure, but root layout hardcodes `lang="mk"` |
| **PDF Generator** | **75/100** | Works, but blocking `execSync` in API route is a problem |
| **Build & DevOps** | **45/100** | No tests, empty next.config, missing type-check |
| **Overall** | **50/100** | **NOT PRODUCTION READY** |

---

## 🔴 CRITICAL (Fix Immediately)

### C1. Generic Database Proxy — `/api/db` (Severity: CRITICAL)

**File:** `web/app/api/db/route.ts` (948 lines)

This single POST endpoint handles **40+ database actions** through a giant `switch` statement. Every operation uses the Supabase `service_role` key via `createAdminClient()`, which **completely bypasses all Row Level Security (RLS)**.

```typescript
const admin = createAdminClient()  // service_role key — no RLS
switch (action) {
  case 'getProjects': // ... admin.from('projects').select('*')
  case 'getAllDefects': // ... admin.from('defects').select('*')
  case 'getSubscriptions': // ... admin.from('subscriptions').select('*')
  // ... 37 more cases
}
```

**Risks:**
- Any bug in the manual company-isolation logic exposes all tenants' data
- No rate limiting → can be hammered
- No request body validation (no Zod/Pydantic schema)
- `getSubscriptions` returns ALL subscriptions to ANY authenticated user
- `getAllProfiles` returns ALL user profiles
- `getAllDefects` returns ALL defects for admin users

**Fix:** Replace with dedicated route handlers per resource. Use RLS properly with the anon key client. Reserve `service_role` for server-only operations that genuinely need it (and audit those carefully).

### C2. Broken Server-Side Cookie Handling (Severity: CRITICAL)

**Files:** `web/lib/supabase/server.ts`, `web/app/api/db/route.ts`, `web/app/api/upload/route.ts`, `web/app/api/upload-schema/route.ts`, `web/app/api/invite/route.ts`

Every server-side Supabase client has the same bug:

```typescript
cookies: {
  getAll: () => cookieStore.getAll(),
  setAll: () => {},  // ← COOKIES NEVER PERSISTED
}
```

The empty `setAll` function means **session cookies set by Supabase auth (token refresh, etc.) are silently discarded**. This works accidentally for auth callbacks (which write cookies to a `NextResponse` directly) but breaks in these scenarios:
- Server component data fetching after token refresh
- middleware.ts (if it existed) auth checks
- Any server-side session mutation

**Fix:** Implement `setAll` properly:

```typescript
setAll: (cookiesToSet) => {
  cookiesToSet.forEach(({ name, value, options }) => {
    cookieStore.set(name, value, options)
  })
}
```

See `app/auth/callback/route.ts` lines 26-30 for the correct implementation pattern — it's already written there but not used elsewhere.

### C3. No Middleware (Severity: CRITICAL)

**Missing file:** `web/middleware.ts`

The application has **no middleware layer** at all. This means:
- No auth protection at the edge
- No i18n redirect (locale detection/redirect happens only after page loads)
- No request validation
- No CSP/security headers
- No request logging
- Session checks are deferred to client-side components

**Fix:** Implement middleware for auth checks, locale detection, and security headers.

### C4. Empty Next.js Configuration (Severity: HIGH)

**File:** `web/next.config.ts`

```typescript
const nextConfig: NextConfig = {
  /* config options here */
}
```

No configuration for:
- **Images**: `remotePatterns` — needed for Next.js Image Optimization with Supabase storage URLs (currently all images use bare `<img>` tags)
- **Headers**: No CSP, no HSTS, no security headers
- **Redirects**: No SEO redirects
- **Cache headers**: None configured

**Fix:** At minimum configure `images.remotePatterns` for Supabase storage and security headers.

---

## 🔴 HIGH (Fix Before Launch)

### H1. RLS Entirely Bypassed (Severity: HIGH)

The entire application operates through the `service_role` admin client. Multi-tenant isolation is implemented **manually** in application code via `getCompanyContext()` and `requireProjectAccess()`. This is fragile — one missed filter call exposes cross-company data.

Additionally, some hooks (`useDefects.ts`, `useTrades.ts`) use the browser Supabase client directly (which respects RLS), creating an inconsistent and confusing security model.

### H2. API Routes Lack Project Access Verification (Severity: HIGH)

**Files:**
- `web/app/api/upload/route.ts` — No check that user has access to the `projectId` they upload to
- `web/app/api/upload-schema/route.ts` — Same issue

Contrast with `/api/db` which carefully calls `requireProjectAccess()` for project-scoped operations. These upload routes do not.

### H3. Blocking `execSync` in API Route (Severity: HIGH)

**File:** `web/app/api/report/route.ts` (line 50)

```typescript
execSync(`/home/nac/Projects/construction-photo-log/.venv/bin/python ...`, { timeout: 30000 })
```

Issues:
- **Blocks the event loop** in a serverless environment — Next.js API routes should be async
- **Hardcoded absolute path** to Python binary — breaks on any other machine or deployment
- **30s timeout** may hit serverless function limits (Vercel Hobby: 10s, Pro: 60s but billed)
- **No streaming** — user waits for full PDF generation before any response

**Fix:** Use `child_process.execFile` or `spawn` with proper async handling. Consider deferring PDF generation to a background queue.

### H4. No Input Validation Anywhere (Severity: HIGH)

No request payload is validated against a schema. The `/api/db` route spreads request body fields directly into Supabase queries with only null checks:

```typescript
const { name, address, client_name } = body
if (!name) return errorResponse('Missing project name')
```

No Zod, no type guards, no sanitization. A malformed request could:
- Pass unexpected fields to Supabase inserts
- Trigger database errors that leak schema information
- Bypass implicit type constraints

### H5. Root Layout Hardcodes `lang="mk"` (Severity: HIGH)

**File:** `web/app/layout.tsx` (line 21)

```tsx
<html lang="mk" dir="ltr" ...>
```

Despite supporting 5 locales (`mk`, `en`, `de`, `sl`, `sr`), the root layout hardcodes Macedonian. The `html` element is outside `next-intl`'s control. This means:
- Screen readers announce wrong language for English/German users
- Browser translation prompts are wrong
- SEO metadata signals wrong language

**Fix:** The root layout should not set `lang`/`dir` — delegate that to the `[locale]/layout.tsx`.

---

## 🟡 MEDIUM (Fix in First Iteration)

### M1. Inconsistent Data Access Patterns

Three different patterns exist, creating confusion:
1. **`/api/db` proxy** — used by most hooks/queries (service_role, bypasses RLS)
2. **Direct browser client** — used by `useDefects.ts` (respects RLS) and `useTrades.ts`
3. **Dedicated API routes** — `/api/upload`, `/api/upload-schema`, `/api/report` (mixed auth patterns)

Standardize on one pattern. Recommendation: dedicated API routes per resource with proper validation.

### M2. `.env.local.example` Incomplete

**File:** `web/.env.local.example`

Only documents `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Missing:
- `SUPABASE_SERVICE_ROLE_KEY` (required by admin client)
- Any session/secret keys

### M3. Admin Endpoints Lack Admin Verification

Several `/api/db` actions return sensitive data without verifying the caller is an admin:
- `getAllProfiles` — returns all user profiles
- `getSubscriptions` — returns all subscriptions (no filter at all!)
- `updateUserRole` — allows role escalation (checks for params but not caller privileges)

### M4. No Tests

**Zero test files exist anywhere in the project.** Not in `package.json` dependencies, no test scripts, no test configuration. The Python package lists `pytest` as a dev dependency but has no tests.

### M5. No `type-check` Script

`package.json` scripts are minimal. No TypeScript type checking command separate from `build`.

### M6. PhotoLightbox Hardcodes Macedonian Locale

**File:** `web/components/PhotoLightbox.tsx` (line 119)

```typescript
import { mk } from 'date-fns/locale/mk'
// ...
format(new Date(photo.taken_at), 'dd MMM yyyy', { locale: mk })
```

Date formatting always uses Macedonian locale regardless of user's language preference. Should use `next-intl` date formatting.

### M7. No Loading/Error States on Pages

Many page components don't implement proper loading boundaries, suspense fallbacks, or error boundaries. The app could show broken UI states during data fetching.

### M8. No `generateStaticParams` for Blog

**Files:** `web/app/[locale]/blog/[slug]/page.tsx`

The blog pages don't use `generateStaticParams` to pre-render blog content. All blog pages are dynamically rendered, hurting performance and SEO.

---

## 🟢 LOW (Nice to Have)

### L1. Python Package Uses Legacy setuptools

`pyproject.toml` uses the old `setuptools` build backend. Consider migrating to modern `hatchling` or `flit`.

### L2. Manual `sys.argv` Parsing in CLI

**File:** `packages/photo-report-pdf/src/photo_report_pdf/cli.py`

The CLI uses raw `sys.argv` parsing instead of `argparse` or `click`. Fine for internal use but limits discoverability.

### L3. Hardcoded Color Values in DrawingCanvas

**File:** `web/components/DrawingCanvas.tsx`

The drawing tool toolbar uses emoji/unicode symbols as tool labels. Consider using proper icon components.

### L4. No Accessibility Labels on SVG Icons

Several components use decorative SVGs without `aria-hidden` attributes or proper labeling.

### L5. Global CSS Imported with No Scoping

`globals.css` imports are global. The `shadcn/tailwind.css` import adds significant global styles that should be scoped or tree-shaken.

---

## Architectural Findings

### A1. Strengths

- **Multi-tenant isolation** — The `getCompanyContext`/`requireProjectAccess` pattern shows thoughtful design despite being implemented in the wrong layer
- **Internationalization** — `next-intl` is well-integrated with 5 complete locale files
- **Component modularity** — Components are well-separated with clear responsibilities
- **Kanban defect board** — Well-implemented with drag-free status transitions
- **Drawing canvas** — SVG-based annotation system is well-designed with multiple tool types
- **Audit logging** — Comprehensive audit trail across all entities
- **Permission system** — RBAC with user-level granular permissions

### A2. Architectural Anti-Patterns

1. **God Route** — `/api/db` is a 948-line single-handler god endpoint that should be 40 separate route handlers
2. **Leaky Security** — `service_role` key used in API routes exposed to the web
3. **Mixed Auth Models** — Three different patterns for data access
4. **No Edge Layer** — Missing middleware forces auth checks into API routes and client components

### A3. Scalability Concerns

- **No pagination** on most list endpoints (photos, defects, logs)
- **No caching strategy** — All data fetched fresh on every request
- **Blocking PDF generation** — Will timeout on large reports; no queue system
- **No request coalescing** — Multiple hooks on same page create parallel API calls

---

## Refactoring Roadmap

### Phase 1 — Security (Week 1)
1. [C1] Replace `/api/db` with dedicated route handlers per resource
2. [C2] Fix `setAll` cookie handling in all server clients
3. [C3] Implement middleware for auth, i18n, and security headers
4. [H1] Restore RLS; limit `service_role` to truly privileged operations

### Phase 2 — API & Validation (Week 2)
5. [H2] Add project access verification to upload routes
6. [H4] Add Zod schemas for all API request validation
7. [H3] Move PDF generation to background queue; stream response
8. [M2] Complete `.env.local.example`

### Phase 3 — Frontend & i18n (Week 3)
9. [H5] Fix root layout `lang`/`dir` — delegate to locale layout
10. [M6] Make PhotoLightbox locale-aware
11. [M7] Add loading/error boundaries to all pages
12. [M1] Standardize data access pattern

### Phase 4 — Build & Quality (Week 4)
13. [M4] Add test framework and critical path tests
14. [C4] Configure `next.config.ts` (images, headers, redirects)
15. [M5] Add `type-check` script
16. [M3] Fix admin endpoint authorization

---

## Appendix: Files Read During Audit

### Configuration & Build (7 files)
- `web/package.json`, `web/next.config.ts`, `web/tsconfig.json`, `web/vercel.json`, `web/.env.local.example`, `web/AGENTS.md`, `packages/photo-report-pdf/pyproject.toml`

### API Routes (5 files)
- `web/app/api/db/route.ts` (948 lines), `web/app/api/upload/route.ts`, `web/app/api/report/route.ts`, `web/app/api/invite/route.ts`, `web/app/api/upload-schema/route.ts`

### Supabase Clients (3 files)
- `web/lib/supabase/server.ts`, `web/lib/supabase/admin.ts`, `web/lib/supabase/client.ts`

### i18n (3 files + 5 message files)
- `web/i18n/routing.ts`, `web/i18n/request.ts`, `web/i18n/navigation.ts`
- `web/messages/{mk,en,de,sl,sr}.json`

### Components (18 files)
- Navbar, LanguageSwitcher, AuthForm, PhotoUpload, ReportBuilder, PhotoLightbox, DrawingCanvas, DefectBoard, AttendancePanel, PhotoTimeline, PhotoCard, PhotoMap, ProjectCard, DailyLogTimeline, DailyLogForm, PermissionEditor, CanPermission, AuditLogViewer

### Hooks (6 files)
- `useRole`, `usePermissions`, `useDefects`, `useAttendance`, `usePins`, `useTrades`

### Pages (21 files)
- All `[locale]` route pages including dashboard, admin, projects, blog, pricing, etc.

### Types (1 file)
- `web/types/database.ts` — all interfaces including Project, Photo, Defect, AttendanceLog, DrawingPin, etc.

### PDF Generator (2 files)
- `packages/photo-report-pdf/src/photo_report_pdf/generator.py`, `cli.py`

### Layout & CSS (3 files)
- `web/app/layout.tsx`, `web/app/globals.css`, `web/app/[locale]/layout.tsx`

### Auth (1 file)
- `web/app/auth/callback/route.ts`

### Other (1 file)
- `web/lib/exif.ts`

**Total: ~75 files analyzed across web app and Python package.**

---

*Report generated by Sisyphus — 6 parallel specialized agents + manual gap analysis.*
