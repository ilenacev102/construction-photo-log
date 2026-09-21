-- Enable Realtime for comments and notifications
--
-- Purpose: allow Supabase Realtime to broadcast INSERT/UPDATE/DELETE on these
-- tables so the frontend can subscribe via postgres_changes without polling.
--
-- NOTE: RLS policies still apply — clients only receive rows they have
-- SELECT access to, so security is enforced at the database level.

-- ============================================================================
-- 1. Add tables to the supabase_realtime publication
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
