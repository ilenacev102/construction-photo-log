# Architecture Audit — Construction Photo Log SaaS

**Date:** 2026-08-26
**Phase:** 0 — Repository & Architecture Audit
**Baseline:** 26/26 QA tests passing · 264/271 Vitest (7 pre-existing failures in `mentions.test.ts`) · TypeScript clean · ESLint 8 errors / 11 warnings (pre-existing)

---

## 1. Current Architecture Overview

### Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.x App Router (async `params`) |
| UI | React 19, `@base-ui-react`, Tailwind CSS 4, `cn()` utility |
| Auth | Supabase Auth (`@supabase/ssr` 0.12.4, `@supabase/auth-js` 2.112.0, PKCE flow) |
| Database | Supabase (PostgreSQL) with RLS, 3 visible migrations |
| i18n | `next-intl` — locales: mk (default), en, de, sl, sr |
| State | React hooks + server components; no global store |
| Testing | Vitest + Playwright (QA harness) |

### Routing
- `localePrefix: 'as-needed'` — default locale `mk` has no prefix
- Dashboard: `/[locale]/dashboard/` → server component redirects by role via `workspaceForRole()`
- Login: `/[locale]/login/` → `AuthForm` component (client)
- Projects: `/[locale]/projects/` → `useRole()` for permission gating
- Admin: `/[locale]/admin/` → client component with `useRole()`

### Three Supabase Clients
| Client | File | Purpose | RLS |
|--------|------|---------|-----|
| SSR | `lib/supabase/server.ts` | Server components, `createClient()` | ✅ Enforced |
| Browser | `lib/supabase/client.ts` | Client components, `createClient()` | ✅ Enforced |
| Admin | `lib/supabase/admin.ts` | API routes via `createAdminClient()` | ⚠️ Bypasses RLS (service role) |

---

## 2. Auth & Authorization Model

### Authentication Flow
1. User logs in via `AuthForm` → Supabase Auth (email/password)
2. PKCE flow, `flowType: "pkce"` in browser client
3. SSR client reads cookies for server-side auth
4. No `middleware.ts` exists — auth checks are per-route via `requireAuth()` guard

### Authorization Layers
1. **`requireAuth()`** (`lib/api/auth-guard.ts:19`) — verifies session, returns `{ user, supabase }`
2. **`getCompanyContext()`** (`lib/api/company-auth.ts:9`) — resolves company from `profiles.company_name`
3. **`requireProjectAccess()`** / **`requireProjectMutate()`** — project-level RBAC
4. **`isAdminUser()`** / **`isForemanUser()`** — role-based checks
5. **Field whitelists** (`lib/api/field-whitelists.ts`) — mass-assignment mitigation for PATCH endpoints

### Multi-Tenancy Model
- **String-based** company isolation via `profiles.company_name`
- No `company_id` foreign key in projects table
- `getCompanyContext()` queries `profiles` table by `company_name` to get `companyUserIds`
- Cross-company access blocked by `requireProjectAccess()` checks

### RBAC Hierarchy (hardcoded in two places)
```
client (0) < photographer (1) < foreman (2) < site_manager (3) < admin (4)
```
- **`hooks/useRole.ts:53-60`** — client-side derivation
- **`app/api/users/route.ts:6-12`** — server-side `ROLE_HIERARCHY`

### Client-Side Permission Derivation (`useRole`)
```
isAdmin    = role === 'admin'
isManager  = role === 'site_manager' || role === 'admin'
isForeman  = role === 'foreman' || role === 'site_manager' || role === 'admin'
canWrite   = isForeman
canManage  = isManager
```

---

## 3. API Layer Inventory

23 API route directories under `app/api/`:

