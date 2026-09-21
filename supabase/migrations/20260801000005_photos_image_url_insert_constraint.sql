-- P1-1: constrain photos.image_url on INSERT so project members cannot store
-- arbitrary http(s) URLs that the report route would later fetch server-side
-- (SSRF: `fetch(signedUrl)` in web/app/api/report/route.ts, amplified by the
-- old getSignedUrl fallback that echoed attacker input back as a URL).
--
-- The upload flow stores raw storage object paths (upload/route.ts stores
-- `<userId>/<projectId>/<timestamp>.jpg`), so rejecting absolute URLs does
-- not break legitimate inserts. Existing rows are left untouched (SELECT /
-- UPDATE flows still go through toStoragePath, which accepts both shapes).

DROP POLICY IF EXISTS "Project members can upload photos" ON photos;

CREATE POLICY "Project members can upload photos"
  ON photos FOR INSERT
  WITH CHECK (
    public.user_can_access_project(project_id)
    AND image_url !~ '^https?://'
  );
