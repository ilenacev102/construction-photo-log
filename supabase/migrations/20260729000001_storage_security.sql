-- ──────────────────────────────────────────────────────────────────────────────
-- Storage Security — private bucket + project-aware RLS
-- ──────────────────────────────────────────────────────────────────────────────
-- Helper functions live in `public` schema (writing to `storage` schema is
-- restricted in Supabase managed Postgres). RLS policies on `storage.objects`
-- reference these helpers via the `public.` qualifier.

-- 1. Helper: extract project_id from a storage object path
--    Photos:   {userId}/{projectId}/{filename}
--    Schemas:  schemas/{projectId}/{filename}
--    Reports:  {userId}/{projectId}/report-{filename}
create function public.get_project_id_from_path(obj_path text)
returns uuid
language sql
immutable
as $$
  select case
    when obj_path like 'schemas/%' then
      split_part(obj_path, '/', 2)::uuid
    else
      split_part(obj_path, '/', 2)::uuid
  end;
$$;

-- 2. Helper: check if the authenticated user can access a given project
create function public.user_can_access_project(project_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from projects
    where id = project_id
      and (
        user_id = auth.uid()
        or exists (
          select 1 from profiles
          where id = auth.uid()
            and (company_name = (select company_name from profiles where id = (select user_id from projects where id = project_id)))
        )
        or exists (
          select 1 from user_permissions
          where user_id = auth.uid()
            and permission_key = 'project.VIEW.' || project_id
            and granted = true
        )
      )
  );
$$;

-- 3. Drop old permissive policies
drop policy if exists "Authenticated users can upload photos" on storage.objects;
drop policy if exists "Authenticated users can view photos" on storage.objects;
drop policy if exists "Users can delete own photos" on storage.objects;

-- 4. New SELECT policy — only users with project access can view objects
create policy "Project members can view photos"
  on storage.objects for select
  using (
    bucket_id = 'construction-photos'
    and (
      auth.role() = 'service_role'
      or (
        auth.role() = 'authenticated'
        and public.user_can_access_project(public.get_project_id_from_path(name))
      )
    )
  );

-- 5. New INSERT policy — only users with project access can upload
create policy "Project members can upload photos"
  on storage.objects for insert
  with check (
    bucket_id = 'construction-photos'
    and (
      auth.role() = 'service_role'
      or (
        auth.role() = 'authenticated'
        and public.user_can_access_project(public.get_project_id_from_path(name))
      )
    )
  );

-- 6. New UPDATE policy
create policy "Project members can update photos"
  on storage.objects for update
  using (
    bucket_id = 'construction-photos'
    and (
      auth.role() = 'service_role'
      or (
        auth.role() = 'authenticated'
        and public.user_can_access_project(public.get_project_id_from_path(name))
      )
    )
  );

-- 7. New DELETE policy
create policy "Project members can delete photos"
  on storage.objects for delete
  using (
    bucket_id = 'construction-photos'
    and (
      auth.role() = 'service_role'
      or (
        auth.role() = 'authenticated'
        and public.user_can_access_project(public.get_project_id_from_path(name))
      )
    )
  );
