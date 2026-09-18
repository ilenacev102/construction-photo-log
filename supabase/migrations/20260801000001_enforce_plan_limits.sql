-- F-08 fix: enforce plan limits atomically at the DB layer.
--
-- Root cause: the app's check-then-insert (requireProjectCreationLimit /
-- requirePhotoUploadLimit in lib/api/plan-limits.ts) is TOCTOU-racy. Concurrent
-- requests all pass the SELECT count check before any INSERT commits, so the cap
-- can be exceeded (observed: free tier, 20 parallel POSTs -> 12 projects created).
--
-- Fix: BEFORE INSERT triggers that take a Postgres advisory lock keyed on the
-- owner's scope (company_name, or user id when no company), which serializes
-- concurrent inserts for the same scope. The count then sees every committed
-- row, making count + insert atomic. Plan/limit values mirror
-- lib/subscriptions/pricing.ts (free=5/500, crew=15/5000, team=50/50000,
-- company=unlimited); admin bypass mirrors getCompanyContext().isAdmin.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

-- ============================================================================
-- Project creation limit
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
  -- Plan lookup (default 'free', mirroring getUserPlan)
  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE user_id = NEW.user_id;
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
-- Photo upload limit
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

  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE user_id = v_owner;
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
