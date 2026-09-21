# Backend / API Audit Report

**Date:** 2026-09-10
**Scope:** All `web/app/api/**` route handlers (35 files), `web/lib/supabase/*` (4 files), `web/lib/api/*` (7 files)
**Previous Audit:** July 29 2026 — Score 50/100 (monolithic `/api/db` proxy, missing project scoping)
**Method:** Read-only static analysis of every route handler, client utility, and library function

---

## Executive Summary

**Updated Score: 72 / 100 — CONDITIONALLY PRODUCTION READY**

The refactoring from the monolithic `/api/db` POST proxy to 35 per-resource route handlers is a major architectural improvement. Every handler now uses `requireAuth()`, validates with Zod, enforces project/company scoping, and follows a consistent error-handling pattern. The critical RLS-bypass vulnerability from the prior audit (audit #2) is resolved — each route manually re-asserts authorization via `requireProjectAccess()`/`requireProjectMutate()`.

The remaining gaps are **operational and performance-related**: nearly all list endpoints lack pagination, there are zero cache directives across the entire API, and every query uses `select('*')` which exposes all columns. These are not security blockers but will cause production incidents under load.

### Severity Distribution

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3 | Address before production |
| HIGH | 6 | Address within first sprint |
| MEDIUM | 7 | Address within first month |
| LOW | 5 | Nice-to-have improvements |

---

## CRITICAL — Must Fix Before Production

### C1. No Authentication Middleware

**File:** `web/middleware.ts` — DOES NOT EXIST
**Impact:** Every route handler must independently call `requireAuth()`. If any handler forgets (or a new one is added without it), it becomes an unauthenticated endpoint. There is no safety net.

Every one of the 35 route handlers individually starts with `requireAuth()`, which is correct. But this is a defense-in-depth gap — a single new handler without it exposes data.

**Fix:** Add `web/middleware.ts` that validates the Supabase session cookie on every `/api/*` request before it reaches the handler. The handler-level `requireAuth()` then becomes a redundant safety check, not the only gate.

```typescript
// web/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return response
}

export const config = { matcher: ['/api/:path*'] }
```

---

### C2. Universal `select('*')` — Column-Level Data Leakage Risk

**Impact:** 32+ occurrences across all route handlers. Every query returns every column from every table, including internal metadata, timestamps, and columns the client never consumes.

**Affected tables and their exposed columns:**

| Table | `select('*')` locations | Potentially unnecessary columns |
|-------|------------------------|-------------------------------|
| `photos` | `photos/route.ts:22,65` | Internal storage paths, metadata |
| `defects` | `defects/route.ts:28,45` | Internal resolution metadata |
| `daily_logs` | `daily-logs/route.ts:24` | Internal `user_id`, metadata |
| `work_orders` | `work-orders/route.ts:30,55` | All internal fields |
| `attendance_logs` | `attendance/route.ts:72,89` | All internal fields |
| `audit_logs` | `audit-logs/route.ts:38` | Full audit trail including IP |
| `projects` | `projects/route.ts:20,27,28` | Internal fields |
| `profiles` | `users/route.ts:47,67,73,79` | All profile fields including email |
| `role_permissions` | `permissions/route.ts:21` | All permission rows |

**Fix:** Replace `select('*')` with explicit column lists per endpoint. Example for `photos/route.ts`:

```typescript
// Before
.select('*')
// After
.select('id, project_id, user_id, image_url, taken_at, latitude, longitude, note, created_at')
```

**Priority reasoning:** Any future column addition to these tables (PII, internal flags, debug data) will automatically leak to the client without anyone noticing. Column whitelisting is a standard production practice.

---

### C3. All Routes Use `service_role` Admin Client, Bypassing RLS

**Files:** All 35 route handlers under `web/app/api/`
**Impact:** Every route uses `createAdminClient()` (service_role key) for DB operations. Authorization is manually enforced per-handler via `requireProjectAccess()`/`requireProjectMutate()`/`getCompanyContext()`.

This is architecturally intentional and correctly implemented today, but it means:
- A single missed authorization check = full data exposure
- No database-level safety net for authorization
- Any new handler that forgets `requireProjectMutate()` exposes write access

**Current status:** All handlers checked — authorization is correctly enforced. This is NOT a current vulnerability but an architectural fragility.

**Fix (medium-term):** Migrate read-only queries from `createAdminClient()` to `createServerClient()` (cookie-based, RLS-active) where possible. Reserve admin client for truly cross-user operations (audit logs, team listings). This adds database-level RLS as a second authorization gate.

```typescript
// Instead of always using admin:
const admin = createAdminClient()
await requireProjectAccess(admin, user.id, projectId)  // manual check only

// Use RLS-active client for scoped reads:
const { supabase } = await requireAuth()  // cookie client, RLS active
const { data } = await supabase.from('photos').select(...).eq('project_id', projectId)
// RLS + handler check = defense in depth
```

---

## HIGH — Fix Within First Sprint

### H1. Unbounded List Queries — No Pagination

**Impact:** 12+ list endpoints return all matching rows with no limit. A project with 10,000 photos or 5,000 defects returns all of them in a single response.

| Endpoint | Has Limit? | Risk |
|----------|-----------|------|
| `GET /api/photos` (both paths) | ❌ None | **Critical** — photos include signed URLs, O(n) signing cost |
| `GET /api/defects` (both paths) | ❌ None | High payload for mature projects |
| `GET /api/daily-logs` | ❌ None | Grows linearly over project lifetime |
| `GET /api/work-orders` (both paths) | ❌ None | Same |
| `GET /api/projects` | ❌ None | Moderate — fewer rows typically |
| `GET /api/pins` | ❌ None | Pins accumulate over time |
| `GET /api/team` | ❌ None | Moderate — few rows |
| `GET /api/projects/[id]/comments` | ❌ None | Comments accumulate |
| `GET /api/projects/[id]/members` | ❌ None | Moderate |
| `GET /api/attendance` | ✅ `limit(50)` default | Acceptable |
| `GET /api/audit-logs` | ✅ `range(offset, offset+limit-1)` | Acceptable |
| `GET /api/notifications` | ✅ `limit(30)` hardcoded | Acceptable |

**Fix:** Add cursor-based or offset pagination to all list endpoints. Minimum viable pattern:

```typescript
// Accept limit + offset from query params
const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
const offset = parseInt(searchParams.get('offset') ?? '0', 10)

let query = admin
  .from('photos')
  .select('*')
  .eq('project_id', projectId)
  .order('taken_at', { ascending: false })
  .range(offset, offset + limit - 1)

// Also return total count for client pagination UI
const { count } = await admin
  .from('photos')
  .select('*', { count: 'exact', head: true })
  .eq('project_id', projectId)

return successResponse({ items: data ?? [], total: count ?? 0 })
```

---

### H2. Zero Response Caching Across All 35 Endpoints

**File:** Every route handler under `web/app/api/`
**Impact:** `grep` for `force-dynamic`, `revalidate`, `cache`, `Cache-Control`, `no-store`, `no-cache` returns **zero matches** across all 35 route handlers.

Every single API request — including read-heavy dashboard data like project lists, permissions, team members, and stats — hits Supabase directly. For a team of 20 users refreshing dashboards, this means dozens of identical Supabase queries per minute for data that changes infrequently.

**Fix:** Add Next.js route segment configs and cache headers for read-heavy endpoints:

```typescript
// For rarely-changing data (permissions, team, project lists):
export const dynamic = 'force-static'
export const revalidate = 60  // revalidate every 60 seconds

// For read-heavy but mutable data (defects, photos, daily-logs):
export const revalidate = 10  // 10-second stale-while-revalidate

// For real-time-sensitive data (attendance, notifications):
export const dynamic = 'force-dynamic'  // always fresh (explicit opt-in)
```

Additionally, add `Cache-Control` headers for Supabase signed URLs:

```typescript
// Signed URLs have their own expiry; cache the response aggressively
response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
```

---

### H3. `upload-schema/route.ts` Has No Rate Limiting

**File:** `web/app/api/upload-schema/route.ts:12`
**Impact:** `upload/route.ts` has rate limiting (30 uploads per 60 seconds per user), but `upload-schema/route.ts` has none. An attacker could flood schema uploads to exhaust Supabase storage quota or cause excessive storage bills.

**Fix:** Add the same rate limit pattern used in `upload/route.ts`:

```typescript
const rateLimitKey = `upload-schema:${user.id}`
const rateLimit = checkRateLimit(rateLimitKey, { limit: 10, windowMs: 60 * 1000 })
if (!rateLimit.success) {
  return rateLimitResponse(rateLimit, 'Премногу барања за прикачување шеми.')
}
```

---

### H4. Photo Upload Filename Collision

**File:** `web/app/api/upload/route.ts:77`
**Code:** `const fileName = \`${user.id}/${projectId}/${Date.now()}.jpg\``
**Impact:** Two uploads by the same user to the same project within the same millisecond produce the same filename. The second upload silently overwrites the first in Supabase Storage, but a `photos` row is created for both — the first row's `image_url` now points to the second upload's content.

**Fix:** Append a random suffix:

```typescript
const fileName = `${user.id}/${projectId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`
```

---

### H5. Label Filtering Trigger Serial N+1 Query Chain

**Files:** `photos/route.ts:69-91`, `defects/route.ts:51-73`, `daily-logs/route.ts:28-50`, `work-orders/route.ts` (same pattern)
**Impact:** Every label-filtered query triggers 3 serial database round trips:
1. `labels` table — lookup label IDs from slugs
2. `taggings` table — lookup taggable IDs from label IDs
3. Main query — filter by taggable IDs

On a project with 10 label slugs, this is 3 queries where a single join or subquery would suffice. With Supabase's query builder, this could be done as:

```typescript
// Single query with subselect
const { data } = await admin
  .from('photos')
  .select('*')
  .eq('project_id', projectId)
  .in('id', admin.rpc('get_tagged_ids', {
    p_taggable_type: 'photo',
    p_label_slugs: slugs
  }))
```

Or a PostgreSQL function:

```sql
CREATE OR REPLACE FUNCTION get_tagged_ids(
  p_taggable_type text,
  p_label_slugs text[]
) RETURNS SETOF uuid AS $$
  SELECT t.taggable_id
  FROM taggings t
  JOIN labels l ON l.id = t.label_id
  WHERE t.taggable_type = p_taggable_type
    AND l.slug = ANY(p_label_slugs)
$$ LANGUAGE sql STABLE;
```

---

### H6. `resolveProjectTz` Does 3 Serial DB Queries

**File:** `web/app/api/attendance/route.ts:27-54`
**Impact:** Every `today=true` attendance query triggers 3 serial lookups:
1. `projects` → get `timezone` and `user_id`
2. `profiles` → get `company_name`
3. `companies` → get `timezone`

**Fix:** Consolidate into a single query using Supabase's `select` with foreign key joins:

```typescript
const { data } = await admin
  .from('projects')
  .select('timezone, profiles!inner(company_name, companies!inner(timezone))')
  .eq('id', projectId)
  .single()
```

Or cache the timezone per project (it never changes at runtime):

```typescript
// In-memory TTL cache for project timezones
const tzCache = new Map<string, { tz: string; expiry: number }>()

async function resolveProjectTz(db: SupabaseClient, projectId: string): Promise<string> {
  const cached = tzCache.get(projectId)
  if (cached && cached.expiry > Date.now()) return cached.tz
  // ... existing 3-query logic ...
  tzCache.set(projectId, { tz: result, expiry: Date.now() + 3600_000 })
  return result
}
```

---

## MEDIUM — Fix Within First Month

### M1. Inconsistent Response Formats

**Files:** `upload/route.ts`, `upload-schema/route.ts`
**Impact:** All 33 other route handlers use `successResponse()`/`errorResponse()` from `lib/api/errors.ts`, producing `{ data, error }` shapes. The two upload handlers use raw `NextResponse.json()` directly:

```typescript
// upload/route.ts:30 — raw format
return NextResponse.json({ error: 'Missing file' }, { status: 400 })

// All other routes — consistent format
return errorResponse('Missing file', 400)
return successResponse(data)
```

**Fix:** Refactor upload handlers to use `successResponse()`/`errorResponse()` for consistent API surface.

---

### M2. Schema Uploads Skip Image Compression

**Files:** `upload/route.ts:76` vs `upload-schema/route.ts:63-65`
**Impact:** Photo uploads compress images via `compressImage()` before storage. Schema uploads pass raw file bytes directly to storage. Construction drawings and blueprints can be 10-20MB uncompressed. This wastes storage and increases download times.

**Fix:** Apply `compressImage()` (or a format-appropriate compression for PDFs) before upload.

---

### M3. Hardcoded Notification Limits Without Offset

**Files:** `notifications/route.ts:27` (limit 30), `projects/[id]/notifications/route.ts:37` (limit 50)
**Impact:** Users cannot paginate through older notifications. Once a user accumulates >30 (or >50) notifications, older ones are permanently invisible.

**Fix:** Add offset/limit pagination or implement a "mark as read" + cursor pattern.

---

### M4. `audit-logs/POST` Allows Any Authenticated User to Forge Entries

**File:** `web/app/api/audit-logs/route.ts:68-129`
**Impact:** Any authenticated user can POST to `/api/audit-logs` to create audit entries. While there's a project-access check and action/entity whitelisting, any user can create entries like `USER_LOGIN` or `DEFECT_CREATED` attributed to themselves for any project they have access to. The audit trail can't be fully trusted.

**Fix:** Consider restricting POST to admin/site_manager roles only, or adding server-side attribution (always set `user_id` from the session, never from the request body — which is already done, but the user can still create arbitrary actions).

---

### M5. Attendance Check-In Has No Duplicate Prevention

**File:** `web/app/api/attendance/route.ts:116-131`
**Impact:** Nothing prevents a user from checking in multiple times to the same project in the same day. There's no uniqueness constraint on `(project_id, user_id, date)`.

**Fix:** Before insert, check for an existing open (no `check_out`) attendance log:

```typescript
const { data: openLog } = await admin
  .from('attendance_logs')
  .select('id')
  .eq('project_id', projectId)
  .eq('user_id', user.id)
  .is('check_out', null)
  .single()

if (openLog) {
  return errorResponse('Already checked in. Check out first.', 409)
}
```

---

### M6. Missing `order_by` Consistency on Some Endpoints

**Files:** `projects/[id]/members/route.ts`, `projects/[id]/comments/route.ts`
**Impact:** Some list endpoints don't specify `.order()`, relying on database default ordering. This means the response order can change unpredictably across deployments or after table maintenance.

**Fix:** Add explicit `.order()` to all list queries.

---

### M7. `photos/route.ts` GET — Mixed Client Usage for Signed URLs

**File:** `web/app/api/photos/route.ts:96-98`
**Impact:** In the no-projectId path (line 51), `getSignedUrls` uses `admin` (service_role). In the projectId path (line 96), it uses `supabase` (cookie-based). This inconsistency is benign (both can sign URLs for accessible resources) but makes the security model harder to reason about.

**Fix:** Standardize on one client for signed URL generation. Both work, but consistency reduces cognitive load.

---

## LOW — Nice-to-Have Improvements

### L1. No Global Request Body Size Limit

**Impact:** While upload routes validate file size (20MB), non-upload routes accept arbitrarily large JSON payloads. A malicious POST with a 100MB JSON body to `/api/defects` would be parsed in memory before Zod rejects it.

**Fix:** Add body size middleware or configure Next.js body size limits:

```typescript
// next.config.js
serverExternalPackages: [],  // ensure no body size bypass
// Or in middleware: reject Content-Length > 1MB for non-upload routes
```

---

### L2. Macedonian-Only Error Messages Without i18n

**Files:** All route handlers
**Impact:** Error messages like `"Немате пристап до логовите на аудитот"` are hardcoded in Macedonian. This works for the current Macedonian-only user base but prevents internationalization and makes automated error handling/monitoring harder (can't pattern-match on English error codes).

**Fix:** Return structured error codes alongside human messages:

```typescript
return forbiddenResponse('AUDIT_LOGS_FORBIDDEN', 'Немате пристап до логовите на аудитот')
// Client can map code → localized message
```

---

### L3. No CORS Headers on API Routes

**Impact:** All API routes rely on same-origin browser security. If the API is ever accessed cross-origin (mobile app, partner integration), requests will be blocked by CORS.

**Fix:** Add CORS headers in middleware for `/api/*` when cross-origin access is needed.

---

### L4. `work-orders/[workOrderId]/defects/route.ts` — Unbounded Query

**File:** `web/app/api/work-orders/[workOrderId]/defects/route.ts:45`
**Impact:** `.select('*')` with no limit. A work order with many defects returns all of them. Lower risk since work orders typically have few defects.

---

### L5. Error Message Leaks Database Internals in Some Paths

**Files:** Various route handlers
**Impact:** Some error responses pass through `error.message` from Supabase directly:

```typescript
if (error) return errorResponse(error.message, 500)
```

Supabase error messages can contain column names, table names, and constraint names. In production, these should be generic:

```typescript
if (error) {
  console.error('DB error:', error)
  return errorResponse('Internal server error', 500)
}
```

---

## Positive Findings — What's Done Well

These represent significant improvements over the July 2026 audit:

| Area | Status | Evidence |
|------|--------|----------|
| Auth enforcement | ✅ Every handler | All 35 handlers start with `requireAuth()` |
| Project access control | ✅ Consistent | `requireProjectAccess()` / `requireProjectMutate()` on all relevant endpoints |
| Company scoping | ✅ Dashboard queries | `getCompanyContext()` + `getAccessibleProjectIds()` on cross-project queries |
| Zod validation | ✅ All mutations | `validateBody()` wraps every POST/PATCH/DELETE with schema validation |
| Mass-assignment prevention | ✅ PATCH endpoints | `filterAllowedFields()` on daily-logs and pins updates |
| Audit trail integrity | ✅ Server-side | Action/entity whitelists enforced server-side, metadata capped at 8KB |
| Photo storage security | ✅ Signed URLs | Storage paths stored, signed URLs generated on read, not public URLs |
| Schema path validation | ✅ `isProjectSchemaPath()` | P1-1 mitigation: only signs URLs for schemas belonging to the queried project |
| Taggings scoping | ✅ `project_id` resolution | P1-10 mitigation: taggings resolve through taggable's project, not tag ownership |
| Non-admin null ctx fix | ✅ P2-3 addressed | `audit-logs/route.ts:45-47` returns `[]` when non-admin has no company |
| Attendance ownership | ✅ P2-5 addressed | Check-out verifies `user_id === session.id` before update |
| Storage client separation | ✅ Upload vs read | Uploads use cookie client (RLS-active), reads use admin for signing |
| Plan limits enforcement | ✅ DB trigger | `upload/route.ts:108` handles `PLAN_LIMIT_EXCEEDED` from `enforce_plan_limits` trigger |
| Rate limiting on uploads | ✅ Per-user/IP | 30 uploads per 60 seconds, key includes user ID and client IP |

---

## Summary Matrix

| Category | Score | Notes |
|----------|-------|-------|
| Authentication | 7/10 | Works but no middleware safety net |
| Authorization | 8/10 | Manual checks correct; no RLS defense-in-depth |
| Input Validation | 8/10 | Zod on mutations; upload-schema skips rate limiting |
| Pagination | 3/10 | 2 of 12+ list endpoints have pagination |
| Caching | 1/10 | Zero cache directives across 35 handlers |
| Data Minimization | 3/10 | Universal `select('*')` — all columns returned |
| N+1 / Performance | 5/10 | Label filtering + timezone resolution are serial |
| Error Handling | 7/10 | Consistent pattern; upload routes inconsistent; DB errors leak internals |
| API Design | 7/10 | RESTful; missing pagination totals; inconsistent response shape on uploads |

**Overall: 72/100 — CONDITIONALLY PRODUCTION READY**

The three CRITICAL items (middleware, select('*), admin client reliance) should be addressed before launch. The HIGH items (pagination, caching, rate limiting) should be addressed in the first sprint post-launch. MEDIUM and LOW items can be addressed iteratively.

---

## Prior Audit Items — Status

| Prior Finding | Status |
|---------------|--------|
| #1 — Monolithic `/api/db` proxy | ✅ REMOVED — replaced with 35 per-resource routes |
| #2 — RLS bypass via service_role | ⚠️ PARTIAL — admin client still used; manual auth checks in place |
| #3 — console.error→monitoring | ✅ FIXED |
| #9а — audit.ts | ✅ FIXED |
| P1-1 — Schema image path validation | ✅ FIXED — `isProjectSchemaPath()` check |
| P1-10 — Taggings project scoping | ✅ FIXED — resolves through taggable |
| P2-3 — Non-admin null ctx | ✅ FIXED — returns `[]` |
| P2-5 — Attendance ownership | ✅ FIXED — ownership check on check-out |
