# DB & Data Integrity Audit — Verified Report

**Date:** 2026-07-31
**Auditor:** Sisyphus (read-only, independent verification)
**Scope:** `/home/nac/Projects/construction-photo-log/supabase/migrations/` — all 21 root migrations (1888 lines), cross-checked against API routes, TS types, and config.
**Method:** Every claim below was verified directly against migration SQL and route source. **No files modified. No supabase/db commands run.** Live DB comparison impossible (`DATABASE_URL` not set) — runtime severities flagged as such.
**Baseline:** `AUDIT_REPORT.md`, `AUDIT-REPORT.md`, `AUDIT-FINAL.md` used only as claim lists for §4; this report re-verifies each from source.

---

## 1. Executive Summary

The migration set has serious **replayability and runtime** problems. The headline finding is worse than previously reported:

- **The 21-migration chain is NOT replayable from scratch.** `photos` is created without a `user_id` column (`20260725000002`), yet `20260725000008` (`drawing_pins` SELECT policy), `20260725000011` (`idx_photos_user_id`), `20260725000013` (`schema_photo_pins` INSERT/DELETE policies) and `20260725000014` (drawing_pins policy again) all reference `photos.user_id`. PostgreSQL validates policy/index expressions at creation time, so **a fresh deploy fails at migration 08**. The fixes in `20260730000002`/`20260731000001` only help databases that already got past those migrations.
- **`profiles.email` does not exist** (C6) while the invite and users routes SELECT it — the invite flow and user management are broken at runtime.
- **The permission RPCs are dead at runtime** (`get_user_permissions`, `user_has_permission` use `SECURITY DEFINER SET search_path = ''` with **unqualified** `profiles`/`role_permissions`/`user_permissions` references → `relation "profiles" does not exist`).
- The **profile self-escalation** (any user can UPDATE own `role='admin'`) and **audit-log forgery** findings remain.
- Positive: `20260731000001` is a substantial, correct cross-tenant hardening pass (photos/schemas/pins/defects/taggings/user_permissions/attendance/daily_logs become company-aware via `public.user_can_access_project`, which is itself hardened with `SET search_path=''` + fully-qualified refs). Storage RLS policies are project-aware. `handle_new_user`/`handle_new_subscription`/`check_taggable_project_access`/`seed_default_labels` are all correctly qualified.

**Verdict: DO NOT RELEASE.** Block on the P0 set (§6): fix migration replayability, add `profiles.email`, fix permission RPCs, close profile self-escalation and audit-log forgery.

---

## 2. Findings Table

| ID | Sev | Source | Issue |
|---|---|---|---|
| F-1 | **Critical** | `20260725000008:34-44`, `20260725000011:9`, `20260725000013:62-88`, `20260725000014:117-123` | Fresh deploy fails: policies/index reference `photos.user_id` which is never created (C5). Runtime echo: `schema-pins/route.ts:42` SELECTs `photos(user_id)` → error |
| F-2 | **Critical** | `20260725000004:15-25` | `profiles` UPDATE policy row-scoped only — any user sets own `role='admin'`/`company_name` via PostgREST; defeats all app-level admin/company checks. Never fixed by later migrations |
| F-3 | **Critical** | `20260725000012:173-236` | `get_user_permissions`/`user_has_permission` = `SECURITY DEFINER SET search_path=''` + **unqualified** table refs → runtime `relation "..." does not exist` → permission gate dead, revocations ineffective |
| F-4 | **Critical** | `profiles` has no `email` (C6); `invite/route.ts:123,217`, `users/route.ts:134,179` | `profiles.email` selected by routes but column never created → invite + users flows 500 |
| F-5 | **High** | `20260730000002:78-82` + `audit-logs/route.ts:63-91` | Audit-log forgery: RLS INSERT allows any `authenticated`; POST writes client fields unguarded |
| F-6 | **High** | `20260724000003:2-4` | Bucket `construction-photos` created `public=true`; no migration flips it private → objects readable via public URL, signed URLs cosmetic, storage RLS bypassed (M37) |
| F-7 | **High** | `20260725000008:37-44` (INSERT/UPDATE/DELETE) | `drawing_pins` write policies scoped only to `auth.uid()=user_id` — DB-level cross-tenant annotation (API-level `requireProjectAccess` gates it in app, but DB alone is open) |
| F-8 | **High** | `20260725000006:26-28` | `attendance_logs` INSERT checks only `auth.uid()=user_id` — DB-level cross-tenant check-ins |
| F-9 | **High** | `20260725000012:60-72` (orig.) | `user_permissions` read/manage policies had no company scope → cross-company grant issuance (fixed by `20260731000001` §8 — verify applied) |
| F-10 | **Medium** | `20260725000003/06/07/08` user FKs | `daily_logs.user_id`, `attendance_logs.user_id`, `defects.created_by`, `defects.assigned_to`, `drawing_pins.user_id` lack `ON DELETE` → user deletion fails/orphans (H28) |
| F-11 | **Medium** | `20260725000004` + `20260725000014:50-60` | `auth_role`/`auth_has_role` use `SET search_path='public'` (not `''`); unqualified refs resolve via public — functional but not maximally pinned (L15 residual) |
| F-12 | **Medium** | all migrations | `updated_at` on 6 tables never auto-maintained; no trigger anywhere (only `on_auth_user_created` + `_subscription`) (L17) |
| F-13 | **Medium** | `web/types/database.ts`, `schema-pins/route.ts:15` | Manual TS types drift: phantom `Photo.user_id`, phantom `photos.user_id` join type; no generated `database.types.ts` (L14) |
| F-14 | **Low** | `20260724000002:14` | `photos.taken_at` nullable; nullable + DESC index (M36) |
| F-15 | **Low** | `web/supabase/migrations/`, `web/supabase/config.toml` | Duplicate stale migration dir (2 files identical to root) + `project_id` mismatch (`construction-photo-log` vs `web`) (H25) |
| F-16 | **Low** | `profiles.company_name` TEXT | Free-text tenant identifier, no FK to `companies`; `projects.company_name` added nullable, NOT NULL/RLS commented out in `20260727000001` (dormant) (M39) |

