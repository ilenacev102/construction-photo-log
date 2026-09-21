-- Fix cross-tenant RLS leaks: role-based policies that were not scoped to the
-- caller's company. A user with role 'site_manager'/'foreman'/'photographer'
-- from company A could read/write rows belonging to company B.
--
-- Strategy: replace unscoped `role IN (...)` checks with
-- public.user_can_access_project(project_id) (owner | same company | grant).
-- Company identity is derived from profiles.company_name, which is how
-- membership works across the app (see 20260727000001_company_isolation.sql).

-- ── 1. Harden user_can_access_project (SECURITY DEFINER without search_path) ──
-- Storage policies call it as public.user_can_access_project(...), so the
-- name and signature stay the same; only pin search_path and qualify refs.

CREATE OR REPLACE FUNCTION public.user_can_access_project(project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  select exists (
    select 1 from public.projects
    where id = project_id
      and (
        user_id = auth.uid()
        or exists (
          select 1 from public.profiles
          where id = auth.uid()
            and company_name = (
              select company_name from public.profiles
              where id = (select user_id from public.projects where id = project_id)
            )
        )
        or exists (
          select 1 from public.user_permissions
          where user_id = auth.uid()
            and permission_key = 'project.VIEW.' || project_id
            and granted = true
        )
      )
  );
$$;

COMMENT ON FUNCTION public.user_can_access_project(uuid) IS
  'True if the current user owns the project, belongs to the owning company, or has a project.VIEW.<id> grant. SECURITY DEFINER — pinned search_path.';

-- ── 2. photos: owner-only → company-aware (also enables anon-key reads for team members) ──

DROP POLICY IF EXISTS "Users can view project photos" ON photos;
DROP POLICY IF EXISTS "Users can insert project photos" ON photos;
DROP POLICY IF EXISTS "Users can delete project photos" ON photos;

CREATE POLICY "Project members can view photos"
  ON photos FOR SELECT
  USING (public.user_can_access_project(project_id));

CREATE POLICY "Project members can upload photos"
  ON photos FOR INSERT
  WITH CHECK (public.user_can_access_project(project_id));

CREATE POLICY "Project members can delete photos"
  ON photos FOR DELETE
  USING (public.user_can_access_project(project_id));

-- ── 3. site_schemas: SELECT leaked to any role in any company; INSERT/DELETE were owner/admin-only ──

DROP POLICY IF EXISTS "Users view schemas in their projects" ON site_schemas;
DROP POLICY IF EXISTS "Project owners and admins insert schemas" ON site_schemas;
DROP POLICY IF EXISTS "Project owners and admins delete schemas" ON site_schemas;

CREATE POLICY "Project members can view schemas"
  ON site_schemas FOR SELECT
  USING (public.user_can_access_project(project_id));

CREATE POLICY "Project members can insert schemas"
  ON site_schemas FOR INSERT
  WITH CHECK (public.user_can_access_project(project_id));

CREATE POLICY "Project members can delete schemas"
  ON site_schemas FOR DELETE
  USING (public.user_can_access_project(project_id));

-- ── 4. schema_photo_pins: SELECT had no auth check at all (any user, any schema) ──

DROP POLICY IF EXISTS "Users view pins on their schemas" ON schema_photo_pins;
DROP POLICY IF EXISTS "Users insert pins" ON schema_photo_pins;
DROP POLICY IF EXISTS "Users delete their own pins" ON schema_photo_pins;

CREATE POLICY "Project members can view schema pins"
  ON schema_photo_pins FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM site_schemas
      WHERE id = schema_id
        AND public.user_can_access_project(project_id)
    )
  );

CREATE POLICY "Project members can insert schema pins"
  ON schema_photo_pins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM site_schemas
      WHERE id = schema_id
        AND public.user_can_access_project(project_id)
    )
  );

CREATE POLICY "Project members can delete schema pins"
  ON schema_photo_pins FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM site_schemas
      WHERE id = schema_id
        AND public.user_can_access_project(project_id)
    )
  );

-- ── 5. drawing_pins: SELECT scoped to owner/global admins → company-aware ──

DROP POLICY IF EXISTS "Users view pins on their photos" ON drawing_pins;

