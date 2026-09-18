-- Per-project member management (client portal track).
--
-- Purpose: let a project's owning company attach specific users to a specific
-- project with a project-scoped role. This complements the existing access
-- model:
--   * company_name on profiles  -> access to ALL projects owned by the company
--   * user_permissions          -> cross-company read-only grants (project.VIEW.<id>)
--   * project_members           -> explicit per-project membership + project role
-- The project owner / company already has access via the two mechanisms above;
-- this table is the source of truth for who is "on" a project and what they may
-- do there, and backs the Members tab (site_manager+) in the project layout.
--
-- NOTE: Review before running. Apply with: supabase db push  (or the SQL editor).

-- ============================================================================
-- 1. Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('photographer','foreman','site_manager','client')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON project_members (project_id);
CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON project_members (user_id);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE project_members IS
  'Explicit per-project membership with a project-scoped role. Managed by the owning company (site_manager/admin), readable by anyone with project access.';
COMMENT ON COLUMN project_members.role IS
  'Project-scoped role: client = read-only portal member; photographer/foreman/site_manager = working roles on this project.';

-- ============================================================================
-- 2. RLS policies
-- ============================================================================

-- SELECT: the member themselves, or anyone who can access the project
-- (owner | same company | project.VIEW grant — via user_can_access_project).
DROP POLICY IF EXISTS "Project members and managers can view members" ON project_members;

CREATE POLICY "Project members and managers can view members"
  ON project_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.user_can_access_project(project_id)
  );

-- INSERT/UPDATE/DELETE: only the owning company's site_manager/admin (admin
-- bypasses the company match). Mirrors the user_permissions management policy
-- (20260731000001 §8) and the invite route's role gate.
DROP POLICY IF EXISTS "Managers can manage project members" ON project_members;

CREATE POLICY "Managers can manage project members"
  ON project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.role IN ('admin', 'site_manager')
        AND EXISTS (
          SELECT 1
          FROM public.projects p
          JOIN public.profiles owner ON owner.id = p.user_id
          WHERE p.id = project_members.project_id
            AND (me.role = 'admin' OR owner.company_name = me.company_name)
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
          FROM public.projects p
          JOIN public.profiles owner ON owner.id = p.user_id
          WHERE p.id = project_members.project_id
            AND (me.role = 'admin' OR owner.company_name = me.company_name)
        )
    )
  );