---

## 3. Detailed Findings (SQL evidence + fix)

### F-1 — C5: `photos.user_id` phantom → fresh deploy broken (Critical)

**Evidence.**
- `20260724000002_create_photos.sql` (full, 33 lines) creates `photos` with `id, project_id, image_url, taken_at, latitude, longitude, note, created_at` — **no `user_id`**.
- `grep "photos ADD COLUMN"` → only `20260725000005:31` `ALTER TABLE photos ADD COLUMN IF NOT EXISTS trade_metadata jsonb DEFAULT '{}'`. **No migration ever adds `user_id`.**
- `20260725000008:34-44`:
  ```sql
  CREATE POLICY "Users view pins on their photos"
    ON drawing_pins FOR SELECT
    USING (EXISTS (SELECT 1 FROM photos WHERE id = photo_id AND (photos.user_id = auth.uid() OR ...)));
  ```
  → `photos.user_id` does not exist → **CREATE POLICY raises at creation → migration 08 fails on fresh deploy**.
- `20260725000011:9` `CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id)` → fails (never reached after 08).
- `20260725000013:62-88` schema_photo_pins INSERT/DELETE policies: `auth.uid() IN (SELECT user_id FROM photos ...)` → fails.
- `20260725000014:117-123` recreates the drawing_pins SELECT policy still referencing `photos.user_id` → fails.
- Fix migrations: `20260730000002` drops `idx_photos_user_id` and rewrites all of the above via `photos JOIN projects`; `20260731000001` §2/4/5 replaces them with `public.user_can_access_project(project_id)`. **Both fixes run only after 08/11/13/14 already broke a fresh deploy.**

**Runtime echo:** `web/app/api/schema-pins/route.ts:42` `.select('*, photos(image_url, taken_at, note, user_id)')` → PostgREST `Could not find the 'user_id' column of 'photos'` → GET schema-pins errors. `web/types/database.ts:21` and `schema-pins/route.ts:15` type `photos.user_id: string`.

**Fix (migrations):** in the earliest migrations, either (a) add `user_id uuid REFERENCES auth.users(id)` to `photos` in `20260724000002` and set it on insert, or (b) edit `20260725000008/11/13/14` to reference `photos.project_id` via a `projects` join, matching what `20260730000002` already does. Then run `30000002`+`31000001` as written. **Fix (route):** drop `user_id` from the schema-pins select and join type.

---

### F-2 — Profile self-escalation (Critical)

**Evidence.** `20260725000004:22-25`:
```sql
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```
No column restriction: a `photographer` can `PATCH /profiles` with `{"role":"admin","company_name":"victim-co"}`. `20260725000014` only fixes the SELECT policy (`Admins read all profiles`, `:47-60`); `20260731000001` touches photos/schemas/pins/defects/taggings/user_permissions/attendance/daily_logs — **never the profiles UPDATE policy**.

**Fix:**
```sql
DROP POLICY "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())  -- role immutable by owner
  );
```
Admins manage roles through a dedicated SECURITY DEFINER function or admin-only policy (company-scoped).

