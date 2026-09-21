-- Fix RLS infinite recursion on profiles table
--
-- Root cause: Policies that check `SELECT 1 FROM profiles WHERE id = auth.uid()
-- AND role = '...'` trigger RLS on profiles, which re-evaluates the same
-- policies, causing infinite recursion.
--
-- Fix: Create SECURITY DEFINER helper functions that bypass RLS for role
-- checks, then rewrite all affected policies to use them.

-- ── 1. SECURITY DEFINER helpers (bypass RLS) ──

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
  RETURN user_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_has_role(required_roles text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
  RETURN user_role = ANY(required_roles);
END;
$$;

COMMENT ON FUNCTION public.auth_role() IS
  'Returns the current user''s role, bypassing RLS. Used inside policies.';
COMMENT ON FUNCTION public.auth_has_role(text[]) IS
  'Returns true if the current user has one of the given roles, bypassing RLS. Used inside policies.';

-- ── 2. Fix policies on profiles ──

DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;

CREATE POLICY "Admins read all profiles"
  ON profiles FOR SELECT
  USING (public.auth_has_role(ARRAY['admin']));

-- ── 3. Fix policies on user_permissions ──

DROP POLICY IF EXISTS "Managers and admins read all user_permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can manage user_permissions" ON user_permissions;
DROP POLICY IF EXISTS "Managers can manage their team's user_permissions" ON user_permissions;

CREATE POLICY "Managers and admins read all user_permissions"
  ON user_permissions FOR SELECT
  USING (public.auth_has_role(ARRAY['admin', 'site_manager']));

CREATE POLICY "Admins can manage user_permissions"
  ON user_permissions FOR ALL
  USING (public.auth_has_role(ARRAY['admin']));

CREATE POLICY "Managers can manage their team's user_permissions"
  ON user_permissions FOR ALL
  USING (public.auth_has_role(ARRAY['admin', 'site_manager']));

-- ── 4. Fix policies on defects ──

DROP POLICY IF EXISTS "Everyone can view defects in their projects" ON defects;

CREATE POLICY "Everyone can view defects in their projects"
  ON defects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_id AND (
        projects.user_id = auth.uid() OR
        public.auth_has_role(ARRAY['site_manager', 'foreman', 'admin'])
      )
    )
  );

DROP POLICY IF EXISTS "Foremen and up can create defects" ON defects;

CREATE POLICY "Foremen and up can create defects"
  ON defects FOR INSERT
  WITH CHECK (public.auth_has_role(ARRAY['foreman', 'site_manager', 'admin']));

DROP POLICY IF EXISTS "Assigned users and managers can update defects" ON defects;

CREATE POLICY "Assigned users and managers can update defects"
  ON defects FOR UPDATE
  USING (
    auth.uid() = assigned_to OR
    auth.uid() = created_by OR
    public.auth_has_role(ARRAY['site_manager', 'admin'])
  );

DROP POLICY IF EXISTS "Managers can delete defects" ON defects;

CREATE POLICY "Managers can delete defects"
  ON defects FOR DELETE
  USING (public.auth_has_role(ARRAY['site_manager', 'admin']));

-- ── 5. Fix policies on drawing_pins ──

DROP POLICY IF EXISTS "Users view pins on their photos" ON drawing_pins;

CREATE POLICY "Users view pins on their photos"
  ON drawing_pins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM photos WHERE id = photo_id AND (
        photos.user_id = auth.uid() OR
        public.auth_has_role(ARRAY['site_manager', 'admin'])
      )
    )
  );

-- ── 6. Fix policies on audit_logs ──

DROP POLICY IF EXISTS "Admins read audit logs" ON audit_logs;

CREATE POLICY "Admins read audit logs"
  ON audit_logs FOR SELECT
  USING (public.auth_has_role(ARRAY['admin']));

-- ── 7. Fix policies on subscriptions ──

DROP POLICY IF EXISTS "Admins read all subscriptions" ON subscriptions;

CREATE POLICY "Admins read all subscriptions"
  ON subscriptions FOR SELECT
  USING (public.auth_has_role(ARRAY['admin']));

-- ── 8. Fix policies on site_schemas ──

DROP POLICY IF EXISTS "Project owners and admins insert schemas" ON site_schemas;

CREATE POLICY "Project owners and admins insert schemas"
  ON site_schemas FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM projects WHERE id = project_id
    )
    OR
    public.auth_has_role(ARRAY['admin'])
  );

DROP POLICY IF EXISTS "Project owners and admins delete schemas" ON site_schemas;

CREATE POLICY "Project owners and admins delete schemas"
  ON site_schemas FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM projects WHERE id = project_id
    )
    OR
    public.auth_has_role(ARRAY['admin'])
  );

DROP POLICY IF EXISTS "Users delete their own pins" ON schema_photo_pins;

CREATE POLICY "Users delete their own pins"
  ON schema_photo_pins FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM photos WHERE id = photo_id
    )
    OR
    public.auth_has_role(ARRAY['site_manager', 'admin'])
  );
