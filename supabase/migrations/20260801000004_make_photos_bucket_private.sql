-- P1-2 fix (independent security audit): construction-photos bucket is public.
--
-- Root cause: 20260724000003 created the bucket with public = true. The later
-- storage-security migration (20260729000001) added project-aware RLS policies
-- on storage.objects, but never flipped the bucket flag itself — so anonymous
-- traffic hitting a public object URL was still served without a signed token.
--
-- Fix: flip the bucket to private. The project-aware RLS policies from
-- 20260729000001 remain the access gate, and every app read path already
-- resolves images through getSignedUrl() (photos/route.ts:48, schemas/route.ts:28,
-- schema-pins/route.ts:52,75), which keeps working on private buckets.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

update storage.buckets
set public = false
where id = 'construction-photos'
  and name = 'construction-photos';

-- Defensive: if a stray copy of the bucket name exists, it stays as created
-- (the WHERE clause above only touches the canonical row).