| Route | Methods | Auth | Company Scope |
|-------|---------|------|---------------|
| `/api/projects` | GET, POST | `requireAuth()` | `company_name` match |
| `/api/projects/[id]` | GET, PATCH, DELETE | `requireAuth()` | `company_name` match |
| `/api/photos` | GET, DELETE | `requireAuth()` | `getCompanyContext()` |
| `/api/photos/[id]` | GET, PATCH | `requireAuth()` | project-level |
| `/api/daily-logs` | GET, POST, PATCH, DELETE | manual `getUser()` | `requireProjectAccess/Mutate` |
| `/api/users` | GET, PATCH | `requireAuth()` + `createAdminClient()` | `company_name` match |
| `/api/permissions` | GET, POST | `requireAuth()` | company match + `user.manage` RPC |
| `/api/notifications` | GET | manual `getUser()` | `user_id` match |
| `/api/stats` | GET | manual `getUser()` | `getCompanyContext()` |
| `/api/defects` | GET, POST, PATCH, DELETE | `requireAuth()` | project-level |
| `/api/drawings` | GET, POST | `requireAuth()` | project-level |
| `/api/drawing-pins` | GET, POST, PATCH, DELETE | `requireAuth()` | project-level |
| `/api/comments` | GET, POST, PATCH, DELETE | `requireAuth()` | entity-level |
| `/api/work-orders` | GET, POST, PATCH, DELETE | `requireAuth()` | project-level |
| `/api/attendance` | GET, POST, PATCH, DELETE | `requireAuth()` | project-level |
| `/api/trades` | GET, POST, PATCH, DELETE | `requireAuth()` | project-level |
| `/api/reports` | GET, POST | `requireAuth()` | project-level |
| `/api/profiles` | GET, PATCH | `requireAuth()` | own profile |
| `/api/labels` | GET, POST | `requireAuth()` | project-level |
| `/api/taggings` | POST, DELETE | `requireAuth()` | entity-level |
| `/api/storage` | POST | `requireAuth()` | project-level |
| `/api/public-site` | GET | none (public) | N/A |
| `/api/admin/*` | various | `requireAuth()` + role check | admin-only |

### Auth Inconsistency
Two patterns in use:
1. **`requireAuth()` guard** (majority of routes) — consistent, structured
2. **Manual `getUser()`** (daily-logs, notifications, stats, some others) — less structured, no `apiErrorResponse` wrapping

---

## 4. React Component Architecture

### Hooks Directory (`hooks/`)
| Hook | File | Purpose |
|------|------|---------|
| `useRole` | `hooks/useRole.ts` | Profile + role + permission booleans |
| `usePermissions` | `hooks/usePermissions.ts` | Effective permissions via RPC |
| `useDefects` | `hooks/useDefects.ts` | Defect CRUD operations |
| `usePins` | `hooks/usePins.ts` | Drawing pin operations |
| `useLabels` | `hooks/useLabels.ts` | Label management |
| `useTrades` | `hooks/useTrades.ts` | Trade management |
| `useWorkOrders` | `hooks/useWorkOrders.ts` | Work order CRUD |
| `useAttendance` | `hooks/useAttendance.ts` | Attendance tracking |

### Hook Quality Assessment
- **`useRole.ts`**: Clean implementation. Hooks called unconditionally. No early returns before hooks. No React ordering violations detected.
- **`usePermissions.ts`**: Properly guards `useEffect` with `if (roleLoading) return` (callback return, not component return). Uses `ignore` flag for cleanup. No ordering issues.

### Layout Architecture
| Layout | Type | Auth Check |
|--------|------|-----------|
| `app/layout.tsx` | Root | None |
| `app/[locale]/layout.tsx` | Locale | None (sets `<html lang>`) |
| `app/[locale]/dashboard/layout.tsx` | Dashboard | Server component, redirects if no user |
| `app/[locale]/admin/layout.tsx` | Admin | Client component, `useRole()` with `isLoading` early return |

### Admin Layout Concern
`app/[locale]/admin/layout.tsx` is a client component that calls `useRole()` and has an `isLoading` early return. This is technically valid (hooks are called unconditionally before the early return), but the pattern of having a server layout redirect + client layout with hook-based auth creates a dual-auth-check that could drift.

---

## 5. Security Assessment

### Current Security Measures
1. **RLS policies** on projects, photos, daily_logs, comments
2. **`requireAuth()` guard** on most API routes
3. **Field whitelists** for PATCH endpoints (mass-assignment mitigation)
4. **Company-scoped queries** via `getCompanyContext()`
5. **Role hierarchy enforcement** in `users/PATCH`
6. **`user_permissions` table** with `user_has_permission` RPC
7. **Audit logging** on permission changes and role updates

### Security Gaps

