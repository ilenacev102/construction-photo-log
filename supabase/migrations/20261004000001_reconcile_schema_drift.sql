-- Reconcile schema drift between the migrations that were recorded as applied
-- and the schema the application actually queries.
--
-- Verified live on 2026-10-04 against project mqimwzcbhbzdpthjeqcj:
--   * `work_order_defects`          -> to_regclass() = NULL (table never created)
--   * `comments.project_id`         -> column absent, but /api/notifications
--                                      selects it and NotificationDropdown
--                                      navigates with it (500 for every user)
--   * `projects.company_name`       -> column absent; fixed in application
--                                      code by dropping it from the select list,
--                                       because nothing reads it (company is
--                                       always resolved through `profiles`).
--
-- Everything below is additive and idempotent.

-- ============================================================================
-- 1. comments.project_id — the project the commented entity belongs to
-- ============================================================================

ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS project_id uuid
  REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_project_id ON public.comments(project_id);

-- Fill project_id from the polymorphic entity (entity_type is constrained to
-- photo | defect | work_order by 20260825120000).
UPDATE public.comments c
SET project_id = CASE c.entity_type
  WHEN 'photo'      THEN (SELECT p.project_id FROM public.photos     p WHERE p.id = c.entity_id)
  WHEN 'defect'     THEN (SELECT d.project_id FROM public.defects    d WHERE d.id = c.entity_id)
  WHEN 'work_order' THEN (SELECT w.project_id FROM public.work_orders w WHERE w.id = c.entity_id)
END
WHERE c.project_id IS NULL;

-- Keep it populated for every writer, not just the API: the column is what
-- makes a notification clickable, and a NULL here silently 404s the link.
CREATE OR REPLACE FUNCTION public.set_comment_project_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  NEW.project_id := CASE NEW.entity_type
    WHEN 'photo'      THEN (SELECT p.project_id FROM public.photos     p WHERE p.id = NEW.entity_id)
    WHEN 'defect'     THEN (SELECT d.project_id FROM public.defects    d WHERE d.id = NEW.entity_id)
    WHEN 'work_order' THEN (SELECT w.project_id FROM public.work_orders w WHERE w.id = NEW.entity_id)
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comments_set_project_id ON public.comments;
CREATE TRIGGER trg_comments_set_project_id
  BEFORE INSERT OR UPDATE OF entity_type, entity_id
  ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_comment_project_id();

-- ============================================================================
-- 2. work_order_defects — junction between work orders and defects
--     Created only in web/supabase/migrations (project_id = "web"), never in
--     this chain, so 4 handlers failed with PGRST205. RLS is the reviewed
--     project-scoped version, not the original "any authenticated user" one.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.work_order_defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  defect_id uuid NOT NULL REFERENCES public.defects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, defect_id)
);

ALTER TABLE public.work_order_defects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view work_order_defects" ON public.work_order_defects;
DROP POLICY IF EXISTS "Authenticated users can insert work_order_defects" ON public.work_order_defects;
DROP POLICY IF EXISTS "Authenticated users can delete work_order_defects" ON public.work_order_defects;
DROP POLICY IF EXISTS "Users with project access can view work_order_defects" ON public.work_order_defects;
DROP POLICY IF EXISTS "Managers can manage work_order_defects" ON public.work_order_defects;

CREATE POLICY "Users with project access can view work_order_defects"
  ON public.work_order_defects FOR SELECT
  USING (
    public.user_can_access_project(
      (SELECT wo.project_id FROM public.work_orders wo WHERE wo.id = work_order_defects.work_order_id)
    )
  );

CREATE POLICY "Managers can manage work_order_defects"
  ON public.work_order_defects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
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
      SELECT 1 FROM public.profiles me
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
