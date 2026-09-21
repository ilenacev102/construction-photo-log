# Final Security Audit — Production Release Certification

**Date:** 2026-07-31
**Auditor:** Sisyphus (read-only, independent re-verification)
**Target:** `/home/nac/Projects/construction-photo-log/web` — Next.js 16.2.11 + React 19 + Supabase + Stripe
**Method:** Full static re-audit of all 27 API routes (27/27), all 21 migrations, storage layer, hooks, and shared libs. Every claim below was verified against current source with file:line evidence. No runtime DB access available (`DATABASE_URL` unset) — runtime-dependent severities are flagged.
**Prior reports:** `AUDIT_REPORT.md`, `AUDIT-REPORT.md` — used only as the claim baseline for §4; several of their findings are already fixed, several remain.

---

## 1. Executive Summary

The architecture has improved substantially since the prior audits: the 948-line `/api/db` service-role god route is gone, replaced by 27 dedicated routes; every route authenticates the caller; most project-scoped routes call `requireProjectAccess` before touching data; the auth callback open-redirect is fixed; `server.ts` uses the modern cookie-handling pattern; `lang="mk"` and the PhotoLightbox locale hardcodes are fixed; uploads store raw storage paths (never public URLs); `lib/supabase/queries.ts` is 100% parameterized through API routes with zero raw SQL; no `execSync` remains in app code; `.env.local` is clean.

**However, the application is NOT ready for production release.** Three critical (P0) and ten high (P1) findings block it:

1. **P0 — DB-level privilege self-escalation.** The `profiles` UPDATE RLS policy (`20260725000004:22-25`) lets any authenticated user set their own `role='admin'` and `company_name` directly via PostgREST. This silently defeats every `isAdminUser` check, the `requireProjectAccess` admin bypass, and the company-scoping model across the whole app.
2. **P0 — Audit-log forgery.** `audit-logs` POST has no authorization and writes client-supplied fields, and the RLS INSERT policy now allows any authenticated user (`20260730000002:78-82`). The compliance/forensics record is forgeable via both the route and raw PostgREST.
3. **P0 — The permission system is dead at runtime.** `get_user_permissions` / `user_has_permission` (`20260725000012:173-236`) are `SECURITY DEFINER SET search_path = ''` with **unqualified** table references → they raise `relation "profiles" does not exist`. `users` PATCH and `permissions` POST fail closed (403 for everyone — user management broken), `permissions` GET silently returns empty lists, and `admin.audit` revocations are ineffective. The real authorization gate everywhere is raw `role` strings.
4. **P1 — Storage bucket is public.** `construction-photos` was created with `public = true` (`20260724000003:2-4`) and `20260729000001` never flips it (verified: no `update storage.buckets` in any migration). All signed-URL work is cosmetic; any leaked object path is permanently readable without authentication, bypassing storage RLS.
5. **P1 — Server-side SSRF in the report route.** `fetch(signedUrl)` (`report/route.ts:45-46`) plus the `getSignedUrl` fallback that returns the raw attacker-controlled `image_url` (`signed-url.ts:56-63`), reachable because the photos INSERT policy allows project members to store arbitrary `image_url` text.
6. **P1 — Billing is broken.** The webhook's `checkout.session.completed` upserts a subscription without a `plan`, and `customer.subscription.updated` (the only writer of `plan`) runs before it — every new paid subscriber stays on `free`.
7. **P1 — App-layer authorization holes** (7 distinct): read-only `project.VIEW.*` grants authorize mutations (S1); company-less users leak all companies' data in two dashboard GETs (S2); mass assignment in `daily-logs`/`pins` PATCH (S3); unscoped cross-tenant GETs on `taggings`/`labels/items` (S4); cross-company grant issuance in `permissions` POST; unscoped RLS writes on `drawing_pins` and `attendance_logs`; cross-company PII roster in `team` GET and email enumeration in `invite` `getAvailableUsers`.

**Verdict: DO NOT RELEASE.** Fix P0-1→P0-3 and P1-1→P1-4 first (they unblock or re-scope most other findings), then P1-5→P1-10, then the P2 cluster.

---

