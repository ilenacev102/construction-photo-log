create table photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  image_url text not null,
  taken_at timestamptz,
  latitude float,
  longitude float,
  note text,
  created_at timestamptz not null default now()
);

alter table photos enable row level security;

create policy "Users can view project photos"
  on photos for select
  using (
    exists (select 1 from projects where id = photos.project_id and user_id = auth.uid())
  );

create policy "Users can insert project photos"
  on photos for insert
  with check (
    exists (select 1 from projects where id = project_id and user_id = auth.uid())
  );

create policy "Users can delete project photos"
  on photos for delete
  using (
    exists (select 1 from projects where id = photos.project_id and user_id = auth.uid())
  );

create index photos_project_id_idx on photos(project_id);
create index photos_taken_at_idx on photos(taken_at);
