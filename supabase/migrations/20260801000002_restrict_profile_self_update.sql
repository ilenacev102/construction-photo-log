-- P0-1 fix (independent security audit): DB-level privilege self-escalation.
--
-- Root cause: the "Users update own profile" RLS policy (20260725000004:22-25)
-- is row-scoped only (auth.uid() = id). Any browser session can run
--   supabase.from('profiles').update({ role: 'admin', company_name: '<victim>' })
-- and RLS permits it, silently defeating isAdminUser, requireProjectAccess and
-- the company-scoping model (company_name string-match join in company-auth).
--
-- Fix (both layers, per audit recommendation "do all"):
--   1. Column-level UPDATE grants: authenticated may update only
--      (full_name, avatar_url, phone) — role/company_name stay server/admin-only.
--   2. SECURITY DEFINER BEFORE UPDATE OF role, company_name trigger that raises
--      for any non-service-role caller changing those columns (defense in depth).
--
-- The app writes profiles exclusively via the service_role admin client
-- (users/route.ts PATCH, invite flow) which bypasses both RLS and these grants,
-- so no legitimate flow is affected.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

-- ── 1. Column-level UPDATE grants ──
-- Revoke blanket UPDATE, then re-grant only the non-privileged columns.
REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (full_name, avatar_url, phone) ON public.profiles TO authenticated;

-- ── 2. BEFORE UPDATE trigger guarding role/company_name ──
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Service-role requests (app server / admin client) are trusted.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Any other caller changing role or company_name is rejected, even on their
  -- own row. Column grants already block this for `authenticated`; this trigger
  -- is defense in depth (e.g. future column grants, other roles).
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.company_name IS DISTINCT FROM OLD.company_name THEN
    RAISE EXCEPTION 'PROFILE_PRIVILEGED_COLUMN_CHANGE_FORBIDDEN'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns_trigger ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns_trigger
  BEFORE UPDATE OF role, company_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();
