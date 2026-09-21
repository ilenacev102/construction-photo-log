-- Fix RLS policies to work with anon key (service_role → anon transition)
--
-- Root cause: Several policies reference photos.user_id, but the photos table
-- does not have a user_id column (ownership is through projects.user_id).
-- These policies would fail at runtime when using anon key (RLS active).
--
-- Also tightens audit_logs and site_schemas policies that are too permissive.
--
-- Fix: Rewrite all policies to use JOIN through photos.project_id → projects.user_id.

-- ── 1. Clean up broken index (referenced non-existent column) ──
DROP INDEX IF EXISTS idx_photos_user_id;

-- ── 2. Fix drawing_pins SELECT policy ──
-- Old: photos.user_id = auth.uid() (column does not exist)
-- New: join through projects

DROP POLICY IF EXISTS "Users view pins on their photos" ON drawing_pins;

CREATE POLICY "Users view pins on their photos"
  ON drawing_pins FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM photos
      JOIN projects ON projects.id = photos.project_id
      WHERE photos.id = photo_id
        AND (
          projects.user_id = auth.uid()
          OR public.auth_has_role(ARRAY['site_manager', 'admin'])
        )
    )
  );

-- ── 3. Fix schema_photo_pins INSERT policy ──
-- Old: auth.uid() IN (SELECT user_id FROM photos WHERE id = photo_id)
-- New: join through projects

DROP POLICY IF EXISTS "Users insert pins" ON schema_photo_pins;

CREATE POLICY "Users insert pins"
  ON schema_photo_pins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM photos
      JOIN projects ON projects.id = photos.project_id
      WHERE photos.id = photo_id
        AND projects.user_id = auth.uid()
    )
  );

-- ── 4. Fix schema_photo_pins DELETE policy ──
-- Old: auth.uid() IN (SELECT user_id FROM photos WHERE id = photo_id)
-- New: join through projects

DROP POLICY IF EXISTS "Users delete their own pins" ON schema_photo_pins;

CREATE POLICY "Users delete their own pins"
  ON schema_photo_pins FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM photos
      JOIN projects ON projects.id = photos.project_id
      WHERE photos.id = photo_id
        AND (
          projects.user_id = auth.uid()
          OR public.auth_has_role(ARRAY['site_manager', 'admin'])
        )
    )
  );

-- ── 5. Tighten audit_logs INSERT policy ──
-- Old: WITH CHECK (true) — any role can insert, even anon
-- New: only authenticated users can insert

DROP POLICY IF EXISTS "Service role insert audit logs" ON audit_logs;

CREATE POLICY "Service role insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ── 6. Fix site_schemas SELECT policy ──
-- Old: only checks project EXISTS (no auth — anyone with project_id can view)
-- New: requires project ownership or appropriate role

DROP POLICY IF EXISTS "Users view schemas in their projects" ON site_schemas;

CREATE POLICY "Users view schemas in their projects"
  ON site_schemas FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM projects
      WHERE id = project_id
        AND (
          user_id = auth.uid()
          OR public.auth_has_role(ARRAY['admin', 'site_manager', 'foreman', 'photographer'])
        )
    )
  );
