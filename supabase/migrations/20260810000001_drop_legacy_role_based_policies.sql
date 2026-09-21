-- Drop legacy role-based RLS policies that remain OR'ed with the scoped ones.
--
-- Root cause (confirmed live 2026-08-10): 20260731000001_fix_cross_tenant_rls.sql
-- dropped policies by the names they had in create_defects.sql / create_photos.sql,
-- but the policies actually present on the remote were created (via dashboard /
-- manual SQL) under DIFFERENT names:
--   - photos:   "Photos insertable/viewable by project members", "Photos deletable by admins and owners"
--   - defects:  "Managers delete defects", "Foremen+ create defects", "Everyone view defects in their projects", "Assigned users and managers update defects"
--   - projects: "Projects viewable by members"
-- DROP POLICY IF EXISTS with a wrong name silently no-ops, so these legacy
-- role-based policies survived and are OR'ed with the scoped replacements.
-- Because RLS permissive policies are additive (OR), ANY of the legacy checks
-- passing grants access — e.g. any authenticated user with role
-- photographer/foreman/site_manager/admin from ANY company could INSERT a photo
-- (with an arbitrary https:// image_url, bypassing the F-16 SSRF guard) into a
-- foreign project. Live probe confirmed HTTP 201 cross-tenant insert.
--
-- Fix: drop the actual legacy policies by their real remote names. All scoped
-- replacements already exist from the fix pass:
--   photos   → "Project members can view/upload/delete photos" (user_can_access_project)
--   defects  → "Project members can view defects", "Foremen and up can create defects in their projects",
--              "Assigned users and project members can update defects", "Project managers can delete defects"
-- projects has NO scoped SELECT yet → replace "Projects viewable by members" with one.

-- ── 1. photos: drop legacy role-based policies (no company scope, no image_url guard) ──

DROP POLICY IF EXISTS "Photos insertable by project members" ON photos;
DROP POLICY IF EXISTS "Photos viewable by project members" ON photos;
DROP POLICY IF EXISTS "Photos deletable by admins and owners" ON photos;

-- ── 2. defects: drop legacy role-based policies (no project/company scope) ──

DROP POLICY IF EXISTS "Managers delete defects" ON defects;
DROP POLICY IF EXISTS "Foremen+ create defects" ON defects;
DROP POLICY IF EXISTS "Everyone view defects in their projects" ON defects;
DROP POLICY IF EXISTS "Assigned users and managers update defects" ON defects;

-- ── 3. projects: replace the only SELECT policy (role-based, all companies) with a scoped one ──

DROP POLICY IF EXISTS "Projects viewable by members" ON projects;

CREATE POLICY "Project members can view projects"
  ON projects FOR SELECT
  USING (public.user_can_access_project(id));

COMMENT ON POLICY "Project members can view projects" ON projects IS
  'Scoped SELECT: owner, same-company member, or project.VIEW.<id> grant via public.user_can_access_project(id).';
