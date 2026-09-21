-- P1-5/P1-6: rewrite unscoped write policies on drawing_pins and attendance_logs.
--
-- The original policies only checked `auth.uid() = user_id`, so any
-- authenticated user could:
--   - INSERT a drawing_pin on a photo belonging to ANY company's project
--     (drawing_pins.photo_id -> photos.project_id was never validated), and
--   - INSERT/UPDATE attendance_logs rows for ANY project_id.
--
-- Fix: scope every write through public.user_can_access_project(...) (owner |
-- same company | explicit grant), matching the SELECT policies already
-- hardened in 20260731000001.

-- ── 1. drawing_pins: write policies must verify the photo's project ──

DROP POLICY IF EXISTS "Users create pins" ON drawing_pins;
DROP POLICY IF EXISTS "Users update own pins" ON drawing_pins;
DROP POLICY IF EXISTS "Users delete own pins" ON drawing_pins;

CREATE POLICY "Project members can create pins"
  ON drawing_pins FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM photos
      WHERE id = photo_id
        AND public.user_can_access_project(project_id)
    )
  );

CREATE POLICY "Project members can update their pins"
  ON drawing_pins FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM photos
      WHERE id = photo_id
        AND public.user_can_access_project(project_id)
    )
  )
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Project members can delete their pins"
  ON drawing_pins FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM photos
      WHERE id = photo_id
        AND public.user_can_access_project(project_id)
    )
  );

-- ── 2. attendance_logs: write policies must verify the project ──

DROP POLICY IF EXISTS "Users insert own check-in" ON attendance_logs;
DROP POLICY IF EXISTS "Users update own check-out" ON attendance_logs;

CREATE POLICY "Project members can insert own check-in"
  ON attendance_logs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_can_access_project(project_id)
  );

CREATE POLICY "Project members can update own check-out"
  ON attendance_logs FOR UPDATE
  USING (
    auth.uid() = user_id
    AND check_out IS NULL
    AND public.user_can_access_project(project_id)
  )
  WITH CHECK (auth.uid() = user_id);