## 2. Findings Table

| ID | Sev | Location | Issue |
|---|---|---|---|
| P0-1 | **Critical** | `supabase/migrations/20260725000004_create_user_profiles.sql:22-25` | `profiles` UPDATE RLS policy row-scoped only — self-set `role='admin'`/`company_name` via PostgREST; defeats all admin/company checks |
| P0-2 | **Critical** | `web/app/api/audit-logs/route.ts:63-91` + `20260730000002:78-82` | Audit-log forgery: unguarded POST writes client fields; RLS INSERT relaxed to any `authenticated` |
| P0-3 | **Critical** | `supabase/migrations/20260725000012_create_permissions.sql:173-236` | Permission RPCs broken at runtime (`search_path=''` + unqualified tables) — permission gate dead, revocations ineffective |
| P1-1 | **High** | `web/app/api/report/route.ts:45-46` + `web/lib/storage/signed-url.ts:56-63` | SSRF: `fetch(signedUrl)` reaches attacker host when `getSignedUrl` falls back to raw `image_url` |
| P1-2 | **High** | `supabase/migrations/20260724000003_create_storage.sql:2-4` | Bucket `construction-photos` created PUBLIC; never flipped private — signed URLs cosmetic, storage RLS bypassed |
| P1-3 | **High** | `web/app/api/subscriptions/webhook/route.ts:85-90` | `checkout.session.completed` upserts without `plan`; subscribers stay on `free` (billing broken) |
| P1-4 | **High** | `web/app/api/permissions/route.ts` (POST) | `project.VIEW.*` grants issued without verifying caller access to the embedded projectId — cross-company grant by UUID |
| P1-5 | **High** | `20260725000008_create_pins.sql:34-44` + `web/hooks/usePins.ts:38-42,53-58,68-71` | `drawing_pins` INSERT/UPDATE/DELETE policies scoped only to `auth.uid()=user_id` — cross-tenant photo annotation |
| P1-6 | **High** | `20260725000006_create_attendance.sql:26-28` + `web/hooks/useAttendance.ts:79-81` | `attendance_logs` INSERT checks only `auth.uid()=user_id` — cross-tenant check-in writes |
| P1-7 | **High** | `web/lib/api/company-auth.ts:96-100` + all `requireProjectAccess` mutations | Read-only `project.VIEW.<id>` grants authorize POST/PATCH/DELETE on the project and resources |
| P1-8 | **High** | `web/app/api/defects/route.ts:22-25`, `web/app/api/attendance/route.ts:24-31` | Null-company users see ALL companies' data (`if (ctx && !ctx.isAdmin)` skips filter when `ctx===null`) |
| P1-9 | **High** | `web/app/api/daily-logs/route.ts:98,114`, `web/app/api/pins/route.ts:84,107` | Mass assignment: raw caller `updates` object passed to `.update()` (forge `user_id`, move `project_id`) |
| P1-10 | **High** | `web/app/api/taggings/route.ts:39-44`, `web/app/api/labels/items/route.ts:16-20` | Unscoped cross-tenant reads on anon client (no project/company scoping; no local RLS evidence) |
| P2-1 | Medium | `web/app/api/team/route.ts:28-41` | Cross-company collaborator receives owning company's full PII roster (`full_name, email, phone`) |
| P2-2 | Medium | `web/app/api/invite/route.ts:121-128` | `getAvailableUsers` enumerates ALL other-company user emails (platform-wide PII directory) |
| P2-3 | Medium | `web/app/api/users/route.ts` (PATCH) | Same-company `site_manager` can demote a same-company `admin` |
| P2-4 | Medium | `web/app/api/subscriptions/webhook/route.ts:88` | `status:'active'` set without `payment_status === 'paid'` — transient unpaid entitlement |
| P2-5 | Medium | `web/app/api/upload-schema/route.ts:26-28,63-65` | Raw attacker bytes stored with client-supplied content-type; client filename ext in storage path (amplified by P1-2) |
| P2-6 | Medium | `web/app/api/schema-pins/route.ts:94-99` | POST validates schema's project but never the photo's project — cross-company pinning |
| P2-7 | Medium | `labels/items/[id]/route.ts:42-47,75`, `labels/groups/[id]/route.ts:44-49,77` | Role-only gates, no company resolution — any site_manager mutates any company's labels/groups |
| P2-8 | Medium | `web/app/api/audit-logs/route.ts:42-44` | Company-less `site_manager` reads ALL audit logs (null-ctx unscoped) |
| P2-9 | Medium | `web/app/api/audit-logs/route.ts:21-27` | Raw role gate ignores `admin.audit` revocations in `user_permissions` |
| P3-1 | Low | All 27 routes | Zero Zod validation — `lib/validation/schemas.ts` wired only to upload/upload-schema; unvalidated UUIDs → 500s |
| P3-2 | Low | `web/lib/storage/signed-url.ts:63` | Fallback returns raw storage path → broken client rendering on signed-URL failure |
| P3-3 | Low | `invite:233-236`, `audit-logs:57-59`, `upload`, `upload-schema`, `webhook:220` | Internal error strings disclosed to clients |
| P3-4 | Low | `photos/route.ts:120`, `upload/route.ts:100-105` | Storage objects never deleted — orphan blobs accumulate |
| P3-5 | Low | `web/app/api/photos/route.ts:66-69` | `labelSlugs` matches labels across all companies (data filtered project-scoped, but resolution not company-aware) |
| P3-6 | Low | `webhook:49-55,209-214` | Idempotency dedup is TOCTOU (process-then-record) |
| P3-7 | Low | `web/lib/subscriptions/stripe.ts` | Missing `import 'server-only'`; Stripe `apiVersion` not pinned |
| P3-8 | Low | `web/lib/image/compress.ts:28-36` | No explicit pixel/dimension budget before sharp decode (memory spikes) |
| P3-9 | Low | `web/hooks/useAttendance.ts:61-72` | Any project member reads all project attendance logs incl. notes |
| P3-10 | Low | `web/app/api/report/route.ts` | No rate limit; up to 100 fetches + PDF per request (cost/DoS amplification) |
| P4-1 | Info | `20260725000005:23-25` | `trade_templates` SELECT `USING (true)` — anon-readable (catalog data only) |
| P4-2 | Info | `signed-url.ts:54`, `upload/route.ts:72` | `expiresIn` uncapped; `Date.now()`-only filename (ms-collision) |
| P4-3 | Info | `web/lib/supabase/queries.ts:21-62` | Helpers don't check `res.ok`; non-JSON errors throw |
| P4-4 | Info | `20260725000012:20-22,36-38` | `permissions`/`role_permissions` catalogs `USING (true)` — anon-readable |

