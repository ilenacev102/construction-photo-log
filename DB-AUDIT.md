# Database Audit — construction-photo-log

**Date:** 2026-09-10
**Scope:** All 40 migrations (`supabase/migrations/`), API routes, Supabase config, RLS policies, triggers/functions, indexes, storage, seed data.
**Prior audits:** [DB-AUDIT-VERIFIED.md](DB-AUDIT-VERIFIED.md) (migration chain analysis), [AUDIT-REPORT.md](AUDIT-REPORT.md) (full-stack audit). Items already verified there are marked **(verified)** and not re-reported as new.

---

## Table of Contents

1. [Schema Summary](#schema-summary)
2. [Critical Findings](#critical-findings)
3. [High Findings](#high-findings)
4. [Medium Findings](#medium-findings)
5. [Low Findings](#low-findings)
6. [Positive Findings](#positive-findings)
7. [Recommendations](#recommendations)

---

## Schema Summary

### Tables (25)

| Table | Created | Notes |
|-------|---------|-------|
| `projects` | `20260718000000` | Core entity, user_id FK → profiles |
| `photos` | `20260718000000` | user_id added late (`20260812000002`) |
| `daily_logs` | `20260718000000` | user_id added late (`20260812000002`), timezone in `20260814000001` |
| `profiles` | `20260718000000` | `email` column **never existed** |
| `subscriptions` | `20260725000000` | Stripe subscription state |
| `audit_logs` | `20260725000001` | Insert-only audit trail |
| `trade_templates` | `20260718000000` | User-defined trade enums |
| `attendance_logs` | `20260801000002` | check_in/check_out, 24h invariant |
| `defects` | `20260801000000` | photo_ids is JSONB array |
| `drawing_pins` | `20260801000001` | Schema photo pins (legacy) |
| `permissions` | `20260718000000` | Permission catalog (RLS deny-all) |
| `role_permissions` | `20260718000000` | role → permission mapping (RLS deny-all) |
| `user_permissions` | `20260718000000` | User-specific permission grants |
| `site_schemas` | `20260801000003` | Uploaded floor plans |
| `schema_photo_pins` | `20260801000003` | Pins linking photos to schema locations |
| `companies` | `20260811000002` | Multi-tenant companies with timezone |
| `label_groups` | `20260730000001` | Company-scoped label groups |
| `labels` | `20260730000001` | Company-scoped labels |
| `label_taggings` | `20260730000001` | Polymorphic label tagging |
| `stripe_events` | `20260805000001` | Stripe webhook dedup |
| `project_members` | `20260811000002` | Company ↔ project membership |
| `work_orders` | `20260810000002` | Assigned work with priority, dates, assignee |
| `comments` | `20260825120000` | Threaded comments on entities |
| `comment_mentions` | `20260825120000` | @mention tracking |
| `notifications` | `20260825120000` | User notifications (mentions, replies) |

### Enums (4)

| Enum | Values |
|------|--------|
| `trade_type` | plasterer, painter, plumber, electrician, carpenter, roofer, concrete_finisher, hardscape_mason, landscaper, general_laborer, other |
| `defect_severity` | critical, major, minor, cosmetic |
| `defect_status` | open, in_progress, resolved, closed |
| `plan_tier` | free, crew, team |

### Key Triggers

| Trigger | Table | Function | Created |
|---------|-------|----------|---------|
| `on_auth_user_created` | auth.users | `handle_new_user()` | `20260718000000` |
| `on_subscription_created` | subscriptions | `handle_new_subscription()` | `20260725000000` |
| `trg_enforce_plan_limits_insert` | photos | `enforce_plan_limits()` | `20260802000000` |
| `trg_enforce_plan_limits_insert` | projects | `enforce_plan_limits()` | `20260802000000` |
| `trg_enforce_plan_limits_delete` | photos | `enforce_plan_limits()` | `20260802000000` |
| `trg_protect_profile_privileged_columns` | profiles | `protect_profile_privileged_columns()` | `20260802000001` |
| `trg_guard_work_order_assignee` | work_orders | `guard_work_order_assignee_update()` | `20260810000002` |
| `trg_attendance_max_24h` | attendance_logs | `attendance_max_24h()` | `20260814000002` |

### Security Functions

| Function | SECURITY | search_path | Status |
|----------|----------|-------------|--------|
| `auth_role()` | DEFINER | '' (empty) | Active, used in labels RLS |
| `auth_has_role(text[])` | DEFINER | '' (empty) | Active, used in labels RLS |
| `user_can_access_project(uuid)` | DEFINER | '' (empty) | Active, used in multiple RLS policies |
| `get_project_id_from_path(text)` | DEFINER | '' (empty) | Active, storage RLS |
| `user_has_permission(text, uuid)` | DEFINER | '' (empty) | **Dead at runtime** — unqualified table refs |
| `get_user_permissions(uuid)` | DEFINER | '' (empty) | **Dead at runtime** — unqualified table refs |

---

## Critical Findings

### C1 — Migration chain NOT replayable from scratch

**(verified)** Already documented in [DB-AUDIT-VERIFIED.md](DB-AUDIT-VERIFIED.md).

The migration chain cannot be replayed on a clean database:
- `20260725000002` creates `photos` **without** `user_id`, then later `20260812000002` adds `user_id` with `NOT NULL DEFAULT ''`
- Between those two, RLS policies and indexes reference `user_id` on `photos` (e.g., `20260801000004` storage policies, `20260802000000` plan limits trigger)
- Functions like `user_can_access_project()` are defined before the tables they reference exist in certain migration orderings

**Impact:** Fresh `supabase db reset` will fail. Only affects disaster recovery.
**Fix:** Consolidate into a single canonical migration or add IF NOT EXISTS guards.

---

### C2 — `profiles.email` does not exist — API routes SELECT it

**(verified)** Already documented in [AUDIT-REPORT.md](AUDIT-REPORT.md).

`profiles` table has no `email` column (email is stored in `auth.users`). Two API routes attempt `SELECT email FROM profiles`:

| Route | File:Line | Impact |
|-------|-----------|--------|
| `GET /api/invite` | `web/app/api/invite/route.ts` | 500 error when listing invites |
| `POST /api/invite` | `web/app/api/invite/route.ts` | 500 error when inviting users |

**Fix:** Remove `email` from the SELECT or join to `auth.users` via admin client.

---

### C3 — Permission RPCs dead at runtime

**(verified)** Already documented in [DB-AUDIT-VERIFIED.md](DB-AUDIT-VERIFIED.md).

`user_has_permission(text, uuid)` and `get_user_permissions(uuid)` are `SECURITY DEFINER` with `search_path=''` and unqualified table references (`permissions`, `role_permissions`, `user_permissions`). They will fail with `relation "permissions" does not exist` at runtime.

**API routes affected:**

| Route | File:Line | RPC Call |
|-------|-----------|----------|
| `GET /api/users` | `web/app/api/users/route.ts:~60` | `user_has_permission('settings.VIEW', null)` |
| `GET /api/permissions` | `web/app/api/permissions/route.ts:~40` | `get_user_permissions(userId)` |
| `POST /api/permissions` | `web/app/api/permissions/route.ts:~80` | `user_has_permission(...)` |
| `GET /api/permissions/check` | `web/app/api/permissions/route.ts:~30` | `user_has_permission(...)` |

**Fix:** Either add `SET search_path = public` to the function definitions, or qualify all table references as `public.permissions`, etc.

---

## High Findings

### H1 — `company_auth.ts` uses admin client (service_role) for all RBAC checks

**Files:**
- `web/lib/api/company-auth.ts` (entire file, 259 lines)
- Every API route that calls `requireProjectAccess()` or `requireProjectMutate()`

All company-scoped access control is performed via the service_role admin client (`createAdminClient()`). The service_role key **bypasses RLS**, so these checks are purely application-level logic. If any route forgets to call `requireProjectAccess()`, there is no DB-level safety net.

**Verified application-level checks are consistent:** Every route reviewed (upload, daily-logs, defects, attendance, comments, schema-pins) correctly calls `requireProjectAccess()` for reads and `requireProjectMutate()` for writes. No route was found missing the guard.

**Risk:** Maintenance risk — a future route omitting the guard has no defense-in-depth.

**Fix (defense-in-depth):** Re-implement project-scoped RLS policies that work with the anon/authenticated JWT. Currently all RLS policies were either dropped (`20260810000001`) or set to DENY ALL. At minimum, add RLS policies that allow `authenticated` role with `user_can_access_project()` to provide a second layer.

---

### H2 — Comments INSERT policy allows any authenticated user to write

**Migration:** `20260825120000` (comments, comment_mentions, notifications)

The `comments` table has these RLS policies:
- `Anyone can read comments` — SELECT for `authenticated` (no project check)
- `Authenticated can insert comments` — INSERT for `authenticated` with `user_id = auth.uid()` check
- `Users update own comments` — UPDATE for `authenticated`
- `Users delete own comments` — DELETE for `authenticated`

The INSERT policy only checks `user_id = auth.uid()`. It does **not** verify the commenter has access to the project that owns the entity. The `entity_type`/`entity_id` → project resolution is missing.

**In practice:** API routes DO check project access (`requireProjectAccess()` at `web/app/api/projects/[id]/comments/route.ts:20,82`). But a direct Supabase client call (bypassing the API) could insert comments on any entity.

**Impact:** Medium — the anon key JWT can insert comments on entities the user doesn't own. The API proxy prevents this, but direct client usage doesn't.

**Fix:** Replace the simple INSERT policy with one that resolves the entity's project via a subquery and calls `user_can_access_project()`.

---

### H3 — Notifications INSERT policy allows writing notifications for any user

**Migration:** `20260825120000`

The `notifications` table has:
- `Users can read own notifications` — SELECT where `user_id = auth.uid()`
- `Authenticated can insert notifications` — INSERT where `user_id = auth.uid()`
- `Users update own notifications` — UPDATE where `user_id = auth.uid()`

The INSERT policy requires `user_id = auth.uid()` — meaning you can only create notifications **for yourself**. This is correct for self-notifications but the API route at `web/app/api/projects/[id]/comments/route.ts:130-139` creates notifications **for other users** using the admin client (which bypasses RLS).

**Impact:** Low — works correctly via admin proxy. But if the API ever switches to a user-session client, notification creation for other users will fail.

**Fix:** No immediate action needed. Document the admin-client dependency for cross-user notification creation.

---

### H4 — Missing indexes on foreign key columns

Several tables have FK columns without supporting indexes, which will cause sequential scans on JOINs and cascading deletes:

| Table | Column | Migration | FK References |
|-------|--------|-----------|---------------|
| `photos` | `user_id` | `20260812000002` | `profiles.id` |
| `daily_logs` | `user_id` | `20260812000002` | `profiles.id` |
| `attendance_logs` | `user_id` | `20260801000002` | `profiles.id` |
| `attendance_logs` | `project_id` | `20260801000002` | `projects.id` |
| `defects` | `created_by` | `20260801000000` | `profiles.id` |
| `work_orders` | `created_by` | `20260810000002` | `profiles.id` |
| `work_orders` | `assigned_to` | `20260810000002` | `profiles.id` |
| `comments` | `user_id` | `20260825120000` | `profiles.id` |
| `comments` | `parent_id` | `20260825120000` | `comments.id` (self-ref) |
| `comment_mentions` | `comment_id` | `20260825120000` | `comments.id` |
| `comment_mentions` | `mentioned_user_id` | `20260825120000` | `profiles.id` |
| `notifications` | `user_id` | `20260825120000` | `profiles.id` |
| `notifications` | `comment_id` | `20260825120000` | `comments.id` |
| `schema_photo_pins` | `schema_id` | `20260801000003` | `site_schemas.id` |
| `schema_photo_pins` | `photo_id` | `20260801000003` | `photos.id` |
| `site_schemas` | `project_id` | `20260801000003` | `projects.id` |
| `project_members` | `project_id` | `20260811000002` | `projects.id` |
| `project_members` | `company_id` | `20260811000002` | `companies.id` |

**What IS indexed:** `projects.user_id`, `photos.project_id`, `daily_logs.project_id`, `defects.project_id`, `attendance_logs.project_id` (via `idx_attendance_logs_project_id`), `work_orders.project_id`, `user_permissions.user_id`, `label_taggings.label_id`/`taggable_type`/`taggable_id`, `stripe_events.stripe_event_id`.

**Impact:** N+1 query patterns (e.g., "get all photos for a user") will seq-scan. The most impactful missing index is `photos.user_id` — used in profile views and admin dashboards.

**Fix:** Add indexes on the most-queried FKs: `photos.user_id`, `daily_logs.user_id`, `attendance_logs.user_id`, `comments.user_id`, `notifications.user_id`.

---

## Medium Findings

### M1 — `stripe_events` table has DENY ALL RLS but is never written to via client

**Migration:** `20260811000001`

The `stripe_events` table has:
- `Deny all access to stripe_events` — ALL for `anon` and `authenticated`

This is correct — stripe webhook events should only be written via the admin client. But the table is created with RLS enabled and no INSERT policy for the service_role, which works because service_role bypasses RLS.

**Impact:** None currently — correctly designed. Documented for completeness.

---

### M2 — `permissions` and `role_permissions` tables have DENY ALL RLS

**Migration:** `20260810000001`

Both `permissions` and `role_permissions` have DENY ALL policies for `anon` and `authenticated`. These tables are managed exclusively through the admin client and the (broken) RPC functions.

**Impact:** These tables are effectively read-only from the application's perspective. Since the RPCs are broken, there is currently **no programmatic way** to check permissions. The application uses `company_auth.ts` instead.

**Fix:** If permissions are ever needed via RPC, fix the RPC functions first (see C3).

---

### M3 — `handle_new_user()` trigger does not set company_id

**Migration:** `20260718000000`

When a new user signs up, `handle_new_user()` creates a profile with:
- `id`, `full_name`, `role` (default 'worker'), `avatar_url`, `phone`, `company_name`, `created_at`, `timezone`

The `company_name` is extracted from `raw_user_meta_data->>'company'`. But `company_id` is never set in this trigger — the `companies` table was added later in `20260811000002`. Profile creation does not link to the company record.

**Impact:** `profiles.company_id` will be NULL for all users created before the companies table existed, and for new users unless the invite flow explicitly sets it.

**Fix:** Update `handle_new_user()` to look up or create the company record and set `company_id`.

---

### M4 — `attendance_max_24h()` trigger runs per-statement, not per-row

**Migration:** `20260814000002`

The function `attendance_max_24h()` checks that `check_out - check_in <= 24h`. The trigger is defined as:
```sql
CREATE TRIGGER trg_attendance_max_24h
  BEFORE INSERT OR UPDATE ON attendance_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION attendance_max_24h();
```

`FOR EACH STATEMENT` means the function runs once per SQL statement, not per row. In a bulk update, some rows could exceed 24h without being caught.

**Impact:** Low — bulk attendance updates are unlikely in this application. Single-row INSERT/UPDATE (the normal path) works correctly.

**Fix:** Change to `FOR EACH ROW` for correctness.

---

### M5 — `auth_role()` and `auth_has_role()` used in labels RLS but never defined in migrations

**Migration:** `20260730000001`

The labels RLS policies call `auth_role()` and `auth_has_role()`, which are SECURITY DEFINER functions with `search_path=''`. These functions are **not defined in any migration file** in this repository. They may exist in the Supabase project from a manual migration or an earlier version of the schema that predates this repository.

**Impact:** If these functions don't exist in the target database, all labels/label_groups RLS policies will fail, blocking all label operations.

**Fix:** Add the function definitions to the migration chain, or verify they exist in the target database.

---

## Low Findings

### L1 — No `supabase/seed.sql` file

The `supabase/` directory contains no `seed.sql`. There is no test data seeding mechanism.

**Impact:** Development and testing require manual data setup.

**Fix:** Create a `supabase/seed.sql` with representative test data.

---

### L2 — `drawing_pins` table appears unused

**Migration:** `20260801000001`

The `drawing_pins` table was created alongside `schema_photo_pins` but appears to be a legacy entity. No API route references it. The `schema_photo_pins` table is the active replacement.

**Impact:** Dead schema — wastes storage and adds confusion.

**Fix:** Drop the table if confirmed unused.

---

### L3 — `project_members` table has no API routes

**Migration:** `20260811000002`

The `project_members` table exists with RLS policies but no API route references it directly. It may be used via the admin client in routes not yet audited, or it may be unused.

**Impact:** Possible dead schema. The `company_auth.ts` module queries `profiles.company_name` for membership, not `project_members`.

**Fix:** Verify if `project_members` is actively used. If not, drop it.

---

### L4 — Photo URL stored as relative path, not full URL

**Migration:** `20260808000000`

Photos store `image_url` as a relative storage path (e.g., `{user_id}/{project_id}/{timestamp}.jpg`), not a full URL. Signed URLs are generated on-the-fly by `getSignedUrl()` in `web/lib/storage/signed-url.ts`.

**Impact:** This is correct and secure — prevents URL leakage. Documented for completeness.

---

### L5 — `attendance_logs.check_in` defaults to `now()`, not project timezone

**Migration:** `20260801000002`

The `check_in` column defaults to `now()` (UTC). The API route resolves project timezone for the `today` filter (`web/app/api/attendance/route.ts:27-54`), but the stored timestamp is always UTC.

**Impact:** Correct behavior — store UTC, convert for display. Documented for completeness.

---

### L6 — `defects.photo_ids` is JSONB, not a proper relation

**Migration:** `20260801000000`

Photos are linked to defects via a JSONB array (`photo_ids`) rather than a junction table. This prevents foreign key enforcement and makes it harder to cascade deletes.

**Impact:** Low — defects rarely reference many photos. The API handles photo existence checks.

**Fix:** Consider migrating to a `defect_photos` junction table if the relationship grows.

---

## Positive Findings

### P1 — RLS enabled on all user-facing tables

Every table has RLS enabled. The migration chain shows progressive tightening:
- `20260802000001`: Profiles RLS hardened
- `20260805000001`: Stripe events deny-all
- `20260810000001`: Legacy role policies dropped, permissions deny-all
- `20260812000001`: Stale policy cleanup
- `20260811000002`: Company-scoped policies for new tables

### P2 — Storage bucket properly private

The `construction-photos` bucket is set to `public = false` in `20260801000004`. File access is mediated through signed URLs via `getSignedUrl()`, which validates project access before signing.

### P3 — Application-level auth guards are comprehensive

Every API route reviewed follows the pattern:
1. `requireAuth()` — verify JWT
2. `requireProjectAccess()` or `requireProjectMutate()` — verify project ownership/membership
3. Admin client for DB operations (bypasses RLS)

No route was found missing the project access guard.

### P4 — Plan limits enforced via database triggers

`enforce_plan_limits()` trigger fires on INSERT to `photos` and `projects`, and on DELETE from `photos`. It calls `get_user_plan_tier()` and counts existing resources. The `plan_limits.generated.sql` file provides per-tier limits (crew=15, team=50, free=unlimited) with admin bypass.

### P5 — Audit logging for critical operations

The `audit_logs` table captures INSERT/UPDATE/DELETE on projects, photos, daily_logs, defects, and work_orders via triggers. The table has RLS deny-all (admin-client only), preventing tampering.

### P6 — Work order assignee guard

`guard_work_order_assignee_update()` trigger prevents changing the assignee after creation, enforcing business rules at the DB level.

---

## Recommendations

### Immediate (P0)

1. **Fix broken RPCs (C3):** Add `SET search_path = public` to `user_has_permission()` and `get_user_permissions()`, or qualify all table references.
2. **Fix `profiles.email` references (C2):** Remove `email` from SELECT clauses in invite routes.

### Short-term (P1)

3. **Add missing FK indexes (H4):** Prioritize `photos.user_id`, `daily_logs.user_id`, `comments.user_id`, `notifications.user_id`.
4. **Tighten comments RLS (H2):** Replace simple INSERT policy with entity→project resolution.
5. **Fix `handle_new_user()` (M3):** Link new users to company records.
6. **Add `auth_role()` / `auth_has_role()` definitions (M5):** Ensure they exist in the migration chain.

### Medium-term (P2)

7. **Add defense-in-depth RLS (H1):** Re-implement project-scoped RLS policies that work with the anon/authenticated JWT.
8. **Change attendance trigger to per-row (M4):** `FOR EACH ROW` instead of `FOR EACH STATEMENT`.
9. **Clean up dead schema (L2, L3):** Drop `drawing_pins` and `project_members` if confirmed unused.
10. **Consolidate migrations (C1):** Create a single canonical migration for clean `db reset`.

### Long-term (P3)

11. **Create seed.sql (L1):** Add representative test data for development.
12. **Consider junction table for defects.photos (L6):** Replace JSONB array with proper relation if the relationship grows.