#### CRITICAL
1. **`work_order_defects` table has weak RLS** — policies only check `auth.uid() is not null`, no project-level access control
2. **No `middleware.ts`** — no centralized auth enforcement; relies on per-route `requireAuth()` calls. A single forgotten call = unauthenticated access.
3. **Admin client (service role) bypasses RLS** — used in most API routes. If company-scoping logic in `getCompanyContext()` has a bug, data leaks across tenants.

#### HIGH
4. **In-memory rate limiting** (`lib/api/rate-limit.ts`) — Map-based, per-process. Resets on restart, not shared across instances, no persistence.
5. **`user_has_permission` RPC is SECURITY DEFINER** — runs with elevated privileges. App-layer scoping is correct but fragile.
6. **`company_name` string matching** — no referential integrity; users can be orphaned if company name changes.

#### MEDIUM
7. **No CSRF protection** beyond Supabase's built-in SameSite cookies
8. **`/api/public-site` has no auth** — intentional but should be documented as public surface
9. **No input validation middleware** — validation is ad-hoc per route
10. **No request logging/audit trail** for read operations

---

## 6. Technical Debt Inventory

### P0 — Critical (Must Fix Before Production)
| # | Issue | Location | Risk |
|---|-------|----------|------|
| P0-1 | No `middleware.ts` — no centralized auth enforcement | missing `web/middleware.ts` | Unauthenticated access if route handler forgets `requireAuth()` |
| P0-2 | `work_order_defects` weak RLS (only `auth.uid() is not null`) | `supabase/migrations/20260826000001_create_work_order_defects.sql` | Any authenticated user can read/write any work order defect |
| P0-3 | Admin service role client used in most API routes, bypasses RLS | `lib/supabase/admin.ts` used in 15+ routes | Single bug in company-scoping = cross-tenant data leak |
| P0-4 | RBAC hierarchy hardcoded in two separate locations | `hooks/useRole.ts:53-60` + `app/api/users/route.ts:6-12` | Drift between client/server permission logic |

### P1 — High (Fix Before SaaS Launch)
| # | Issue | Location | Risk |
|---|-------|----------|------|
| P1-1 | In-memory rate limiter resets on restart, not shared | `lib/api/rate-limit.ts` | DoS after restart, no rate limiting in multi-instance |
| P1-2 | Inconsistent auth patterns across API routes | daily-logs, notifications use manual `getUser()` vs `requireAuth()` | Some routes miss `apiErrorResponse` wrapping |
| P1-3 | Dead code: `mode === 'role'` branch in permissions API | `app/api/permissions/route.ts:18-20` | Confusion, unused code path |
| P1-4 | `company_name` string-based multi-tenancy (no FK) | `lib/api/company-auth.ts:9`, `types/database.ts` | No referential integrity, orphan risk |
| P1-5 | No input validation middleware | all API routes | Ad-hoc validation, easy to miss fields |
| P1-6 | No request audit trail for read operations | API layer | No forensic capability |

### P2 — Medium (Post-Launch Improvement)
| # | Issue | Location | Risk |
|---|-------|----------|------|
| P2-1 | `usePermissions` has duplicate API call logic | `hooks/usePermissions.ts:23-31` vs `:62-83` | Confusion, potential race condition |
| P2-2 | No centralized permission constants | Throughout codebase | Magic strings scattered |
| P2-3 | Admin layout uses client-side auth check while dashboard uses server-side | `app/[locale]/admin/layout.tsx` vs `app/[locale]/dashboard/layout.tsx` | Auth drift between layouts |
| P2-4 | No error boundaries in client hooks | `useRole.ts:44-46` catches but doesn't expose error state | Silent failures |

### P3 — Low (Cleanup)
| # | Issue | Location | Risk |
|---|-------|----------|------|
| P3-1 | ESLint: 8 errors, 11 warnings (pre-existing) | Various | Code quality |
| P3-2 | Vitest: 7 failures in `mentions.test.ts` (pre-existing) | `lib/__tests__/mentions.test.ts` | Test suite health |
| P3-3 | Only 3 visible migration files vs many tables in code | `supabase/migrations/` | Migration history gap |

---

## 7. Strengths (What Works Well)