---

### F-3 — Permission RPCs broken (Critical)

**Evidence.** `20260725000012:173-236`:
```sql
CREATE OR REPLACE FUNCTION get_user_permissions(target_user_id uuid)
RETURNS TABLE (permission_key text, granted boolean)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$ ... FROM profiles p ... FROM role_permissions rp ... FROM user_permissions up ... $$;
```
With `SET search_path = ''`, **unqualified** `profiles`, `role_permissions`, `user_permissions` resolve only against `pg_catalog` → `ERROR: relation "profiles" does not exist`. Same for `user_has_permission` (`:204-236`). Every caller (`permissions` GET/POST, `users` PATCH, `admin.audit` checks) fails closed or returns empty.

**Fix:** qualify every table as `public.profiles`, `public.role_permissions`, `public.user_permissions` (same pattern as `handle_new_user`, `check_taggable_project_access`, and the hardened `user_can_access_project` in `20260731000001`).

---

### F-4 — C6: `profiles.email` missing (Critical)

**Evidence.** `20260725000004` (full) — profiles columns: `id, role, company_name, full_name, avatar_url, phone, created_at, updated_at`. `grep email supabase/migrations/*.sql` → **zero hits**. Email exists only on `auth.users` (inaccessible via PostgREST admin client without grants).
- `invite/route.ts:123`: `.select('id, full_name, email, company_name, role')` → runtime error.
- `invite/route.ts:217`: `.select('id, full_name, email, company_name')` → runtime error.
- `users/route.ts:134`: `.select('role, company_name, email')`; `:179` `targetProfile.email` → runtime error.

**Fix:** add `email text` to `profiles` (synced from `auth.users.email` in `handle_new_user`: `INSERT INTO public.profiles (id, full_name, email) VALUES (new.id, ..., new.email)`), backfill existing rows, and update the invite/users routes (email is currently the only stable cross-user identifier for roster display).

---

### F-5 — Audit-log forgery (High)

**Evidence.** `20260730000002:78-82`:
```sql
CREATE POLICY "Service role insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```
Any authenticated user can INSERT arbitrary `audit_logs` rows (any `action`, `metadata`, spoofed `user_id`/`project_id`) via PostgREST. Combined with `audit-logs/route.ts:63-91` (POST writes client-supplied `action`/`entity_*`/`metadata` with no authorization), the compliance record is forgeable end-to-end.

**Fix:** INSERT policy `WITH CHECK (auth.uid() = user_id)` (or restrict to service_role via `auth.role()='service_role'` — note the webhook/audit writes run through the admin client, so `service_role` works); route must derive `action`/`entity_type` server-side, never from the body.

---

### F-6 — M37: storage bucket public (High)

**Evidence.** `20260724000003:2-4` `values ('construction-photos', 'construction-photos', true)` — public bucket. `20260729000001` adds project-aware object policies but **never** runs `update storage.buckets set public = false` (verified: no such statement in any migration). Public URL pattern `…/storage/v1/object/public/construction-photos/<path>` serves objects **without** RLS.

**Fix:** `update storage.buckets set public = false where id = 'construction-photos';` in a new migration. Keep the `20260729000001` object policies; the app already reads via signed URLs.

---

### F-7 / F-8 — DB-level cross-tenant writes on pins / attendance (High)

**Evidence.** `20260725000008:37-44`: `drawing_pins` INSERT `WITH CHECK (auth.uid() = user_id)`, UPDATE/DELETE `USING (auth.uid() = user_id)` — no project/company check; any authenticated user can annotate any photo they can reference. `20260725000006:26-28`: `attendance_logs` INSERT `WITH CHECK (auth.uid() = user_id)` — same.
`20260731000001` §5 fixes only the pins **SELECT**; write policies are untouched. §9 fixes attendance SELECT only.

**Fix:** rewrite write policies to require `public.user_can_access_project((SELECT project_id FROM photos WHERE id = photo_id))` / `(SELECT project_id FROM attendance_logs ...)` respectively.

---

### F-9 — user_permissions cross-company (High, likely fixed)

**Evidence.** `20260725000012:60-72` originals: `USING (public.auth_has_role(ARRAY['admin','site_manager']))` with no company scoping → a site_manager of company A could grant/revoke company B's permissions. `20260731000001` §8 replaces both with company-aware policies (target.company_name = me.company_name). **Verify `31000001` is applied to the target DB** — the migration file is correct; whether it has been run cannot be confirmed without DB access.

---

