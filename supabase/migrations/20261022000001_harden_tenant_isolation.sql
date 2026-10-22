-- Tenant isolation hardening: split read access from write access.
--
-- Verified live facts this migration is designed against:
--   * profiles.company_name is `text NULL DEFAULT ''`. Three profiles have ''
--     and they own six projects. user_can_access_project's company branch
--     compared company_name with no empty-string guard, so those accounts were
--     treated as one company: each could read the others' projects, photos,
--     defects, attendance, comments and signed storage URLs.
--   * Every write policy on photos / daily_logs / site_schemas / drawing_pins /
--     comments / schema_photo_pins / storage.objects was gated by
--     user_can_access_project() — the READ helper. That helper also matches a
--     `project.VIEW.<id>` grant, which is exactly what /api/invite hands to
--     read-only subcontractors. A read-only invitee could therefore write
--     through PostgREST.
--   * seed_default_labels(uuid), get_user_permissions(uuid) and
--     user_has_permission(uuid, text) are SECURITY DEFINER, executable by
--     PUBLIC, with no caller check.
--
-- Changes:
--   1. user_can_access_project(): same definition as
--      20260731000001:14-42, plus `company_name <> ''` in the company branch.
--   2. New user_can_mutate_project(): owner OR (non-empty same-company
--      membership AND role <> 'client'). No project.VIEW grant branch.
--   3. Write policies rebuilt on user_can_mutate_project(), each UPDATE with a
--      WITH CHECK that repeats the new-row predicate (so rows cannot be moved
--      into another tenant). attendance_logs INSERT intentionally stays on the
--      read helper: invited subcontractors must be able to check in.
--   4. Permission RPCs: EXECUTE revoked from PUBLIC/anon/authenticated, plus an
--      in-function caller guard (service_role keeps working).
--
-- Re-runnable: `drop policy if exists` / `create or replace` throughout, and a
-- pg_policies sweep that drops every leftover non-SELECT policy still
-- referencing the read helper (policy names on the remote have drifted before —
-- see 20260810000001 — so name-only drops are not enough).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Read helper: same predicate as 20260731000001, with an empty-company guard
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.user_can_access_project(project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects
    where id = project_id
      and (
        user_id = auth.uid()
        or exists (
          select 1 from public.profiles
          where id = auth.uid()
            and company_name <> ''
            and company_name = (
              select company_name from public.profiles
              where id = (select user_id from public.projects where id = project_id)
            )
        )
        or exists (
          select 1 from public.user_permissions
          where user_id = auth.uid()
            and permission_key = 'project.VIEW.' || project_id
            and granted = true
        )
      )
  );
$$;

comment on function public.user_can_access_project(uuid) is
  'True if the current user owns the project, is a member of the owning company (company_name non-empty), or has a project.VIEW.<id> grant. Read-only helper: never use it to authorize writes. SECURITY DEFINER — pinned search_path.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Mutation helper: owner, or non-empty same-company membership, never a
--    project.VIEW grant, never role 'client'
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.user_can_mutate_project(project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = project_id
      and (
        p.user_id = auth.uid()
        or exists (
          select 1
          from public.profiles me
          join public.profiles owner on owner.id = p.user_id
          where me.id = auth.uid()
            and me.company_name <> ''
            and me.company_name = owner.company_name
            and me.role <> 'client'
        )
      )
  );
$$;

comment on function public.user_can_mutate_project(uuid) is
  'True if the current user may WRITE to the project: owner, or non-empty same-company member whose role is not client. Deliberately excludes the project.VIEW.<id> grant (read-only invites). SECURITY DEFINER — pinned search_path.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Sweep: drop any leftover non-SELECT policy on the write tables that still