1. **Consistent API response format** — `successResponse()` / `errorResponse()` from `lib/api/errors.ts` with Macedonian error messages
2. **Field whitelists for PATCH endpoints** — prevents mass-assignment on `daily_logs` and `drawing_pins`
3. **`requireProjectAccess()` / `requireProjectMutate()`** — project-level RBAC helper functions
4. **Audit logging** on permission changes and role updates
5. **Hook architecture** — no React ordering violations in `useRole` or `usePermissions`
6. **Multi-locale support** — 5 locales with proper i18n routing
7. **Clean TypeScript** — strict mode, no `any` usage, proper type definitions in `types/database.ts`
8. **Service role client isolated** — `lib/supabase/admin.ts` is a separate module, not mixed with SSR client

---

## 8. Recommended Target Architecture

### Immediate (Phase 1-3)
1. **Add `middleware.ts`** — centralized auth + route protection
2. **Unify RBAC** — single source of truth for role hierarchy
3. **Fix `work_order_defects` RLS** — add project-level policies
4. **Replace in-memory rate limiter** — Redis or Upstash

### Short-term (Phase 4-8)
5. **Standardize API auth** — all routes use `requireAuth()` consistently
6. **Add input validation layer** — Zod schemas per route
7. **Clean up dead code** — remove unused `mode === 'role'` branch
8. **Add error boundaries** — expose error state from hooks

### Medium-term (Phase 9+)
9. **Migrate to `company_id` FK** — replace string-based multi-tenancy
10. **Add request audit trail** — log all read operations
11. **Add RBAC constants** — centralized permission keys
12. **Add E2E tests** — Playwright coverage for critical paths

---

## 9. Files Read During Audit

### Core Auth & API
- `lib/supabase/server.ts` — SSR client creation
- `lib/supabase/client.ts` — browser client creation
- `lib/supabase/admin.ts` — service role admin client
- `lib/supabase/queries.ts` — API fetch wrappers + domain queries
- `lib/api/auth-guard.ts` — `requireAuth()` guard
- `lib/api/company-auth.ts` — `getCompanyContext()`, `isAdminUser()`, `requireProjectAccess()`
- `lib/api/rate-limit.ts` — in-memory sliding window
- `lib/api/errors.ts` — error/success response helpers
- `lib/api/field-whitelists.ts` — mass-assignment mitigation
- `lib/auth/workspace.ts` — workspace role mapping

### React Hooks
- `hooks/useRole.ts` — profile + role + permission booleans
- `hooks/usePermissions.ts` — effective permissions via RPC
- `hooks/index.ts` — does NOT exist (no barrel export)

### Pages & Layouts
- `app/layout.tsx` — root layout
- `app/[locale]/layout.tsx` — locale layout with `NextIntlClientProvider`
- `app/[locale]/dashboard/layout.tsx` — server component, auth redirect
- `app/[locale]/dashboard/page.tsx` — role-based redirect
- `app/[locale]/admin/layout.tsx` — client component with `useRole()`
- `app/[locale]/login/page.tsx` — login page
- `app/[locale]/projects/page.tsx` — projects list with `useRole()`

### API Routes (sampled)
- `app/api/projects/route.ts` — projects CRUD
- `app/api/photos/route.ts` — photos CRUD with company scope
- `app/api/daily-logs/route.ts` — daily logs CRUD
- `app/api/users/route.ts` — user management with RBAC
- `app/api/permissions/route.ts` — permission management
- `app/api/notifications/route.ts` — notifications (bell icon)
- `app/api/stats/route.ts` — dashboard statistics

### Database
- `types/database.ts` — TypeScript type definitions
- `supabase/config.toml` — Supabase configuration
- `supabase/migrations/20260724000001_create_projects.sql` — projects table + RLS
- `supabase/migrations/20260724000002_create_photos.sql` — photos table + RLS
- `supabase/migrations/20260826000001_create_work_order_defects.sql` — work_order_defects + weak RLS

### Config & Tests
- `package.json` — dependencies
- `next.config.ts` — CSP headers, Supabase image patterns
- `tsconfig.json` — strict mode, bundler resolution
- `AGENTS.md` — project conventions
- `vitest.config.mts` — test configuration
- `eslint.config.mjs` — ESLint configuration
