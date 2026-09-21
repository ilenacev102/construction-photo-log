-- Work orders: assignee update guard (fixes two RLS gaps in 20260810000002).
--
-- The 20260810000002 "Assignee can update their own work order status"
-- policy uses WITH CHECK (assigned_to = auth.uid() AND status IN (...)),
-- which validates only the NEW row: it cannot compare OLD vs NEW. As a
-- result RLS allowed:
--   1. regression  done -> in_progress  (status value still in the allowed set)
--   2. assignees editing ANY column (title, description, ...), not just status
-- The API routes block both, but the migration's own comments claimed RLS
-- enforced "may never regress" — it did not. WITH CHECK / CHECK constraints
-- cannot reference OLD; only a BEFORE UPDATE trigger can compare OLD vs NEW.
--
-- Rules enforced for a row that already passed RLS:
--   * service_role (the API's admin client)  -> allow everything (API enforces)
--   * owning-company site_manager/admin      -> allow everything (full rights)
--   * assignee (anyone else that got through) -> status column only, strictly
--     forward: pending -> in_progress -> done (no-op allowed); never
--     backwards, never cancelled.
--
-- NOTE: Review before running. Apply with: supabase db push  (or the SQL editor).

-- ============================================================================
-- 1. Guard function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guard_work_order_assignee_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  is_company_manager boolean;
BEGIN
  -- service_role (API admin client) does the real enforcement in code;
  -- superusers (SQL editor, ad-hoc fixes) bypass RLS already, so the
  -- guard must not block them either (auth.uid() is NULL for them).
  IF current_user = 'service_role'
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper)
  THEN
    RETURN NEW;
  END IF;

  -- Owning-company site_manager/admin (admin bypasses the company match):
  -- full rights — mirrors the "Managers can manage work orders" policy and
  -- the PATCH route's manager branch (manager keeps full rights even when
  -- also the assignee).
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role IN ('admin', 'site_manager')
      AND EXISTS (
        SELECT 1
        FROM public.projects p
        JOIN public.profiles owner ON owner.id = p.user_id
        WHERE p.id = NEW.project_id
          AND (me.role = 'admin' OR owner.company_name = me.company_name)
      )
  ) INTO is_company_manager;

  IF is_company_manager THEN
    RETURN NEW;
  END IF;

  -- Assignee path: only the status column may change.
  IF (NEW.project_id IS DISTINCT FROM OLD.project_id)
     OR (NEW.title IS DISTINCT FROM OLD.title)
     OR (NEW.description IS DISTINCT FROM OLD.description)
     OR (NEW.location IS DISTINCT FROM OLD.location)
     OR (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)
     OR (NEW.assigned_by IS DISTINCT FROM OLD.assigned_by)
     OR (NEW.priority IS DISTINCT FROM OLD.priority)
     OR (NEW.due_date IS DISTINCT FROM OLD.due_date)
  THEN
    RAISE EXCEPTION 'Assignee may only update the status of their own work order';
  END IF;

  -- Status must move strictly forward (no-op allowed).
  IF NOT (
    (OLD.status = NEW.status)
    OR (OLD.status = 'pending'    AND NEW.status = 'in_progress')
    OR (OLD.status = 'in_progress' AND NEW.status = 'done')
  ) THEN
    RAISE EXCEPTION 'Work order status may only advance forward (pending -> in_progress -> done)';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. Trigger
-- ============================================================================
DROP TRIGGER IF EXISTS trg_work_orders_assignee_guard ON public.work_orders;

CREATE TRIGGER trg_work_orders_assignee_guard
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_work_order_assignee_update();

COMMENT ON TRIGGER trg_work_orders_assignee_guard ON public.work_orders IS
  'Enforces assignee updates as status-only and strictly forward (pending -> in_progress -> done); managers and service_role are unaffected.';
