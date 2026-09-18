-- Fix work_order_defects RLS: replace permissive policies with project-scoped access.
--
-- Problem: the original migration (20260826000001) created policies that allow
-- ANY authenticated user to SELECT/INSERT/DELETE rows in work_order_defects.
-- This bypasses the multi-tenant boundary — a user from Company A could read
-- or modify defect associations for Company B's work orders.
--
-- Fix: mirror the work_orders RLS pattern:
--   SELECT  -> user_can_access_project(work_order's project_id)
--   INSERT  -> company site_manager/admin (same check as work_orders ALL policy)
--   DELETE  -> company site_manager/admin
--
-- NOTE: Review before running. Apply with: supabase db push (or the SQL editor).

-- ============================================================================
-- 1. Drop permissive policies
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view work_order_defects" ON work_order_defects;
DROP POLICY IF EXISTS "Authenticated users can insert work_order_defects" ON work_order_defects;
DROP POLICY IF EXISTS "Authenticated users can delete work_order_defects" ON work_order_defects;

-- ============================================================================
-- 2. SELECT — anyone who can access the parent work order's project
-- ============================================================================
CREATE POLICY "Users with project access can view work_order_defects"
  ON work_order_defects FOR SELECT
  USING (
    public.user_can_access_project(
      (SELECT wo.project_id FROM public.work_orders wo WHERE wo.id = work_order_defects.work_order_id)
    )
  );

-- ============================================================================
-- 3. INSERT / DELETE — owning-company site_manager or admin only
--    (mirrors the "Managers can manage work orders" policy in 20260810000002)
-- ============================================================================
CREATE POLICY "Managers can manage work_order_defects"
  ON work_order_defects FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.role IN ('admin', 'site_manager')
        AND EXISTS (
          SELECT 1
          FROM public.work_orders wo
          JOIN public.projects p ON p.id = wo.project_id
          JOIN public.profiles owner ON owner.id = p.user_id
          WHERE wo.id = work_order_defects.work_order_id
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
          FROM public.work_orders wo
          JOIN public.projects p ON p.id = wo.project_id
          JOIN public.profiles owner ON owner.id = p.user_id
          WHERE wo.id = work_order_defects.work_order_id
            AND (me.role = 'admin' OR owner.company_name = me.company_name)
        )
    )
  );