--    calls the read helper. Keeps the migration correct even if a policy exists
--    on the remote under a name that no migration knows about.
--    attendance_logs INSERT is excluded on purpose (invited check-ins).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where (
        (schemaname = 'public' and tablename in (
          'photos', 'daily_logs', 'site_schemas', 'drawing_pins',
          'comments', 'schema_photo_pins', 'attendance_logs'
        ))
        or (schemaname = 'storage' and tablename = 'objects')
      )
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (
        coalesce(qual, '') like '%user_can_access_project%'
        or coalesce(with_check, '') like '%user_can_access_project%'
      )
      and not (
        schemaname = 'public'
        and tablename = 'attendance_logs'
        and cmd = 'INSERT'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. photos
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Project members can upload photos" on public.photos;
create policy "Project members can upload photos"
  on public.photos for insert
  with check (
    public.user_can_mutate_project(project_id)
    and image_url !~ '^https?://'
  );

-- No client UPDATE flow existed before this migration (only service_role could
-- update photos). The policy is created scoped so the SSRF guard also holds on
-- UPDATE and rows cannot be re-parented into another project.
drop policy if exists "Project editors can update photos" on public.photos;
create policy "Project editors can update photos"
  on public.photos for update
  using (
    public.user_can_mutate_project(project_id)
  )
  with check (
    public.user_can_mutate_project(project_id)
    and image_url !~ '^https?://'
  );

drop policy if exists "Project members can delete photos" on public.photos;
create policy "Project members can delete photos"
  on public.photos for delete
  using (
    public.user_can_mutate_project(project_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. daily_logs
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Users can insert their own daily logs" on public.daily_logs;
create policy "Users can insert their own daily logs"
  on public.daily_logs for insert
  with check (
    auth.uid() = user_id
    and public.user_can_mutate_project(project_id)
  );

drop policy if exists "Users can update their own daily logs" on public.daily_logs;
create policy "Users can update their own daily logs"
  on public.daily_logs for update
  using (
    auth.uid() = user_id
    and public.user_can_mutate_project(project_id)
  )
  with check (
    auth.uid() = user_id
    and public.user_can_mutate_project(project_id)
  );

drop policy if exists "Users can delete their own daily logs" on public.daily_logs;
create policy "Users can delete their own daily logs"
  on public.daily_logs for delete
  using (
    auth.uid() = user_id
    and public.user_can_mutate_project(project_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. site_schemas
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Project members can insert schemas" on public.site_schemas;
create policy "Project members can insert schemas"
  on public.site_schemas for insert
  with check (
    public.user_can_mutate_project(project_id)
  );

drop policy if exists "Project members can delete schemas" on public.site_schemas;
create policy "Project members can delete schemas"
  on public.site_schemas for delete
  using (
    public.user_can_mutate_project(project_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. drawing_pins (project resolved through the parent photo)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Project members can create pins" on public.drawing_pins;
create policy "Project members can create pins"
  on public.drawing_pins for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.photos
      where id = photo_id
        and public.user_can_mutate_project(project_id)
    )
  );

drop policy if exists "Project members can update their pins" on public.drawing_pins;
create policy "Project members can update their pins"
  on public.drawing_pins for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.photos
      where id = photo_id
        and public.user_can_mutate_project(project_id)
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.photos
      where id = photo_id
        and public.user_can_mutate_project(project_id)
    )
  );

drop policy if exists "Project members can delete their pins" on public.drawing_pins;
create policy "Project members can delete their pins"
  on public.drawing_pins for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.photos
      where id = photo_id
        and public.user_can_mutate_project(project_id)
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. comments (project resolved from the polymorphic entity, not from
--    comments.project_id: the BEFORE trigger accepts a caller-supplied
--    project_id, so that column is not trustworthy for authorization)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Project members can insert comments" on public.comments;
create policy "Project members can insert comments"
  on public.comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = case entity_type
        when 'photo'      then (select project_id from public.photos      where id = entity_id)
        when 'defect'     then (select project_id from public.defects     where id = entity_id)
        when 'work_order' then (select project_id from public.work_orders where id = entity_id)
      end
      and public.user_can_mutate_project(p.id)
    )
  );

drop policy if exists "Project members can update own comments" on public.comments;
create policy "Project members can update own comments"
  on public.comments for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = case entity_type
        when 'photo'      then (select project_id from public.photos      where id = entity_id)
        when 'defect'     then (select project_id from public.defects     where id = entity_id)
        when 'work_order' then (select project_id from public.work_orders where id = entity_id)
      end
      and public.user_can_mutate_project(p.id)
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = case entity_type
        when 'photo'      then (select project_id from public.photos      where id = entity_id)
        when 'defect'     then (select project_id from public.defects     where id = entity_id)
        when 'work_order' then (select project_id from public.work_orders where id = entity_id)
      end
      and public.user_can_mutate_project(p.id)
    )
  );

