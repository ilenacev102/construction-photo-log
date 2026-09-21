-- Remediate stale RLS policies found by live remote verification (STOP-GATE 6+7).
--
-- Live verification of the linked remote (2026-08-11) found the remote was
-- built from an OLDER revision of the migration files, leaving it with:
--
--   7 STALE policies that exist on the remote but in ZERO local migration
--   files (confirmed via case-insensitive replay of all 34 migrations and
--   `git log --all -S ...`):
--     projects:   "Projects creatable by authenticated"          (INSERT)
--                 "Projects deletable by owners and admins"     (DELETE)
--                 "Projects updatable by owners and admins"     (UPDATE)
--     daily_logs: "Users insert own daily logs"                  (INSERT)
--                 "Users update own daily logs"                  (UPDATE)
--                 "Users delete own daily logs"                  (DELETE)
--                 "Users view own daily logs"                    (SELECT)
--
--   The daily_logs stale policies are the reason 20260811000002 (P2-2) was
--   INEFFECTIVE on the remote: it DROPs the NEW names ("Users can insert
--   their own daily logs" ...) which never existed there, so the DROP was a
--   no-op and the OLD permissive policies (auth.uid() = user_id only, no
--   project check) remained active. RLS permissive policies are OR-ed, so the
--   old ones still allow cross-project INSERT/UPDATE/DELETE.
--
--   4 MISSING owner-scoped projects policies (defined in 20260724000001 but
--   never created on the remote, which instead kept the legacy role-based
--   trio above). The migration chain's intended final state for projects is
--   owner-only write (auth.uid() = user_id) plus the project-membership
--   SELECT from 20260810000001.
--
-- Forward-only idempotency: DROP POLICY IF EXISTS precedes every CREATE
-- POLICY (re-running is harmless; on a fresh replay the owner-scoped
-- policies already exist from 20260724000001 and are simply dropped and
-- recreated with identical definitions).
DROP POLICY IF EXISTS "Projects creatable by authenticated" ON projects;
DROP POLICY IF EXISTS "Projects deletable by owners and admins" ON projects;
DROP POLICY IF EXISTS "Projects updatable by owners and admins" ON projects;

DROP POLICY IF EXISTS "Users insert own daily logs" ON daily_logs;
DROP POLICY IF EXISTS "Users update own daily logs" ON daily_logs;
DROP POLICY IF EXISTS "Users delete own daily logs" ON daily_logs;
DROP POLICY IF EXISTS "Users view own daily logs" ON daily_logs;

DROP POLICY IF EXISTS "Users can view own projects" ON projects;
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own projects" ON projects;
CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON projects;
CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);