---

## 3. Detailed Findings

### P0-1 — Critical: Self-service role/company escalation via `profiles` RLS

**Evidence** — `supabase/migrations/20260725000004_create_user_profiles.sql:22-25` (verified against source):
```sql
-- Users can update their own profile (except role which is admin-managed)
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```
The comment claims `role` is admin-managed, but the policy restricts only the **row**, not the **columns**. No later migration tightens it (verified: no `BEFORE UPDATE` trigger on `profiles` in any of the 21 migrations). Any browser session (anon key) can run `supabase.from('profiles').update({ role: 'admin', company_name: '<any>' }).eq('id', <own>)` and RLS permits it.

**Impact** — Makes every downstream authorization control reachable:
- `isAdminUser(ctx)` (`company-auth.ts:59-61`) and the admin bypass in `requireProjectAccess` (`:72-76`) → global stats (`stats/route.ts:15-27`), any project's photos via report, all audit-log reads.
- `company_name` self-set → cross-tenant join via string match (`company-auth.ts:32-39`) → `ctx.companyUserIds` includes victim-company users → their projects and photos become accessible.
- Found independently by two parallel audit passes (subscriptions/stats and users/permissions), then verified directly in the migration.

**Fix (any one suffices; do all):**
1. Restrict the UPDATE policy to non-privileged columns — e.g. drop the blanket policy and `GRANT UPDATE (full_name, avatar_url, phone) ON profiles TO authenticated` (leave `role`, `company_name`, `email` to server/admin only), or
2. Add a `SECURITY DEFINER SET search_path=''` trigger `BEFORE UPDATE OF role, company_name` that raises unless the caller is an admin (the `auth_has_role` helper from `20260725000014` exists and works — it has the correct `search_path='public'` and qualified refs), and
3. Verify with a raw PostgREST attempt that self-role-change returns 403.

