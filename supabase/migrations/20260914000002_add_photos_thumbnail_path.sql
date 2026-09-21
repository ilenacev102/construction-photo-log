-- Add nullable thumbnail path to photos (backfill-free thumbnail pipeline).
--
-- New uploads store a <=400px JPEG variant alongside the full image; read
-- routes sign it as `thumbnail_url`. NULL means "legacy photo, fall back to
-- the full signed URL" — no backfill required, purely additive.

ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS thumbnail_path text;

COMMENT ON COLUMN public.photos.thumbnail_path IS
  'Storage path of the <=400px thumbnail variant (nullable: legacy rows fall back to image_url).';
