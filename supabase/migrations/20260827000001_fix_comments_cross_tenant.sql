-- P0: scope comments INSERT/UPDATE through project access (cross-tenant write fix).
--
-- The original policies only checked `auth.uid() = user_id`, so any
-- authenticated user could:
--   - INSERT a comment on a photo/defect/work_order belonging to ANY
--     company's project (entity_id -> project_id was never validated), and
--   - UPDATE their own comment on such a foreign entity.
--
-- This is the same bug class as P1-5/P1-6 (fixed for drawing_pins and
-- attendance_logs in 20260801000006). The SELECT and DELETE policies on
-- comments were already project-scoped; only INSERT/UPDATE were left open.
--
-- Fix: scope every write through public.user_can_access_project(...) (owner |
-- same company | explicit grant), resolving the parent entity's project via
-- the same polymorphic CASE the SELECT policy uses. A CASE with no matching
-- branch yields NULL, which matches no project row, so malformed
-- entity_type/entity_id combinations fail closed (deny).
--
-- NOTE: comment_mentions INSERT is transitively closed for NEW comments
-- (it requires authorship of the comment, which can no longer be created
-- cross-tenant). Pre-existing foreign comments could still receive mentions;
-- tracked as residual risk, see report.

-- ── comments: INSERT must verify the parent entity's project ──

DROP POLICY IF EXISTS "Authenticated users can insert their own comments" ON comments;

CREATE POLICY "Project members can insert comments"
  ON comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = CASE entity_type
        WHEN 'photo'      THEN (SELECT project_id FROM public.photos      WHERE id = entity_id)
        WHEN 'defect'     THEN (SELECT project_id FROM public.defects     WHERE id = entity_id)
        WHEN 'work_order' THEN (SELECT project_id FROM public.work_orders  WHERE id = entity_id)
      END
      AND public.user_can_access_project(p.id)
    )
  );

-- ── comments: UPDATE must verify the parent entity's project ──

DROP POLICY IF EXISTS "Users can update their own comments" ON comments;

CREATE POLICY "Project members can update own comments"
  ON comments FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = CASE entity_type
        WHEN 'photo'      THEN (SELECT project_id FROM public.photos      WHERE id = entity_id)
        WHEN 'defect'     THEN (SELECT project_id FROM public.defects     WHERE id = entity_id)
        WHEN 'work_order' THEN (SELECT project_id FROM public.work_orders  WHERE id = entity_id)
      END
      AND public.user_can_access_project(p.id)
    )
  )
  WITH CHECK (auth.uid() = user_id);
