-- Migration: Add data integrity invariants
-- Date: 2026-09-14
--
-- Purpose:
--   1. Re-create idx_photos_user_id (created 20260725000011, dropped
--      20260730000002 during RLS fix, column re-added 20260812000002
--      without re-creating the index).
--   2. Index work_order_defects(defect_id) — guarded with to_regclass
--      because work_order_defects lives in the web tree
--      (web/supabase/migrations/20260826000001), not the main tree.
--   3. Add CHECK constraints on photos.latitude, photos.longitude,
--      comments.body, and subscriptions.status. All use NOT VALID +
--      separate VALIDATE because no CHECK has ever existed on these
--      columns and existing rows may violate.
--
-- Provenance: construction-photo-log main tree (45 prior migrations).
-- Constraints: No DROPs/ALTERs of existing constraints, no RLS/trigger
--   changes, no data backfills, no commits.

-- ============================================================================
-- 1. Indexes
-- ============================================================================

-- 1a. photos(user_id) — column re-added by 20260812000002 but index was
--     never re-created after the DROP in 20260730000002.
CREATE INDEX IF NOT EXISTS idx_photos_user_id
  ON public.photos (user_id);

-- 1b. work_order_defects(defect_id) — guarded: this table is tracked only
--     in the web tree (separate Supabase project, project_id = "web").
--     The main tree has no such table. to_regclass lets the migration
--     succeed on the main tree and create the index wherever the table
--     actually exists.
DO $$
BEGIN
  IF to_regclass('public.work_order_defects') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_work_order_defects_defect_id
      ON public.work_order_defects (defect_id);
  END IF;
END
$$;

-- ============================================================================
-- 2. CHECK constraints
--    All four use NOT VALID + separate VALIDATE because:
--    - No CHECK has ever existed on any of these four columns.
--    - Existing rows may already violate (e.g. blank comment bodies,
--      out-of-range coordinates, undocumented Stripe statuses).
--    - NOT VALID skips the full-table scan at ADD time.
--    - VALIDATE then scans and FAILS the migration if violations exist,
--      which is the correct gate for a purely-additive migration.
-- ============================================================================

-- 2a. photos.latitude ∈ [-90, 90] (nullable float — NULL is allowed)
ALTER TABLE public.photos
  ADD CONSTRAINT photos_latitude_range
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90))
  NOT VALID;

ALTER TABLE public.photos
  VALIDATE CONSTRAINT photos_latitude_range;

-- 2b. photos.longitude ∈ [-180, 180] (nullable float — NULL is allowed)
ALTER TABLE public.photos
  ADD CONSTRAINT photos_longitude_range
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
  NOT VALID;

ALTER TABLE public.photos
  VALIDATE CONSTRAINT photos_longitude_range;

-- 2c. comments.body non-empty after trim (NOT NULL column)
ALTER TABLE public.comments
  ADD CONSTRAINT comments_body_not_blank
  CHECK (length(trim(body)) > 0)
  NOT VALID;

ALTER TABLE public.comments
  VALIDATE CONSTRAINT comments_body_not_blank;

-- 2d. subscriptions.status ∈ documented Stripe statuses
--     Source: web/docs/pricing.md + web/lib/subscriptions/pricing.ts
--     (hand-written free=5/500 is canonical; plan_limits.generated.sql
--     treats free as unlimited — see report).
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_valid
  CHECK (status IN (
    'active',
    'trialing',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired'
  ))
  NOT VALID;

ALTER TABLE public.subscriptions
  VALIDATE CONSTRAINT subscriptions_status_valid;
