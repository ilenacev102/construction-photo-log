# Data Integrity Invariants — Migration Report

**Date:** 2026-09-14
**Migration:** `supabase/migrations/20260914000001_add_data_integrity_invariants.sql`
**Test:** `web/lib/__tests__/data-integrity-invariants.test.ts`
**Scope:** Purely additive. No DROPs/ALTERs of existing constraints, no RLS/trigger/function changes, no data backfills, no commits.

---

## 1. What was delivered

### 1a. Indexes

| Index | Table | Rationale |
|---|---|---|
| `idx_photos_user_id` | `public.photos (user_id)` | Created by `20260725000011`, dropped by `20260730000002` during the RLS fix, column re-added by `20260812000002` **without** re-creating the index. Re-created with `IF NOT EXISTS`. |
| `idx_work_order_defects_defect_id` | `work_order_defects (defect_id)` | **Guarded** with `DO $$ ... IF to_regclass('public.work_order_defects') IS NOT NULL THEN CREATE INDEX IF NOT EXISTS ... END IF; $$` — see §4. |

### 1b. CHECK constraints (all `NOT VALID` + separate `VALIDATE`)

| Constraint | Table / Column | Expression |
|---|---|---|
| `photos_latitude_range` | `photos.latitude` (nullable float) | `latitude IS NULL OR (latitude >= -90 AND latitude <= 90)` |
| `photos_longitude_range` | `photos.longitude` (nullable float) | `longitude IS NULL OR (longitude >= -180 AND longitude <= 180)` |
| `comments_body_not_blank` | `comments.body` (`text NOT NULL`) | `length(trim(body)) > 0` |
| `subscriptions_status_valid` | `subscriptions.status` (`text NOT NULL DEFAULT 'active'`) | `status IN ('active','trialing','past_due','canceled','unpaid','incomplete','incomplete_expired')` |

**Why `NOT VALID` + `VALIDATE`:** none of these four columns has ever had a CHECK constraint, so existing rows may already violate (blank comment bodies, out-of-range coordinates, undocumented Stripe statuses). `NOT VALID` skips the full-table scan at `ADD` time; the separate `VALIDATE` then scans and **fails the migration** if violations exist — the correct gate for a purely-additive migration.

**Stripe status list source:** `web/docs/pricing.md` + `web/lib/subscriptions/pricing.ts`. The hand-written `free = 5/500` limits are canonical; `plan_limits.generated.sql` treats free as unlimited — see §3.

---

## 2. Config fix — `sql_paths` removed from both `config.toml` files

Both `supabase/config.toml` and `web/supabase/config.toml` had:

```toml
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
schema_paths = []
```

`./seed.sql` does not exist in either tree, so with seeding enabled a dangling `sql_paths` reference makes `supabase db reset` fail. The line was removed from both files and replaced with a `# NOTE:` comment explaining the removal (the surrounding TOML boilerplate still documents seed files, so the absence would otherwise read as an accidental omission).

Verified: `grep sql_paths` on both files now matches only the comment lines; the `[db.seed]` blocks are identical across the two trees.

---

## 3. `plan_limits.generated.sql` verdict (report-only, no change)

`supabase/plan_limits.generated.sql` treats the free tier as unlimited (`v_max ELSE NULL`), which contradicts:

- `supabase/migrations/20260806000001` — hand-written, free = 5 photos / 500 MB
- `supabase/migrations/20260801000001` — agrees with the hand-written limits
- `web/docs/pricing.md` — documents free = 5/500

The generated file is a **stale outlier**. Regeneration is blocked: `web/lib/subscriptions/pricing.ts` is missing and `web/scripts/gen-plan-triggers.mjs` was not found. **Recommendation:** regenerate from the hand-written source once the pricing module exists; do not hand-edit the generated file.

---

## 4. `work_order_defects` provenance guard

`work_order_defects` is defined **only** in the web tree (`web/supabase/migrations/20260826000001_create_work_order_defects.sql`), which is a separate Supabase project (`project_id = "web"`). The main tree has `work_orders` but **not** `work_order_defects`.

Per the "ONE new migration" constraint, the index lives in the single main-tree migration, wrapped in a `DO $$` block that checks `to_regclass('public.work_order_defects') IS NOT NULL` before creating it. `IF NOT EXISTS` alone guards only the index, not the table — the `to_regclass` guard makes the migration succeed on the main tree and create the index wherever the table actually exists.

---

## 5. `projects.company_name` nullability (report-only, no change)

`supabase/migrations/20260727000001_company_isolation.sql:9` still declares `company_name` nullable; the `SET NOT NULL` at line 21 is commented out. Enforcing `NOT NULL` requires a backfill verification first (are there rows with `company_name IS NULL`?) — out of scope for this purely-additive migration. **Recommendation:** verify backfill feasibility in a follow-up.

---

## 6. Test coverage

`web/lib/__tests__/data-integrity-invariants.test.ts` models the four CHECK constraints as pure functions (mirroring the `attendance-invariants.test.ts` convention — no Supabase connection needed):

- `isLatitudeValid(latitude: number | null)` — NULL allowed; inclusive `[-90, 90]`
- `isLongitudeValid(longitude: number | null)` — NULL allowed; inclusive `[-180, 180]`
- `isBodyNonBlank(body: string)` — rejects `''` and whitespace-only
- `isValidSubscriptionStatus(status: string)` — exact match against the 7 documented statuses; rejects whitespace-padded and undocumented values

**Verification results (from `web/`):**

```
npx vitest run   → 39 test files, 349 tests, all passed
npm run type-check → clean (tsc --noEmit, no errors)
```

---

## 7. Files touched

| File | Change |
|---|---|
| `supabase/migrations/20260914000001_add_data_integrity_invariants.sql` | **New** — the migration |
| `supabase/config.toml` | Removed `sql_paths = ["./seed.sql"]`, added NOTE comment |
| `web/supabase/config.toml` | Removed `sql_paths = ["./seed.sql"]`, added NOTE comment |
| `web/lib/__tests__/data-integrity-invariants.test.ts` | **New** — pure-function invariant tests |

No commits were made.