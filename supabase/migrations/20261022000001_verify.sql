-- Verification for 20261022000001_harden_tenant_isolation.sql
--
-- SELECT-only. Run in the Supabase SQL editor (or psql) BEFORE and AFTER the
-- migration to see the delta. Nothing here writes or changes settings.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Profiles with an empty company_name (the shared-'' tenant)
-- ─────────────────────────────────────────────────────────────────────────────

select
  pr.id,
  pr.role,
  pr.company_name,
  (select count(*) from public.projects p where p.user_id = pr.id) as owned_projects
from public.profiles pr
where coalesce(pr.company_name, '') = ''
order by owned_projects desc, pr.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Non-SELECT policies on the write tables that still call the READ helper.
--    AFTER the migration the only expected row is attendance_logs INSERT
--    ("Project members can insert own check-in" — intentional).
-- ─────────────────────────────────────────────────────────────────────────────

select
  schemaname,
  tablename,
  policyname,
  cmd,
  case when coalesce(qual, '') like '%user_can_access_project%' then 'using' end as refs_in_using,
  case when coalesce(with_check, '') like '%user_can_access_project%' then 'with check' end as refs_in_with_check
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
order by schemaname, tablename, cmd, policyname;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2b. UPDATE policies with no WITH CHECK (a nullable predicate lets a row be
--     moved into another tenant). AFTER the migration this must return 0 rows
--     for the write tables.
-- ─────────────────────────────────────────────────────────────────────────────

select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in (
    'photos', 'daily_logs', 'site_schemas', 'drawing_pins',
    'comments', 'schema_photo_pins'
  )
  and cmd = 'UPDATE'
  and coalesce(with_check, '') = ''
order by tablename, policyname;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Simulated access check: a ''-company user vs a project owned by a
--    DIFFERENT ''-company user.
--    Old predicate = company equality only (no empty guard).
--    New predicate = equality AND caller company non-empty.
--    Expect: old_read = true, new_read = false, new_mutate = false.
-- ─────────────────────────────────────────────────────────────────────────────

with pairs as (
  select
    caller.id            as caller_id,
    caller.role          as caller_role,
    p.id                 as project_id,
    p.user_id            as owner_id,
    coalesce(caller.company_name, '') as caller_company,
    coalesce(owner.company_name, '')  as owner_company,
    exists (
      select 1 from public.user_permissions up
      where up.user_id = caller.id
        and up.permission_key = 'project.VIEW.' || p.id
        and up.granted = true
    ) as has_view_grant
  from public.profiles caller
  join public.projects p on p.user_id <> caller.id
  join public.profiles owner on owner.id = p.user_id
  where coalesce(caller.company_name, '') = ''
    and coalesce(owner.company_name, '') = ''
)
select
  caller_id,
  caller_role,
  project_id,
  owner_id,
  has_view_grant,
  (caller_company = owner_company)                                        as old_read,
  (caller_company <> '' and caller_company = owner_company)               as new_read,
  (caller_company <> '' and caller_company = owner_company
    and caller_role <> 'client')                                          as new_mutate
from pairs
order by caller_id, project_id
limit 20;

-- Summary: how many cross-'' pairs the empty-string guard closes.
with pairs as (
  select
    caller.id as caller_id,
    p.id      as project_id,
    (coalesce(caller.company_name, '') = coalesce(owner.company_name, '')) as old_read
  from public.profiles caller
  join public.projects p on p.user_id <> caller.id
  join public.profiles owner on owner.id = p.user_id
  where coalesce(caller.company_name, '') = ''
    and coalesce(owner.company_name, '') = ''
)
select count(*) as pairs_visible_before, 0 as pairs_visible_after
from pairs
where old_read;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Function state: guards present, EXECUTE revoked from anon/authenticated.
--    def_has_empty_guard / def_is_guarded read pg_get_functiondef, no execution.
-- ─────────────────────────────────────────────────────────────────────────────

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef                                as security_definer,
  pg_get_functiondef(p.oid) like '%company_name <> ''''%' as def_has_empty_guard,
  pg_get_functiondef(p.oid) like '%not allowed%' or pg_get_functiondef(p.oid) like '%return false;%' as def_is_guarded,
  has_function_privilege('anon', p.oid, 'execute')          as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'execute')  as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'user_can_access_project',
    'user_can_mutate_project',
    'seed_default_labels',
    'get_user_permissions',
    'user_has_permission'
  )
order by p.proname;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Triggers that call the three hardened functions. A non-internal trigger
--    invoking seed_default_labels/get_user_permissions/user_has_permission runs
--    without auth.uid() and will now be denied unless its session is
--    service_role — check this list before deploying.
-- ─────────────────────────────────────────────────────────────────────────────

select
  t.tgname,
  t.tgrelid::regclass as on_table,
  p.proname           as calls
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
join pg_namespace n on n.oid = p.pronamespace
where not t.tgisinternal
  and n.nspname = 'public'
  and p.proname in ('seed_default_labels', 'get_user_permissions', 'user_has_permission')
order by on_table, t.tgname;
