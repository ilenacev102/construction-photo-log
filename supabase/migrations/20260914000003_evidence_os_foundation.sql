-- Evidence OS foundation: content hashes and report manifests.
--
-- photos.content_hash stores the SHA-256 of the stored full-size image,
-- computed server-side at upload time. NULL means "legacy photo, hash
-- unknown" — verify surfaces report those as unverifiable, never as failed.
-- report_manifests persists every generated report as a tamper-evident
-- manifest: manifest_hash = SHA-256 over the sorted photo content hashes.

ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS content_hash text;

COMMENT ON COLUMN public.photos.content_hash IS
  'SHA-256 hex of the stored full-size image (nullable: legacy rows predate hashing).';

CREATE TABLE IF NOT EXISTS public.report_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  photo_ids uuid[] NOT NULL DEFAULT '{}',
  manifest_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_manifests_project_id
  ON public.report_manifests (project_id);

ALTER TABLE public.report_manifests ENABLE ROW LEVEL SECURITY;

-- Members with project access can view manifests (verify pages read through
-- the API with the admin client; this policy covers direct anon-key reads).
DROP POLICY IF EXISTS "Project members can view report manifests" ON public.report_manifests;

CREATE POLICY "Project members can view report manifests"
  ON public.report_manifests FOR SELECT
  USING (public.user_can_access_project(project_id));

-- Writes go through the API with the service-role client only.