### F-10 — H28: user FKs without ON DELETE (Medium)

**Evidence.** `20260725000003:8` `daily_logs.user_id uuid references auth.users(id) NOT NULL`; `20260725000006:9` `attendance_logs.user_id ... NOT NULL`; `20260725000007:12-13` `defects.created_by / assigned_to ... references auth.users(id) NOT NULL`; `20260725000008:6` `drawing_pins.user_id ... NOT NULL` — none declare `ON DELETE`. Deleting a user row raises FK violation (default NO ACTION) → user deletion impossible without manual cleanup; audit_logs (`ON DELETE SET NULL`) shows the intended pattern.

**Fix:** decide semantics — `ON DELETE SET NULL` for soft-orphaning (`defects.assigned_to`, `daily_logs.user_id`) or `CASCADE` for pure ownership rows.

---

### F-11 — L15 residual: auth_role/auth_has_role search_path (Medium)

**Evidence.** `20260725000014:7-40`:
```sql
CREATE FUNCTION auth_role() RETURNS text ... SECURITY DEFINER SET search_path = 'public' ...
```
Pinned, but to `public` rather than `''`, with unqualified `profiles` refs. Functional (public resolves), but best practice is `SET search_path = ''` + `public.` qualified, matching the rest of the hardened codebase.

**Fix:** recreate with `SET search_path = ''` and `public.profiles`.

---

### F-12 — L17: no updated_at maintenance (Medium)

**Evidence.** `grep "CREATE TRIGGER"` → exactly two: `on_auth_user_created`, `on_auth_user_created_subscription`. Six tables declare `updated_at` (`profiles`, `daily_logs`, `defects`, `drawing_pins`, `subscriptions`, `user_permissions`) with no trigger populating it — stale audit/UX timestamps.

**Fix:** one `set_updated_at()` trigger function + `CREATE TRIGGER ... BEFORE UPDATE ... FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()` per table.

---

### F-13 — L14: manual TS types drift (Medium)

**Evidence.** No generated `database.types.ts` (grep over web: none). `web/types/database.ts` (245 lines, hand-written): `Photo.user_id?: string` (:21) — phantom (F-1); `Profile` has no `email` while routes select it (F-4); `Project.trade` is valid (column exists via `20260725000005:29`). `schema-pins/route.ts:15` types the join `photos.user_id: string` — phantom.

**Fix:** generate types from the fixed schema (`supabase gen types`) and delete the hand-written file; update `schema-pins` select/type per F-1.

---

### F-14 — M36: taken_at nullable (Low)

`photos.taken_at timestamptz` nullable; `idx_photos_taken_at (taken_at DESC)` exists so the DESC-order query is served. Nullability itself is benign; noted for completeness.

---

### F-15 — H25: duplicate migrations + config drift (Low)

`web/supabase/migrations/` contains `20260724000001`/`20260724000002` byte-identical to root (`diff` exit 0). `web/supabase/config.toml` `project_id = "web"` vs root `"construction-photo-log"`. Remove the stale duplicate directory and align `project_id`.

---

### F-16 — M39: company_name free-text tenant (Low)

`profiles.company_name text DEFAULT ''` — no FK to `companies`; all tenant joins are string equality (`companies.name = profiles.company_name`). `20260727000001` adds `projects.company_name` (nullable, backfill runs, NOT NULL + RLS commented out — explicitly dormant: "Apply when supabase DB direct access is available"). DB-level company isolation is therefore **not enforced**; the app relies on API-level filtering.

**Fix:** FK `profiles.company_name` → `companies(name)` (or migrate to `company_id uuid`), then activate the dormant migration.

---

## 4. Fresh-Deploy & Upgrade Simulation

### Fresh deploy (run the 21 root migrations in order on an empty DB)
| # | Migration | Result |
|---|---|---|
| 01–07 | 24000001 … 25000007 | ✅ apply |
| **08** | 25000008_create_pins | ❌ **FAILS** — `CREATE POLICY "Users view pins on their photos"` references `photos.user_id` (column does not exist) |
| 09–10 | audit_log, subscriptions | — (not reached) |
| **11** | 25000011_create_indexes | ❌ fails (`idx_photos_user_id`), even if 08 skipped |
| **13** | 25000013_create_site_schemas | ❌ fails (schema_photo_pins policies `SELECT user_id FROM photos`) |
| **14** | 25000014_fix_rls_recursion | ❌ fails (drawing_pins policy again) |
| 15–21 | …31000001 (the actual fixes) | — never reached |

**Conclusion: a fresh `supabase db push` is impossible as committed.** The chain must be repaired at 08/11/13/14 (or `photos` given a `user_id` column early) before `30000002`/`31000001` can act as intended.