### P0-2 — Critical: Audit-log forgery (route + RLS)

**Evidence** — `web/app/api/audit-logs/route.ts:63-91` (POST) has authentication only:
```ts
65: const supabase = await createClient()
66: const { data: { user } } = await supabase.auth.getUser()
67: if (!user) return unauthorizedResponse()
75: const admin = createAdminClient()   // service_role
78: .insert({
79:   project_id: projectId ?? null,
80:   user_id: user.id,
81:   action: auditAction,       // client-supplied
82:   entity_type: entityType,   // client-supplied
83:   entity_id: entityId ?? null,
84:   metadata: metadata ?? {},  // client-supplied
85: })
```
No role check, no permission check, no company check, no whitelist, no length caps. And the DB no longer protects this — `20260730000002_fix_rls_policies_for_anon_key.sql:78-82` (verified):
```sql
CREATE POLICY "Service role insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```
(previously service-role-only). So the audit trail — the record the GET side relies on for compliance/forensics — is forgeable both through the route and directly via PostgREST, and can be spammed to fill storage. The comments in `users/route.ts:19-21,100-102` ("audit_logs inserts only via the service role") are stale.

**Fix:** (1) revert the INSERT policy to `WITH CHECK (false)` so only service-role app code writes; (2) gate POST on `user_has_permission(user.id,'admin.audit')` **after fixing P0-3**, or a strict server-side action whitelist; (3) drop client-supplied `project_id`/`entity_id` or validate them against accessible projects; (4) cap `metadata` size.

### P0-3 — Critical: Permission RPCs broken at runtime — the permission system is dead

**Evidence** — `supabase/migrations/20260725000012_create_permissions.sql:173-236` (verified):
```sql
CREATE OR REPLACE FUNCTION get_user_permissions(target_user_id uuid)
RETURNS TABLE (permission_key text, granted boolean)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''     -- ← only pg_catalog searched
AS $$
  SELECT p.role INTO user_role FROM profiles p ...   -- ← unqualified → ERROR
  FROM role_permissions rp ...                        -- ← unqualified → ERROR
```
`SET search_path = ''` removes `public` from the search path; with no explicit qualification, every `profiles`/`role_permissions`/`user_permissions` reference raises `relation "profiles" does not exist`. The hardening migration `20260731000001:14-42` fixed this **exact pattern** for `user_can_access_project` (`SET search_path = ''` + `public.*` — verified), and `20260725000014:12-38` uses `search_path = 'public'` for `auth_role`/`auth_has_role` — the two permission RPCs were missed.

**Impact (fail-closed, but functionally dead):**
- `users` PATCH → 403 for everyone (`users/route.ts:123-130` — the `user.manage` gate always throws).
- `permissions` POST → 403 for everyone (`permissions/route.ts:93-99`).
- `permissions` GET (effective/user modes) → silently empty arrays (RPC error swallowed at `permissions/route.ts:19-23,51-52`).
- `admin.audit` revocations are ineffective — the raw-role gate in `audit-logs` ignores them (P2-9).

The claimed authorization control is not in effect; the real gate everywhere is raw `role` string checks.

**Fix:** qualify all tables as `public.*` inside both functions (mirror `20260731000001:14-42`); stop swallowing RPC errors in `permissions/route.ts` and `users/route.ts` (check `result.error`); add a smoke test `select user_has_permission(auth.uid(),'user.manage')`.

### P1-1 — High: Server-side SSRF via report route

