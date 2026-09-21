-- Comments & Collaboration
--
-- Purpose: enable threaded comments with @mentions on photos, defects, and
-- work orders. Uses a polymorphic pattern (entity_type + entity_id) so a
-- single comments table covers all three entity types.
--
-- Tables:
--   comments           – the comments themselves (single-level threading)
--   comment_mentions   – tracks which users were @mentioned in each comment
--   notifications      – per-user inbox for mention & reply notifications
--
-- NOTE: Review before running. Apply with: supabase db push (or the SQL editor).

-- ============================================================================
-- 1. Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('photo', 'defect', 'work_order')),
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE comments IS
  'Polymorphic threaded comments on photos, defects, and work orders. Single-level threading via parent_id.';

-- ----------

CREATE TABLE IF NOT EXISTS comment_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned ON comment_mentions (mentioned_user_id);

ALTER TABLE comment_mentions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE comment_mentions IS
  'Tracks which users were @mentioned in a given comment.';

-- ----------

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'mention' CHECK (type IN ('mention', 'reply')),
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE notifications IS
  'Per-user notifications for mentions and replies.';

-- ============================================================================
-- 2. RLS policies
-- ============================================================================

-- --- comments ---

-- SELECT: anyone with access to the parent entity's project can view comments.
--   photo      → check photos.project_id
--   defect     → check defects.project_id
--   work_order → check work_orders.project_id
DROP POLICY IF EXISTS "Users with project access can view comments" ON comments;

CREATE POLICY "Users with project access can view comments"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = CASE comments.entity_type
        WHEN 'photo'      THEN (SELECT project_id FROM photos     WHERE id = comments.entity_id)
        WHEN 'defect'     THEN (SELECT project_id FROM defects    WHERE id = comments.entity_id)
        WHEN 'work_order' THEN (SELECT project_id FROM work_orders WHERE id = comments.entity_id)
      END
      AND public.user_can_access_project(p.id)
    )
  );

-- INSERT: any authenticated user can insert their own comment
DROP POLICY IF EXISTS "Authenticated users can insert their own comments" ON comments;

CREATE POLICY "Authenticated users can insert their own comments"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: comment author can update their own comment (body only)
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: comment author, or a manager of the parent entity's project
DROP POLICY IF EXISTS "Authors and managers can delete comments" ON comments;

CREATE POLICY "Authors and managers can delete comments"
  ON comments FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.role IN ('admin', 'site_manager')
        AND EXISTS (
          SELECT 1
          FROM public.projects p
          JOIN public.profiles owner ON owner.id = p.user_id
          WHERE p.id = CASE comments.entity_type
            WHEN 'photo'      THEN (SELECT project_id FROM photos     WHERE id = comments.entity_id)
            WHEN 'defect'     THEN (SELECT project_id FROM defects    WHERE id = comments.entity_id)
            WHEN 'work_order' THEN (SELECT project_id FROM work_orders WHERE id = comments.entity_id)
          END
          AND (me.role = 'admin' OR owner.company_name = me.company_name)
        )
    )
  );

-- --- comment_mentions ---

-- SELECT: mentioned user or comment author can view mentions
DROP POLICY IF EXISTS "Mentioned users can view mentions" ON comment_mentions;

CREATE POLICY "Mentioned users can view mentions"
  ON comment_mentions FOR SELECT
  USING (
    auth.uid() = mentioned_user_id
    OR auth.uid() = (SELECT user_id FROM comments WHERE id = comment_mentions.comment_id)
  );

-- INSERT: comment author can insert mentions for their own comment
DROP POLICY IF EXISTS "Comment authors can insert mentions" ON comment_mentions;

CREATE POLICY "Comment authors can insert mentions"
  ON comment_mentions FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM comments WHERE id = comment_mentions.comment_id)
  );

-- DELETE: cascade handles cleanup; no direct delete policy needed

-- --- notifications ---

-- SELECT: users see only their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: system inserts via the comment author's session
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;

CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can mark their own notifications as read
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comment_updated_at ON comments;

CREATE TRIGGER comment_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_updated_at();
