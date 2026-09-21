-- Subscription status enforcement + status index (ADR-001 follow-up).
--
-- Gap fixed: both the app-layer gate (getUserPlan in
-- web/lib/api/plan-limits.ts) and the enforce_*_limit triggers below read
-- subscriptions.plan WITHOUT checking subscriptions.status. A past_due /
-- canceled / unpaid subscriber therefore kept the paid tier's limits even
-- though they stopped paying. Enforcement must honor a paid plan only while
-- the subscription is 'active' or 'trialing' (Stripe statuses); any other
-- status degrades to free limits.
--
-- This migration:
--   1. Indexes subscriptions.status so status-scoped reads are cheap.
--   2. Teaches both plan-limit triggers the same status gate that
--      lib/api/plan-limits.ts uses, keeping the app layer and DB layer in sync.
--
-- NOTE: the plan caps (5/500, 15/5000, 50/50000) are still duplicated here and
-- in web/lib/subscriptions/pricing.ts. De-duplicating the DB trigger is a
-- documented follow-up (web/docs/pricing.md); this migration only closes the
-- status-gate hole, it does not add a new source of numbers.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

-- ============================================================================
-- 1. Index subscription status
-- ============================================================================
CREATE INDEX IF NOT EXISTS subscriptions_status_idx
  ON public.subscriptions (status);

-- Cover the common enforcement predicate (active/trialing) for status-wide
-- scans. The per-user lookup in the triggers is already served by the UNIQUE
-- index on user_id.
CREATE INDEX IF NOT EXISTS subscriptions_paid_status_idx
  ON public.subscriptions (status)
  WHERE status IN ('active', 'trialing');

-- ============================================================================
-- 2. Project creation limit trigger — add the status gate
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_project_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.plan_tier;
  v_max int;
  v_company text;
  v_role text;
  v_count int;
  v_scope_key bigint;
BEGIN
  -- Plan lookup (default 'free', mirroring getUserPlan). Paid tiers count
  -- only while the subscription is active or trialing.
  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE user_id = NEW.user_id
    AND status IN ('active', 'trialing');
  IF v_plan IS NULL THEN
    v_plan := 'free';
  END IF;

  v_max := CASE v_plan
    WHEN 'free' THEN 5
    WHEN 'crew' THEN 15
    WHEN 'team' THEN 50
    ELSE NULL -- company = unlimited
  END;

  IF v_max IS NULL THEN
    RETURN NEW; -- unlimited tier
  END IF;

  -- Admin bypass (mirrors ctx.isAdmin)
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = NEW.user_id;
  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent inserts for the same scope, then count committed rows.
  SELECT company_name INTO v_company
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF v_company IS NOT NULL AND v_company <> '' THEN
    v_scope_key := hashtext('project-company:' || v_company);
    PERFORM pg_advisory_xact_lock(v_scope_key);

    SELECT count(*) INTO v_count
    FROM public.projects p
    JOIN public.profiles pr ON pr.id = p.user_id
    WHERE pr.company_name = v_company;
  ELSE
    v_scope_key := hashtext('project-user:' || NEW.user_id::text);
    PERFORM pg_advisory_xact_lock(v_scope_key);

    SELECT count(*) INTO v_count
    FROM public.projects
    WHERE user_id = NEW.user_id;
  END IF;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED projects max %', v_max
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_project_limit_trigger ON public.projects;
CREATE TRIGGER enforce_project_limit_trigger
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_limit();

-- ============================================================================
-- 3. Photo upload limit trigger — add the status gate
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_photo_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid;
  v_plan public.plan_tier;
  v_max int;
  v_company text;
  v_role text;
  v_count int;
  v_scope_key bigint;
BEGIN
  -- Resolve the project owner (photo limit is scoped to the owner's company/users)
  SELECT user_id INTO v_owner
  FROM public.projects
  WHERE id = NEW.project_id;
  IF v_owner IS NULL THEN
    RETURN NEW; -- FK violation will reject anyway
  END IF;

  -- Paid tiers count only while the subscription is active or trialing.
  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE user_id = v_owner
    AND status IN ('active', 'trialing');
  IF v_plan IS NULL THEN
    v_plan := 'free';
  END IF;

  v_max := CASE v_plan
    WHEN 'free' THEN 500
    WHEN 'crew' THEN 5000
    WHEN 'team' THEN 50000
    ELSE NULL -- company = unlimited
  END;

  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_owner;
  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT company_name INTO v_company
  FROM public.profiles
  WHERE id = v_owner;

  IF v_company IS NOT NULL AND v_company <> '' THEN
    v_scope_key := hashtext('photo-company:' || v_company);
    PERFORM pg_advisory_xact_lock(v_scope_key);

    SELECT count(*) INTO v_count
    FROM public.photos ph
    JOIN public.projects p ON p.id = ph.project_id
    JOIN public.profiles pr ON pr.id = p.user_id
    WHERE pr.company_name = v_company;
  ELSE
    v_scope_key := hashtext('photo-user:' || v_owner::text);
    PERFORM pg_advisory_xact_lock(v_scope_key);

    SELECT count(*) INTO v_count
    FROM public.photos ph
    JOIN public.projects p ON p.id = ph.project_id
    WHERE p.user_id = v_owner;
  END IF;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED photos max %', v_max
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_photo_limit_trigger ON public.photos;
CREATE TRIGGER enforce_photo_limit_trigger
  BEFORE INSERT ON public.photos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_photo_limit();
