-- comments.user_id referenced auth.users(id), but every other author-bearing
-- table references profiles(id), and /api/notifications embeds the author as
-- `profiles!comments_user_id_fkey` — a relationship PostgREST cannot resolve.
--
-- Verified live on 2026-10-04:
--   GET /api/notifications -> 500
--   "Could not find a relationship between 'comments' and 'profiles'"
--
-- profiles.id itself references auth.users(id) ON DELETE CASCADE, so user
-- deletion still cascades through profiles -> comments.

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_user_id_fkey;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