drop policy if exists "Authors and managers can delete comments" on public.comments;
create policy "Authors and managers can delete comments"
  on public.comments for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = case entity_type
        when 'photo'      then (select project_id from public.photos      where id = entity_id)
        when 'defect'     then (select project_id from public.defects     where id = entity_id)
        when 'work_order' then (select project_id from public.work_orders where id = entity_id)
      end
      and public.user_can_mutate_project(p.id)
    )
    and (
      auth.uid() = user_id
      or exists (
        select 1 from public.profiles
        where id = auth.uid()
          and role in ('site_manager', 'admin')
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. schema_photo_pins (same read-helper-on-write hole; project via schema)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Project members can insert schema pins" on public.schema_photo_pins;
create policy "Project members can insert schema pins"
  on public.schema_photo_pins for insert
  with check (
    exists (
      select 1 from public.site_schemas
      where id = schema_id
        and public.user_can_mutate_project(project_id)
    )
  );

drop policy if exists "Project members can delete schema pins" on public.schema_photo_pins;
create policy "Project members can delete schema pins"
  on public.schema_photo_pins for delete
  using (
    exists (
      select 1 from public.site_schemas
      where id = schema_id
        and public.user_can_mutate_project(project_id)
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. storage.objects (construction-photos bucket)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Project members can upload photos" on storage.objects;
create policy "Project members can upload photos"
  on storage.objects for insert
  with check (
    bucket_id = 'construction-photos'
    and (
      auth.role() = 'service_role'
      or (
        auth.role() = 'authenticated'
        and public.user_can_mutate_project(public.get_project_id_from_path(name))
      )
    )
  );

drop policy if exists "Project members can update photos" on storage.objects;
create policy "Project members can update photos"
  on storage.objects for update
  using (
    bucket_id = 'construction-photos'
    and (
      auth.role() = 'service_role'
      or (
        auth.role() = 'authenticated'
        and public.user_can_mutate_project(public.get_project_id_from_path(name))
      )
    )
  )
  with check (
    bucket_id = 'construction-photos'
    and (
      auth.role() = 'service_role'
      or (
        auth.role() = 'authenticated'
        and public.user_can_mutate_project(public.get_project_id_from_path(name))
      )
    )
  );

drop policy if exists "Project members can delete photos" on storage.objects;
create policy "Project members can delete photos"
  on storage.objects for delete
  using (
    bucket_id = 'construction-photos'
    and (
      auth.role() = 'service_role'
      or (
        auth.role() = 'authenticated'
        and public.user_can_mutate_project(public.get_project_id_from_path(name))
      )
    )
  );

-- attendance_logs INSERT/UPDATE are intentionally NOT rewritten here:
-- "Project members can insert own check-in" stays on user_can_access_project so
-- an invited (project.VIEW) subcontractor can check in, and the update policy
-- stays authorship-bound (auth.uid() = user_id AND check_out IS NULL).

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Permission RPCs: caller guard + EXECUTE revocation
--     Bodies below are the 20260801000003 / 20260730000001 bodies verbatim,
--     with a guard prepended.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.seed_default_labels(p_company_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_trade_id uuid;
  v_floor_id uuid;
  v_zone_id uuid;
  v_status_id uuid;
begin
  -- Caller guard: service_role (app server), a global admin, or a site_manager
  -- of the target company. Seeding another tenant's label tree writes rows the
  -- caller cannot even read back.
  if auth.role() is distinct from 'service_role'
     and not exists (
       select 1
       from public.profiles me
       join public.companies c on c.id = p_company_id
       where me.id = auth.uid()
         and (
           me.role = 'admin'
           or (
             me.role = 'site_manager'
             and me.company_name <> ''
             and me.company_name = c.name
           )
         )
     )
  then
    raise exception 'seed_default_labels: not allowed for company %', p_company_id
      using errcode = '42501';
  end if;

  -- Trade group (multi, not required)
  INSERT INTO public.label_groups (company_id, name, slug, color, sort_order, selection_mode, required)
  VALUES (p_company_id, 'Trade', 'trade', '#3B82F6', 1, 'multi', false)
  ON CONFLICT (company_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_trade_id;

  INSERT INTO public.labels (group_id, name, slug, color, sort_order) VALUES
    (v_trade_id, 'Electrical', 'electrical', '#EF4444', 1),
    (v_trade_id, 'Plumbing', 'plumbing', '#F97316', 2),
    (v_trade_id, 'HVAC', 'hvac', '#EAB308', 3),
    (v_trade_id, 'Framing', 'framing', '#22C55E', 4),
    (v_trade_id, 'Drywall', 'drywall', '#06B6D4', 5),
    (v_trade_id, 'Painting', 'painting', '#A855F7', 6),
    (v_trade_id, 'Roofing', 'roofing', '#EC4899', 7),
    (v_trade_id, 'Concrete', 'concrete', '#78716C', 8)
  ON CONFLICT (group_id, slug) DO NOTHING;

  -- Floor group (single, not required)
  INSERT INTO public.label_groups (company_id, name, slug, color, sort_order, selection_mode, required)
  VALUES (p_company_id, 'Floor', 'floor', '#8B5CF6', 2, 'single', false)
  ON CONFLICT (company_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_floor_id;

  INSERT INTO public.labels (group_id, name, slug, color, sort_order) VALUES
    (v_floor_id, 'Floor 1', 'floor-1', '#A78BFA', 1),
    (v_floor_id, 'Floor 2', 'floor-2', '#A78BFA', 2),
    (v_floor_id, 'Floor 3', 'floor-3', '#A78BFA', 3),
    (v_floor_id, 'Floor 4', 'floor-4', '#A78BFA', 4),
    (v_floor_id, 'Floor 5', 'floor-5', '#A78BFA', 5),
    (v_floor_id, 'Roof', 'roof', '#7C3AED', 6)
  ON CONFLICT (group_id, slug) DO NOTHING;

  -- Zone group (multi, not required)
  INSERT INTO public.label_groups (company_id, name, slug, color, sort_order, selection_mode, required)
  VALUES (p_company_id, 'Zone', 'zone', '#10B981', 3, 'multi', false)
  ON CONFLICT (company_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_zone_id;

  INSERT INTO public.labels (group_id, name, slug, color, sort_order) VALUES
    (v_zone_id, 'Zone A', 'zone-a', '#34D399', 1),
    (v_zone_id, 'Zone B', 'zone-b', '#34D399', 2),
    (v_zone_id, 'Zone C', 'zone-c', '#34D399', 3),
    (v_zone_id, 'Exterior', 'exterior', '#059669', 4),
    (v_zone_id, 'Interior', 'interior', '#047857', 5)
  ON CONFLICT (group_id, slug) DO NOTHING;

  -- Status group (single, required)
  INSERT INTO public.label_groups (company_id, name, slug, color, sort_order, selection_mode, required)
  VALUES (p_company_id, 'Status', 'status', '#F59E0B', 4, 'single', true)
  ON CONFLICT (company_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_status_id;

  INSERT INTO public.labels (group_id, name, slug, color, sort_order) VALUES
    (v_status_id, 'Complete', 'complete', '#22C55E', 1),
    (v_status_id, 'In Progress', 'in-progress', '#3B82F6', 2),
    (v_status_id, 'Needs Review', 'needs-review', '#F97316', 3),
    (v_status_id, 'Approved', 'approved', '#16A34A', 4),
    (v_status_id, 'Rejected', 'rejected', '#EF4444', 5)
  ON CONFLICT (group_id, slug) DO NOTHING;
end;
$$;

create or replace function public.get_user_permissions(target_user_id uuid)
returns table (permission_key text, granted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_role text;
begin
  -- Caller guard: self, service_role, or an admin / same-company site_manager.
  -- Denial returns no rows (this is a read; the app treats empty as "none").
  if auth.role() is distinct from 'service_role'
     and target_user_id is distinct from auth.uid()
     and not exists (
       select 1
       from public.profiles me
       join public.profiles target on target.id = target_user_id
       where me.id = auth.uid()
         and (
           me.role = 'admin'
           or (
             me.role = 'site_manager'
             and me.company_name <> ''
             and me.company_name = target.company_name
           )
         )
     )
  then
    return;
  end if;

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
end;
$$;

create or replace function public.user_has_permission(target_user_id uuid, perm_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_perm boolean;
begin
  -- Caller guard: self, service_role, or an admin / same-company site_manager.
  if auth.role() is distinct from 'service_role'
     and target_user_id is distinct from auth.uid()
     and not exists (
       select 1
       from public.profiles me
       join public.profiles target on target.id = target_user_id
       where me.id = auth.uid()
         and (
           me.role = 'admin'
           or (
             me.role = 'site_manager'
             and me.company_name <> ''
             and me.company_name = target.company_name
           )
         )
     )
  then
    return false;
  end if;

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
end;
$$;

comment on function public.get_user_permissions(uuid) is
  'Effective permission set for a user (role defaults + overrides). Caller-guarded: self, service_role, admin, or same-company site_manager. SECURITY DEFINER — pinned search_path, qualified refs.';
comment on function public.user_has_permission(uuid, text) is
  'True if the user has the permission (override wins over role default). Caller-guarded like get_user_permissions. SECURITY DEFINER — pinned search_path, qualified refs.';
comment on function public.seed_default_labels(uuid) is
  'Seeds the default label tree for a company. Caller-guarded: service_role, admin, or site_manager of that company. SECURITY DEFINER — pinned search_path.';

revoke execute on function public.seed_default_labels(uuid) from public, anon, authenticated;
revoke execute on function public.get_user_permissions(uuid) from public, anon, authenticated;
revoke execute on function public.user_has_permission(uuid, text) from public, anon, authenticated;

grant execute on function public.seed_default_labels(uuid) to service_role;
grant execute on function public.get_user_permissions(uuid) to service_role;
grant execute on function public.user_has_permission(uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK — run by hand only, in this order. Restores the pre-migration state.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- -- 1. Permission RPCs: restore pre-migration bodies + public EXECUTE.
-- --    (Re-apply the bodies from the cited files: they are the exact
-- --     pre-migration definitions.)
-- --    supabase/migrations/20260730000001_create_labels.sql:253  -> seed_default_labels
-- --    supabase/migrations/20260801000003_fix_audit_forgery_and_permission_rpcs.sql:31 -> get_user_permissions
-- --    supabase/migrations/20260801000003_fix_audit_forgery_and_permission_rpcs.sql:73 -> user_has_permission
-- grant execute on function public.seed_default_labels(uuid) to public, anon, authenticated;
-- grant execute on function public.get_user_permissions(uuid) to public, anon, authenticated;
-- grant execute on function public.user_has_permission(uuid, text) to public, anon, authenticated;
--
-- -- 2. Read helper without the empty-company guard (20260731000001:14-42).
-- create or replace function public.user_can_access_project(project_id uuid)
-- returns boolean language sql stable security definer set search_path = ''
-- as $$
--   select exists (
--     select 1 from public.projects
--     where id = project_id
--       and (
--         user_id = auth.uid()
--         or exists (
--           select 1 from public.profiles
--           where id = auth.uid()
--             and company_name = (
--               select company_name from public.profiles
--               where id = (select user_id from public.projects where id = project_id)
--             )
--         )
--         or exists (
--           select 1 from public.user_permissions
--           where user_id = auth.uid()
--             and permission_key = 'project.VIEW.' || project_id
--             and granted = true
--         )
--       )
--   );
-- $$;
--
-- drop function if exists public.user_can_mutate_project(uuid);
--
-- -- 3. Write policies back to the read helper (pre-migration definitions).
-- drop policy if exists "Project members can upload photos" on public.photos;
-- create policy "Project members can upload photos" on public.photos for insert
--   with check (public.user_can_access_project(project_id) and image_url !~ '^https?://');
-- drop policy if exists "Project editors can update photos" on public.photos;
-- drop policy if exists "Project members can delete photos" on public.photos;
-- create policy "Project members can delete photos" on public.photos for delete
--   using (public.user_can_access_project(project_id));
--
-- drop policy if exists "Users can insert their own daily logs" on public.daily_logs;
-- create policy "Users can insert their own daily logs" on public.daily_logs for insert
--   with check (auth.uid() = user_id and public.user_can_access_project(project_id));
-- drop policy if exists "Users can update their own daily logs" on public.daily_logs;
-- create policy "Users can update their own daily logs" on public.daily_logs for update
--   using (auth.uid() = user_id and public.user_can_access_project(project_id))
--   with check (auth.uid() = user_id and public.user_can_access_project(project_id));
-- drop policy if exists "Users can delete their own daily logs" on public.daily_logs;
-- create policy "Users can delete their own daily logs" on public.daily_logs for delete
--   using (auth.uid() = user_id and public.user_can_access_project(project_id));
--
-- drop policy if exists "Project members can insert schemas" on public.site_schemas;
-- create policy "Project members can insert schemas" on public.site_schemas for insert
--   with check (public.user_can_access_project(project_id));
-- drop policy if exists "Project members can delete schemas" on public.site_schemas;
-- create policy "Project members can delete schemas" on public.site_schemas for delete
--   using (public.user_can_access_project(project_id));
--
-- drop policy if exists "Project members can create pins" on public.drawing_pins;
-- create policy "Project members can create pins" on public.drawing_pins for insert
--   with check (auth.uid() = user_id and exists (
--     select 1 from public.photos where id = photo_id and public.user_can_access_project(project_id)));
-- drop policy if exists "Project members can update their pins" on public.drawing_pins;
-- create policy "Project members can update their pins" on public.drawing_pins for update
--   using (auth.uid() = user_id and exists (
--     select 1 from public.photos where id = photo_id and public.user_can_access_project(project_id)))
--   with check (auth.uid() = user_id);
-- drop policy if exists "Project members can delete their pins" on public.drawing_pins;
-- create policy "Project members can delete their pins" on public.drawing_pins for delete
--   using (auth.uid() = user_id and exists (
--     select 1 from public.photos where id = photo_id and public.user_can_access_project(project_id)));
--
-- drop policy if exists "Project members can insert comments" on public.comments;
-- create policy "Project members can insert comments" on public.comments for insert
--   with check (auth.uid() = user_id and exists (
--     select 1 from public.projects p
--     where p.id = case entity_type
--       when 'photo' then (select project_id from public.photos where id = entity_id)
--       when 'defect' then (select project_id from public.defects where id = entity_id)
--       when 'work_order' then (select project_id from public.work_orders where id = entity_id)
--     end
--     and public.user_can_access_project(p.id)));
-- drop policy if exists "Project members can update own comments" on public.comments;
-- create policy "Project members can update own comments" on public.comments for update
--   using (auth.uid() = user_id and exists (
--     select 1 from public.projects p
--     where p.id = case entity_type
--       when 'photo' then (select project_id from public.photos where id = entity_id)
--       when 'defect' then (select project_id from public.defects where id = entity_id)
--       when 'work_order' then (select project_id from public.work_orders where id = entity_id)
--     end
--     and public.user_can_access_project(p.id)))
--   with check (auth.uid() = user_id);
-- -- Delete policy: pre-migration body is 20260825120000_add_comments.sql:118-146.
--
-- drop policy if exists "Project members can insert schema pins" on public.schema_photo_pins;
-- create policy "Project members can insert schema pins" on public.schema_photo_pins for insert
--   with check (exists (
--     select 1 from public.site_schemas where id = schema_id and public.user_can_access_project(project_id)));
-- drop policy if exists "Project members can delete schema pins" on public.schema_photo_pins;
-- create policy "Project members can delete schema pins" on public.schema_photo_pins for delete
--   using (exists (
--     select 1 from public.site_schemas where id = schema_id and public.user_can_access_project(project_id)));
--
-- drop policy if exists "Project members can upload photos" on storage.objects;
-- create policy "Project members can upload photos" on storage.objects for insert
--   with check (bucket_id = 'construction-photos' and (auth.role() = 'service_role'
--     or (auth.role() = 'authenticated' and public.user_can_access_project(public.get_project_id_from_path(name)))));
-- drop policy if exists "Project members can update photos" on storage.objects;
-- create policy "Project members can update photos" on storage.objects for update
--   using (bucket_id = 'construction-photos' and (auth.role() = 'service_role'
--     or (auth.role() = 'authenticated' and public.user_can_access_project(public.get_project_id_from_path(name)))));
-- drop policy if exists "Project members can delete photos" on storage.objects;
-- create policy "Project members can delete photos" on storage.objects for delete
--   using (bucket_id = 'construction-photos' and (auth.role() = 'service_role'
--     or (auth.role() = 'authenticated' and public.user_can_access_project(public.get_project_id_from_path(name)))));