**Evidence:**
- `report/route.ts:45-46`: `const signedUrl = await getSignedUrl(supabase, photo.image_url, 300)` then `const response = await fetch(signedUrl)`.
- `signed-url.ts:56-63`: `const path = toStoragePath(stored); if (!path) return stored;` — for any `image_url` that is not a matching `/storage/v1/object/public/construction-photos/(.+)` path, the **raw attacker-controlled value is returned as-is**.
- `20260731000001:57-59` photos INSERT policy: `WITH CHECK (public.user_can_access_project(project_id))` — any project member can create a photo row with **arbitrary `image_url` text** (the upload route stores a safe raw path at `upload/route.ts:91`, but the DB does not constrain the column).

**Chain:** project member (or P0-1-elevated user) → insert photo with `image_url = 'http://169.254.169.254/latest/meta-data/'` → report fetch → SSRF to cloud metadata / internal VPC / external target from the server runtime. (Agent pass 3 confirmed `signed-url.ts` itself never fetches — the vector is the report route's `fetch` of the fallback value.)

**Fix:** (1) in `report/route.ts`, validate the fetch target hostname ends with the configured Supabase host and scheme is `https:` before fetching; (2) fail closed in `getSignedUrl` — `if (!path) throw` instead of returning the input; (3) constrain `image_url` in the photos INSERT policy (e.g. reject `^https?://` or require the storage-path regex).

### P1-2 — High: Storage bucket is public

**Evidence** — `20260724000003_create_storage.sql:2-4` (verified): `insert into storage.buckets (id, name, public) values ('construction-photos','construction-photos', true)`. `20260729000001_storage_security.sql` (header: "private bucket + project-aware RLS") rewrites only object policies — grep across all migrations confirms **no `update storage.buckets ... set public = false` exists**.

**Impact:** every object in `construction-photos` is permanently fetchable unauthenticated at `/storage/v1/object/public/construction-photos/<path>` once the path is known (leaked via `<img>` URLs, browser history, shared links, referrers). The entire signed-URL / `user_can_access_project` RLS story on storage is cosmetic; this is a privacy breach for a construction-photo product and amplifies P2-5 (malware hosting).

**Fix:** `update storage.buckets set public = false where id = 'construction-photos';` then re-test signed URLs for project members.

### P1-3 — High: Paid plan never applied at checkout (billing broken)

**Evidence** — `webhook/route.ts:85-90`: `checkout.session.completed` upserts `{ stripe_customer_id, stripe_subscription_id, status:'active', stripe_event_created }` — **no `plan`**. `plan` is only written by `customer.subscription.updated` (`:108-131`), which requires the row to already exist and hits 0 rows silently (`:131` `.eq('stripe_subscription_id', ...)`; `if (error) throw` — 0 rows is no error). Stripe delivers subscription events before `checkout.session.completed`; `customer.subscription.created` is not handled. Result: the row is created with default `plan 'free'` (`20260725000010:10`) and stays there until a later subscription change.

**Fix:** in `checkout.session.completed`, derive the tier from the session price (`line_items.data[0].price.id` → `resolvePlanFromPriceId`) and include `plan` in the upsert; also handle `customer.subscription.created`; check row-count on the `updated` update.

### P1-4 — High: Unscoped cross-company permission grants

**Evidence** — `permissions/route.ts` POST: key regex whitelists `project.VIEW.*` shape; `user.manage` gate (currently always-403 due to P0-3); but **never verifies the caller has access to the `projectId` embedded in the key**. A `site_manager` of company X can `INSERT INTO user_permissions (user_id, permission_key='project.VIEW.<victim-uuid>', granted=true)` and grant cross-company project access to anyone. The invite route does this correctly (`assertProjectInviteAccess`, `invite/route.ts:64-84`) — `permissions` POST must too.

**Fix:** before the upsert, load the project by id (404 if missing) and require `project.user_id`'s company == caller's company (unless admin).

### P1-5 / P1-6 — High: Unscoped RLS writes on `drawing_pins` and `attendance_logs`

**Evidence** (verified):
- `20260725000008_create_pins.sql:34-44` — INSERT `WITH CHECK (auth.uid() = user_id)`; UPDATE/DELETE `USING (auth.uid() = user_id)`; **no `photos`/project join**. `20260731000001` fixed only the SELECT side (`:124-135`). Browser hook `usePins.ts:38-42,53-58,68-71` writes directly.
- `20260725000006_create_attendance.sql:26-28` — INSERT `WITH CHECK (auth.uid() = user_id)`; **no project-access check**. Hook `useAttendance.ts:79-81` writes directly.

**Impact:** any authenticated user can annotate/vandalize another company's photos (`drawing_pins`) and check into another company's projects (`attendance_logs`) by UUID. Same authz-gap class; the SELECT fixes prove the intent but the writes were missed.

**Fix:** rewrite the three pin policies and the attendance INSERT to `EXISTS (SELECT 1 FROM photos WHERE id = photo_id AND public.user_can_access_project(project_id))` (attendance: join through `projects`).

### P1-7 — High: Read-only VIEW grants authorize mutations (systemic)

**Evidence** — `company-auth.ts:96-100`: `requireProjectAccess` returns access when the caller **holds `project.VIEW.<id>` OR** is same-company/owner — it never distinguishes grant type for mutations. Every PATCH/DELETE call site (projects `[id]`, defects, daily-logs, pins, schemas, schema-pins) thus lets a read-only invitee (`invite` creates exactly `project.VIEW.*` grants) perform destructive operations.

**Fix:** add a `requireProjectMutate` path that rejects VIEW-only grants for mutations (check `hasProjectAccessViaPermission` result and deny write methods).

### P1-8 — High: Null-company users leak all data in two dashboard GETs

**Evidence** — `defects/route.ts:22-25`, `attendance/route.ts:24-31`: `if (ctx && !ctx.isAdmin) { query = query.in('created_by', ctx.companyUserIds) }` — when `getCompanyContext` returns `null` (user has no `company_name`, which defaults to `''` per `20260725000004:6`), the condition is false and **no filter is applied**. A signed-up-but-not-company-assigned user sees every company's defects and attendance.

**Fix:** `if (!ctx?.isAdmin) { query = query.in('created_by', ctx?.companyUserIds ?? [user.id]) }` (or deny).

### P1-9 — High: Mass assignment in `daily-logs` and `pins` PATCH

**Evidence** (verified): `daily-logs/route.ts:97-117` — `const { id, updates } = body` → `:114 .update(updates)` (raw object). `pins/route.ts:84-107` — `const { id, ...updates } = body` → `:107 .update(updates)`. The `requireProjectAccess` guard checks only the **original** row's project; the attacker can overwrite `user_id` (forge authorship), `project_id` (move the row into any accessible project), `created_at`, etc. `schemas/route.ts:71-73` whitelists PATCH fields correctly — copy that pattern.

**Fix:** whitelist: daily-logs `{ log_date, work_description, weather, temperature, notes }`; pins `{ pin_type, x, y, width, height, color, label, drawing_data }`.

### P1-10 — High: Unscoped cross-tenant reads on the anon client

**Evidence** (verified): `taggings/route.ts:39-44` — `from('taggings').select('*, labels(*, label_groups(*))').eq('taggable_type', ...).eq('taggable_id', ...)` — no project resolution, no `requireProjectAccess`, even though the helpers exist in the same file (`:75-77` POST/DELETE do it). `labels/items/route.ts:16-20` — `from('labels').select('*').eq('group_id', groupId)` — no company scoping, unlike the correct `labels/groups/route.ts:22-41`.

**Impact:** any authenticated user can enumerate and read any company's taggings/labels (and nested label-group data). Severity is P1 because no local RLS policy exists for these tables (see P3-1/verification note).

**Fix:** resolve the taggable's project and `requireProjectAccess` before GET (mirror `taggings/route.ts:75-77`); company-scope `labels/items` GET (mirror `groups/route.ts`).

### P2 cluster (summary; details verified in route files)

- **P2-1** `team/route.ts:28-41` — a cross-company `project.VIEW` grantee receives `select('*')` of the owning company's **entire roster** (`full_name, email, phone, avatar_url`). Fix: return minimal fields (`id, full_name, avatar_url`) or project-assigned users only.
- **P2-2** `invite/route.ts:121-128` — `getAvailableUsers` lists every non-admin user platform-wide with `email` (full PII directory, no pagination/rate limit). Fix: mask emails until invited; require admin for full disclosure.
- **P2-3** `users/route.ts` PATCH — same-company `site_manager` can demote a same-company `admin` (no hierarchy check). Fix: forbid managers from modifying admins.
- **P2-4** `webhook:88` — `status:'active'` without `payment_status==='paid'`. Fix: gate on paid/complete.
- **P2-5** `upload-schema/route.ts:26-28,63-65` — client-trusted `file.type`, raw bytes stored (no re-encode), client filename extension in the storage path. Fix: server-side content validation (sharp re-encode / poppler), server-derived filename; P1-2 flip halves exposure.
- **P2-6** `schema-pins/route.ts:94-99` — POST checks the schema's project only, never the photo's. Fix: resolve and check the photo's project too.
- **P2-7** `labels/items/[id]`, `labels/groups/[id]` PATCH/DELETE — role-only gates, no company resolution → any company's site_manager edits any company's labels/groups. Fix: resolve group's `company_id` and compare with caller.
- **P2-8** `audit-logs/route.ts:42-44` — company-less `site_manager` reads all logs (same `if (ctx)` pattern as P1-8). Fix: `ctx ? ctx.companyUserIds : [user.id]`.
- **P2-9** `audit-logs/route.ts:21-27` — raw `role` gate ignores `admin.audit` revocations. Fix: use `user_has_permission` (after P0-3).

### P3/P4 cluster (selected)

- **P3-1** No Zod validation in any audited route; unvalidated `parseInt`/UUIDs → `NaN`/500s (info-DoS). Wire `lib/validation/schemas.ts` (exists, 30+ schemas, used only by upload routes) into all write routes; UUID-validate `id`/`projectId` params.
- **P3-3** `err.message` returned to clients in `invite:233-236`, `audit-logs:57-59`, upload/upload-schema, `webhook:220`. Log server-side; return generic messages.
- **P3-4** Storage blobs orphaned: `photos/route.ts:120` deletes only the DB row; `upload/route.ts:100-105` leaves the blob on DB failure. Clean up via storage API.
- **P3-6** Webhook dedup TOCTOU: process-then-record (`webhook:49-55,209-214`). Fix: `INSERT ... ON CONFLICT (event_id) DO NOTHING` first, process only on row-affect.
- **P3-7** `lib/subscriptions/stripe.ts` missing `import 'server-only'`; unpinned Stripe `apiVersion`.
- **P4-1** `trade_templates` public read (`USING (true)`) — catalog-only, acceptable; flag for future.
- **P4-4** `permissions`/`role_permissions` catalogs `USING (true)` — restrict to `authenticated`.

---

## 4. Prior-Claim Verification Table

Baseline: `AUDIT_REPORT.md` (C1–C4) and `AUDIT-REPORT.md` (H1–H5, M1–M8), Jul 29 2026.

| Claim | Prior finding | Status | Evidence |
|---|---|---|---|
| C1 | Service-role key leaked in `.env.local:3` | **CONFIRMED FIXED** | `.env.local` now holds only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only); `.gitignore` has `.env*` + `!.env.example`/`!.env.local.example`; full example template exists |
| C2 | `deleteProject` no auth (`db/route.ts:262-268`) | **CONFIRMED FIXED** | God route deleted; `projects/[id]` DELETE now `requireAuth` + `requireProjectAccess` (residual: P1-7 VIEW-grant escalation) |
| C3 | `updateUserRole` no auth (`db/route.ts:664-675`) | **CONFIRMED FIXED** | `users/route.ts` PATCH `requireAuth` + role gate + `user.manage` (residual: P0-3 makes the gate always-403; P0-1 reopens equivalent hole at DB layer) |
| C4 | `updateUserPermission` no auth | **CONFIRMED FIXED** | `permissions/route.ts` POST `user.manage` gate (residual: P1-4 unscoped grants, P0-3 dead RPC) |
| H1 | RLS entirely bypassed | **PARTIALLY FIXED** | Service-role client still used (by design) but now paired with per-route manual gates in most routes; new RLS hardening (20260731000001, 20260730000002). **RLS is still not a trustworthy boundary:** P0-1 (profiles), P1-5/P1-6 (pins/attendance writes), P1-2 (public bucket), P0-2 (audit insert) |
| H2 | API routes lack project access verification | **MOSTLY FIXED** | `requireProjectAccess` present on project routes; residual gaps: `taggings` GET, `labels/items` GET, labels/groups & items PATCH/DELETE, `schema-pins` POST (photo), `audit-logs` POST, fail-open guards (S6) |
| H3 | Blocking `execSync` in API route | **CONFIRMED FIXED** | No `execSync`/`child_process` in app code (only in unrelated `web/wedding-planner/node_modules`) |
| H4 | No input validation anywhere | **STILL OPEN** | Zero Zod across all audited routes; `lib/validation` used only by upload/upload-schema (P3-1) |
| H5 | Root layout hardcodes `lang="mk"` | **CONFIRMED FIXED** | `layout.tsx`: `<html lang={NEXT_LOCALE cookie ?? 'mk'} dir="ltr" suppressHydrationWarning>` |
| M1 | Inconsistent data access patterns | **STILL OPEN** | Anon client + service-role client + direct browser hooks mixed without a uniform guard (design debt; risk concentrated in P1-5/6/8/10) |
| M2 | `.env.local.example` incomplete | **CONFIRMED FIXED** | Full example template with all vars incl. Stripe keys/price IDs |
| M3 | Admin endpoints lack admin verification | **PARTIALLY FIXED** | Most routes gated; **`audit-logs` POST unguarded (P0-2)**; P0-1 defeats the rest |
| M4 | No tests | **STILL OPEN** | No test files found (out of scope of this audit — informational) |
| M5 | No `type-check` script | **CONFIRMED FIXED** | `package.json:10` — `"type-check": "tsc --noEmit"` (also `lint`, `test` scripts present) |
| M6 | PhotoLightbox hardcodes Macedonian locale | **CONFIRMED FIXED** | `localeMap {mk, en, de, sl, sr}`, fallback `mk` |
| M7 | No loading/error states | **STILL OPEN** | Frontend concern; not re-audited here (informational) |
| M8 | No `generateStaticParams` for blog | **STILL OPEN** | Frontend concern; not re-audited here (informational) |

