-- Attendance integrity invariants (Phase 1 — Unit B, resolves Challenge 5).
--
-- Three DB-level guards on attendance_logs:
--   1. At most ONE open (check_out IS NULL) check-in per (user_id, project_id).
--      Partial unique index — "business day" is intentionally NOT used, because
--      construction crews work weekends and a second shift on the same calendar
--      day must be allowed once the first is closed.
--   2. No negative/zero durations: a closed row must have check_out > check_in.
--   3. Hard 24h cap: a BEFORE INSERT OR UPDATE trigger rejects any row whose
--      span exceeds 24 hours (catch runaway / forgotten check-outs).
-- The API route layer adds its own ownership guard (check-out by the log's
-- owner only); these are the last-resort DB guarantees.

-- ----------------------------------------------------------------------------
-- 1. One open check-in per (user, project)
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_one_open_per_user_project
  ON attendance_logs (user_id, project_id) WHERE check_out IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Sane duration (no negative/zero spans)
-- ----------------------------------------------------------------------------
ALTER TABLE attendance_logs DROP CONSTRAINT IF EXISTS attendance_duration_sane;
ALTER TABLE attendance_logs
  ADD CONSTRAINT attendance_duration_sane
    CHECK (check_out IS NULL OR check_out > check_in);

-- ----------------------------------------------------------------------------
-- 3. Hard 24h cap (BEFORE INSERT OR UPDATE trigger)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_attendance_duration_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.check_out IS NOT NULL
     AND NEW.check_out - NEW.check_in > interval '24 hours'
  THEN
    RAISE EXCEPTION 'Attendance duration exceeds the 24 hour cap';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_duration_cap ON public.attendance_logs;

CREATE TRIGGER trg_attendance_duration_cap
  BEFORE INSERT OR UPDATE ON public.attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_attendance_duration_cap();

COMMENT ON TRIGGER trg_attendance_duration_cap ON public.attendance_logs IS
  'Rejects attendance spans longer than 24 hours (check_out - check_in > interval 24h).';