CREATE POLICY "Project members can view pins"
  ON drawing_pins FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM photos
      WHERE id = photo_id
        AND public.user_can_access_project(project_id)
    )
  );

-- ── 6. defects: SELECT/UPDATE/DELETE leaked across companies by role; INSERT had no project check ──

DROP POLICY IF EXISTS "Everyone can view defects in their projects" ON defects;
DROP POLICY IF EXISTS "Foremen and up can create defects" ON defects;
DROP POLICY IF EXISTS "Assigned users and managers can update defects" ON defects;
DROP POLICY IF EXISTS "Managers can delete defects" ON defects;

CREATE POLICY "Project members can view defects"
  ON defects FOR SELECT
  USING (public.user_can_access_project(project_id));

CREATE POLICY "Foremen and up can create defects in their projects"
  ON defects FOR INSERT
  WITH CHECK (
    public.user_can_access_project(project_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('foreman', 'site_manager', 'admin')
    )
  );

CREATE POLICY "Assigned users and project members can update defects"
  ON defects FOR UPDATE
  USING (
    auth.uid() = assigned_to
    OR auth.uid() = created_by
    OR (
      public.user_can_access_project(project_id)
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('site_manager', 'admin')
      )
    )
  );

CREATE POLICY "Project managers can delete defects"
  ON defects FOR DELETE
  USING (
    public.user_can_access_project(project_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('site_manager', 'admin')
    )
  );

-- ── 7. taggings helper: role-based global check → company-aware ──

CREATE OR REPLACE FUNCTION public.check_taggable_project_access(
  p_taggable_type text,
  p_taggable_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_taggable_type = 'defect' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.defects d
      WHERE d.id = p_taggable_id
        AND public.user_can_access_project(d.project_id)
    );
  ELSIF p_taggable_type = 'photo' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.photos ph
      WHERE ph.id = p_taggable_id
        AND public.user_can_access_project(ph.project_id)
    );
  ELSIF p_taggable_type = 'daily_log' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.daily_logs dl
      WHERE dl.id = p_taggable_id
        AND public.user_can_access_project(dl.project_id)
    );
  ELSE
    RETURN false;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.check_taggable_project_access(text, uuid) IS
  'True if the tagged entity belongs to a project the current user can access. SECURITY DEFINER — pinned search_path.';

-- ── 8. user_permissions: site_manager scope was global (any company) → same company only ──

DROP POLICY IF EXISTS "Managers and admins read all user_permissions" ON user_permissions;
DROP POLICY IF EXISTS "Managers can manage their team's user_permissions" ON user_permissions;

CREATE POLICY "Managers and admins read their team's user_permissions"
  ON user_permissions FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.role IN ('admin', 'site_manager')
        AND EXISTS (
          SELECT 1
          FROM public.profiles target
          WHERE target.id = user_permissions.user_id
            AND (me.role = 'admin' OR target.company_name = me.company_name)
        )
    )
  );

CREATE POLICY "Managers can manage their team's user_permissions"
  ON user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.role IN ('admin', 'site_manager')
        AND EXISTS (
          SELECT 1
          FROM public.profiles target
          WHERE target.id = user_permissions.user_id
            AND (me.role = 'admin' OR target.company_name = me.company_name)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.role IN ('admin', 'site_manager')
        AND EXISTS (
          SELECT 1
          FROM public.profiles target
          WHERE target.id = user_permissions.user_id
            AND (me.role = 'admin' OR target.company_name = me.company_name)
        )
    )
  );

-- ── 9. attendance_logs: manager view was global → company-aware ──

DROP POLICY IF EXISTS "Managers view project attendance" ON attendance_logs;
DROP POLICY IF EXISTS "Users view own attendance" ON attendance_logs;

CREATE POLICY "Project members can view attendance"
  ON attendance_logs FOR SELECT
  USING (public.user_can_access_project(project_id));

CREATE POLICY "Users view own attendance"
  ON attendance_logs FOR SELECT
  USING (auth.uid() = user_id);

-- ── 10. daily_logs: SELECT own-only → project members can see each other's logs ──

DROP POLICY IF EXISTS "Users can view their own daily logs" ON daily_logs;

CREATE POLICY "Project members can view daily logs"
  ON daily_logs FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.user_can_access_project(project_id)
  );