### Upgrade path (existing DB that already has these tables)
Applying **only** the trailing fix migrations to a live DB (as the current codebase intends):
- `20260730000002` — correct: drops broken index, rewrites drawing_pins SELECT, schema_photo_pins INSERT/DELETE via `photos→projects` join, tightens audit_logs INSERT, site_schemas SELECT. ✅
- `20260731000001` — correct: hardens `user_can_access_project` (`SET search_path=''`, `public.*` qualified), makes photos/schemas/schema-pins/pins/defects/taggings/user_permissions/attendance/daily_logs company-aware. ✅
- Remaining after upgrade: F-2 (profile escalation), F-3 (permission RPCs), F-4 (profiles.email), F-5 (audit forgery), F-6 (bucket public), F-7/F-8 (write-scope gaps), F-10…F-16.

---

## 5. Prior-Claim Verification Table

| Claim | Verdict | Evidence |
|---|---|---|
| **C5** photos.user_id missing → fresh deploy breaks | **CONFIRMED — worse** | `20260724000002` (no col); `grep photos ADD COLUMN` → none; policies/index in 08/11/13/14 reference it and **fail at CREATE time**; `schema-pins/route.ts:42` runtime select |
| **C6** profiles.email missing | **CONFIRMED STILL OPEN** | `20260725000004` full read (no col); `grep email` → 0; invite/users routes select it |
| **H25** duplicate migrations | **CONFIRMED** | `web/supabase/migrations/` 2 files `diff`-identical; project_id mismatch |
| **H27** ilike wildcard permission check | **N/A — FIXED** | `db/route.ts` gone; `photos/route.ts` uses admin client + company scoping; `ilike('permission_key','project.VIEW.%')` is a prefix pattern, not leading-wildcard |
| **H28** missing ON DELETE on user FKs | **CONFIRMED** | daily_logs/attendance/defects×2/pins → auth.users, no ON DELETE |
| **M35** missing CHECK constraints | **PARTIALLY FIXED** | CHECKs exist: `profiles.role`, `pin_type`, `selection_mode`, `taggable_type`; severity/status via ENUMs; remaining: `subscriptions.status`, attendance/daily_logs free text, geo ranges |
| **M36** taken_at nullable | **CONFIRMED (low)** | `20260724000002:14`; index present |
| **M37** public storage bucket | **CONFIRMED STILL OPEN** | `20260724000003:2-4` `public=true`; no flip anywhere |
| **M38** empty profile defaults | **CONFIRMED** | `handle_new_user` inserts only `id, full_name` → role/company defaults → null-company users (feeds null-ctx unscoped reads) |
| **M39** company_name free-text tenant | **CONFIRMED STILL OPEN** | `profiles.company_name TEXT` no FK; `20260727000001` dormant (NOT NULL/RLS commented out) |
| **L14** manual TS types drift | **CONFIRMED** | no generated types; phantom `Photo.user_id`, `photos.user_id` join; Profile.email absent while routes select it |
| **L15** SECURITY DEFINER search_path | **PARTIAL** | hardened: `user_can_access_project`, `check_taggable_project_access`, `handle_new_user/_subscription` (`''`+qualified); **broken: get_user_permissions/user_has_permission (`''`+unqualified → F-3)**; residual: `auth_role`/`auth_has_role` (`'public'`) |
| **L17** missing updated_at trigger | **CONFIRMED STILL OPEN** | only 2 triggers total; 6 tables with `updated_at` never maintained |

---

## 6. Verdict

**DO NOT RELEASE.** Blocking set (P0):

1. **F-1** — Migration chain not replayable from scratch (C5); also breaks `schema-pins` GET at runtime.
2. **F-2** — Self-service role escalation via `profiles` UPDATE policy (defeats every admin/company check).
3. **F-3** — Permission RPCs dead (`search_path=''` + unqualified refs) → permission gate ineffective, revocations moot.
4. **F-4** — `profiles.email` missing (C6) → invite + users management broken.
5. **F-5** — Audit-log forgery (route + RLS).

Then P1: F-6 (public bucket), F-7/F-8 (DB-level write scoping on pins/attendance), F-9 (verify 31000001 applied), F-10–F-16 (cleanup cluster).

**Cheap, high-leverage next step:** fix F-1 by qualifying 08/11/13/14 against `projects` (mirroring the already-correct `20260730000002` patterns) and rerun a fresh-deploy dry run (`supabase db reset` on a throwaway project) to prove the chain applies end-to-end.
