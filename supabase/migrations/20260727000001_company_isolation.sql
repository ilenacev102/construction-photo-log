-- ──────────────────────────────────────────────────────────────────────────────
-- Multi-tenant company isolation — dormant migration
-- Apply when supabase DB direct access is available (requires DB password)
-- Current implementation uses API-level filtering via `/api/db/route.ts`
-- This migration enforces the same rules at the DB level for defense-in-depth.
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Add company_name to projects for direct-filtering (avoids join through profiles)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_name TEXT;
CREATE INDEX IF NOT EXISTS idx_projects_company_name ON projects(company_name);

-- 2. Backfill: copy company_name from the project owner's profile
UPDATE projects p
SET company_name = pr.company_name
FROM profiles pr
WHERE p.user_id = pr.id
  AND p.company_name IS NULL;

-- 3. Make company_name NOT NULL once backfilled
--    (run separately after verifying backfill: SELECT count(*) FROM projects WHERE company_name IS NULL)
-- ALTER TABLE projects ALTER COLUMN company_name SET NOT NULL;

-- 4. Index for cross-company permission lookups
CREATE INDEX IF NOT EXISTS idx_user_permissions_lookup
  ON user_permissions(user_id, permission_key)
  WHERE granted = true;

-- 5. Index for company-scoped profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_company_name
  ON profiles(company_name);

-- 6. Enable RLS on all tenant-scoped tables (currently uses service_role key, so RLS is bypassed)
--    When ready to switch to anon key, uncomment and tune the policies below.

-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE defects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE site_schemas ENABLE ROW LEVEL SECURITY;

-- 7. Example RLS policy: company-scoped project access
-- CREATE POLICY company_project_access ON projects
--   FOR ALL
--   USING (
--     company_name = (SELECT company_name FROM profiles WHERE id = auth.uid())
--     OR
--     EXISTS (
--       SELECT 1 FROM user_permissions
--       WHERE user_id = auth.uid()
--         AND permission_key = 'project.VIEW.' || id
--         AND granted = true
--     )
--   );

-- 8. Example RLS policy: company-scoped photo access
-- CREATE POLICY company_photo_access ON photos
--   FOR ALL
--   USING (
--     project_id IN (
--       SELECT id FROM projects WHERE company_name = (SELECT company_name FROM profiles WHERE id = auth.uid())
--     )
--     OR
--     EXISTS (
--       SELECT 1 FROM user_permissions
--       WHERE user_id = auth.uid()
--         AND permission_key = 'project.VIEW.' || project_id
--         AND granted = true
--     )
--   );
