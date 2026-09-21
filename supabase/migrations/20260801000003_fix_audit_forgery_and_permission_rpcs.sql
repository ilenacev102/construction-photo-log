-- P0-2 + P0-3 fix (independent security audit).
--
-- P0-2 — Audit-log forgery. The audit_logs INSERT RLS policy was relaxed to
--   WITH CHECK (auth.role() = 'authenticated') in 20260730000002:78-82, so any
--   browser session could forge compliance rows via raw PostgREST. Revert to a
--   deny-all policy: audit rows are written ONLY by the service-role app server
--   (createAdminClient in users/route.ts / permissions/route.ts), which
--   bypasses RLS entirely — so WITH CHECK (false) breaks no legitimate flow.
--
-- P0-3 — Permission RPCs broken at runtime. get_user_permissions /
--   user_has_permission (20260725000012:173-236) are SECURITY DEFINER with
--   SET search_path = '' but reference profiles/role_permissions/
--   user_permissions UNQUALIFIED, so every call raises
--   relation "profiles" does not exist. That made users PATCH and
--   permissions POST fail closed (403 for everyone) and admin.audit
--   revocations ineffective. Fix: qualify every table as public.*, exactly
--   mirroring the 20260731000001:14-42 pattern for user_can_access_project.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

-- ════════════════════════════════════════════════════════════════════════════
-- P0-2 — audit_logs INSERT: deny all at RLS (service role writes only)
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Service role insert audit logs" ON audit_logs;

CREATE POLICY "Service role insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (false);

-- ════════════════════════════════════════════════════════════════════════════
-- P0-3 — get_user_permissions: qualified public.* refs
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_user_permissions(target_user_id uuid)
RETURNS TABLE (permission_key text, granted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get the user's role
  SELECT p.role INTO user_role FROM public.profiles p WHERE p.id = target_user_id;

  RETURN QUERY
  -- Role defaults + user overrides, where override wins
  SELECT DISTINCT ON (rp.permission_key)
    rp.permission_key,
    COALESCE(up.granted, true) AS granted
  FROM public.role_permissions rp
  LEFT JOIN public.user_permissions up
    ON up.permission_key = rp.permission_key
    AND up.user_id = target_user_id
  WHERE rp.role = user_role
  ORDER BY rp.permission_key;

  -- Also include explicitly granted user overrides for non-role permissions
  RETURN QUERY
  SELECT up.permission_key, up.granted
  FROM public.user_permissions up
  WHERE up.user_id = target_user_id
    AND up.permission_key NOT IN (
      SELECT rp.permission_key
      FROM public.role_permissions rp
      WHERE rp.role = user_role
    );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- P0-3 — user_has_permission: qualified public.* refs
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.user_has_permission(target_user_id uuid, perm_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  has_perm boolean;
BEGIN
  -- First check user overrides
  SELECT granted INTO has_perm
  FROM public.user_permissions
  WHERE user_id = target_user_id AND permission_key = perm_key;

  IF FOUND THEN
    RETURN has_perm;
  END IF;

  -- Then check role defaults
  SELECT true INTO has_perm
  FROM public.role_permissions rp
  JOIN public.profiles p ON p.id = target_user_id
  WHERE rp.role = p.role AND rp.permission_key = perm_key;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.get_user_permissions(uuid) IS
  'Effective permission set for a user (role defaults + overrides). SECURITY DEFINER — pinned search_path, qualified refs.';
COMMENT ON FUNCTION public.user_has_permission(uuid, text) IS
  'True if the user has the permission (override wins over role default). SECURITY DEFINER — pinned search_path, qualified refs.';