---

## 5. Verdict

**NOT RELEASE-READY. Four fixes are mandatory before any production deploy:**

1. **P0-1** — Restrict the `profiles` UPDATE RLS policy (column-level grants or `SECURITY DEFINER` trigger). This single change unblocks or re-scopes most other findings and is a 3-line migration.
2. **P0-2** — Revert the `audit_logs` INSERT policy to deny direct inserts; gate the `audit-logs` POST route.
3. **P0-3** — Qualify tables as `public.*` in `get_user_permissions`/`user_has_permission` (mirror `user_can_access_project`), restoring the permission gate and unbreaking `users` PATCH / `permissions` POST.
4. **P1-2** — Flip the storage bucket private (`update storage.buckets set public = false`).

Then, in order: **P1-1** (SSRF — fail-closed `getSignedUrl` + fetch-host validation + `image_url` policy), **P1-3** (billing `plan` at checkout), **P1-4** (grant scoping in `permissions` POST), **P1-5/P1-6** (pins/attendance write-policy scoping), **P1-7** (VIEW-grant mutation denial), **P1-8** (null-company filter), **P1-9** (mass-assignment whitelists), **P1-10** (taggings/labels GET scoping), then the P2 cluster and the P3 hardening pass.

**Runtime verification still required (no `DATABASE_URL` available during this audit):**
- Confirm remote RLS actually exists and is enforced for `defects`, `attendance_logs`, `daily_logs`, `drawing_pins`, `site_schemas`, `schema_photo_pins`, `taggings`, `labels`, `label_groups` — no local migration creates policies for these tables; several P1/P2 severities depend on it (worst case: anon-client reads/writes are completely open).
- Confirm the bucket-private flip and re-test signed URLs.
- Re-run the P0-1 smoke test (`PATCH /rest/v1/profiles` self-role-change must 403).
- Confirm the `b0bca2d` out-of-band Storage API changes (private bucket claim) — not visible in migrations.
