-- Create storage bucket for construction photos
insert into storage.buckets (id, name, public)
values ('construction-photos', 'construction-photos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload photos
create policy "Authenticated users can upload photos"
  on storage.objects for insert
  with check (
    bucket_id = 'construction-photos'
    and auth.role() = 'authenticated'
  );

-- Allow authenticated users to view photos
create policy "Authenticated users can view photos"
  on storage.objects for select
  using (
    bucket_id = 'construction-photos'
    and auth.role() = 'authenticated'
  );

-- Allow users to delete their own photos
create policy "Users can delete own photos"
  on storage.objects for delete
  using (
    bucket_id = 'construction-photos'
    and auth.role() = 'authenticated'
  );
