-- Work orders (client portal track).
--
-- Purpose: let a project's owning company create, assign, and track work
-- orders against a project. Complements the existing access model:
--   * user_can_access_project   -> who may view a project (owner | same company | project.VIEW grant)
--   * project_members           -> explicit per-project membership + project role
-- Work orders are the follow-up layer on top of projects: a site_manager/admin
-- of the owning company creates and assigns them; the assignee (any user with
-- project access) can view and advance their own order's status. The API routes
-- do the real enforcement; RLS here is defense-in-depth.
--
-- NOTE: Review before running. Apply with: supabase db push  (or the SQL editor).

-- ============================================================================
-- 1. Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_by uuid NOT NULL REFERENCES profiles(id),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_orders_project_id_idx ON work_orders (project_id);
CREATE INDEX IF NOT EXISTS work_orders_assigned_to_idx ON work_orders (assigned_to);
CREATE INDEX IF NOT EXISTS work_orders_status_idx ON work_orders (status);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE work_orders IS
  'Project-scoped work order: a task created by the owning company (site_manager/admin), assigned to a user, and tracked to completion. Managed by managers; the assignee may view and advance their own order.';
COMMENT ON COLUMN work_orders.status IS
  'Lifecycle: pending -> in_progress -> done. cancelled may only be set by a manager; the assignee can never cancel an order.';
COMMENT ON COLUMN work_orders.priority IS
  'Importance of the order: low, medium (default), or high.';
COMMENT ON COLUMN work_orders.assigned_to IS
  'User the order is assigned to (nullable until assigned). The assignee may view the order and update its status, but never cancel it.';
COMMENT ON COLUMN work_orders.assigned_by IS
  'Manager of the owning company who created/assigned the order.';

-- ============================================================================
-- 2. RLS policies
-- ============================================================================

-- SELECT: anyone who can access the project, or the assignee themselves
-- (owner | same company | project.VIEW grant — via user_can_access_project).
DROP POLICY IF EXISTS "Anyone with project access or the assignee can view" ON work_orders;

CREATE POLICY "Anyone with project access or the assignee can view"
  ON work_orders FOR SELECT
  USING (
    public.user_can_access_project(project_id)
    OR auth.uid() = assigned_to
  );

-- INSERT/UPDATE/DELETE: only the owning company's site_manager/admin (admin
-- bypasses the company match). Mirrors the "Managers can manage project
-- members" policy (20260806000002) and the invite route's role gate.
DROP POLICY IF EXISTS "Managers can manage work orders" ON work_orders;

CREATE POLICY "Managers can manage work orders"
  ON work_orders FOR ALL
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
          WHERE p.id = work_orders.project_id
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
          WHERE p.id = work_orders.project_id
            AND (me.role = 'admin' OR owner.company_name = me.company_name)
        )
    )
  );

-- UPDATE: the assignee may advance their own order's status (pending ->
-- in_progress -> done), but may never regress or cancel it (cancelled and
-- regression to pending are manager-only). Mirrors the API's FORWARD map.
DROP POLICY IF EXISTS "Assignee can update their own work order status" ON work_orders;

CREATE POLICY "Assignee can update their own work order status"
  ON work_orders FOR UPDATE
  USING (auth.uid() = assigned_to)
  WITH CHECK (auth.uid() = assigned_to AND status IN ('in_progress','done'));
