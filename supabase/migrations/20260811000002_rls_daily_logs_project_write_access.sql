-- daily_logs: scope write policies to the project (P2-2).
--
-- The INSERT/UPDATE/DELETE policies created in 20260725000003 only checked
-- auth.uid() = user_id, so a user could insert a log into ANY project_id or
-- UPDATE-move an existing log into another project (cross-company integrity
-- pollution). The SELECT policy was already project-scoped via
-- public.user_can_access_project (20260731000001 §10), but the write paths
-- were not.
--
-- Fix: every write policy now requires BOTH:
--   * auth.uid() = user_id                        (the row belongs to the caller)
--   * public.user_can_access_project(project_id)  (the project is theirs /
--     same company / explicit grant — same gate the SELECT policy uses)
--
-- UPDATE gets the check in both USING (the row being changed must live in an
-- accessible project) and WITH CHECK (the target project must be accessible),
-- which also stops "moving" a log between projects.
--
-- DELETE: project check added for defense-in-depth. Without it, a user who
-- retains write access to a log row could delete it even when the row's
-- project is no longer accessible to them — inconsistent with the SELECT and
-- INSERT gates. Risk of the extra check (a user cannot delete legacy rows in
-- a project they lost access to) is acceptable: logs are append-only history,
-- and write access to a project should gate deletion just as it gates insert.
--
-- Forward-only idempotency: DROP POLICY IF EXISTS before each CREATE POLICY
-- (re-running is harmless). The SELECT policy from 20260731000001
-- ("Project members can view daily logs") is intentionally left untouched.
DROP POLICY IF EXISTS "Users can insert their own daily logs" ON daily_logs;
DROP POLICY IF EXISTS "Users can update their own daily logs" ON daily_logs;
DROP POLICY IF EXISTS "Users can delete their own daily logs" ON daily_logs;

CREATE POLICY "Users can insert their own daily logs"
  ON daily_logs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_can_access_project(project_id)
  );

CREATE POLICY "Users can update their own daily logs"
  ON daily_logs FOR UPDATE
  USING (
    auth.uid() = user_id
    AND public.user_can_access_project(project_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_can_access_project(project_id)
  );

CREATE POLICY "Users can delete their own daily logs"
  ON daily_logs FOR DELETE
  USING (
    auth.uid() = user_id
    AND public.user_can_access_project(project_id)
  );
