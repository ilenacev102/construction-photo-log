-- Site plans / schemas for photo placement
-- Users upload a floor plan image, then place photo pins on it

CREATE TABLE IF NOT EXISTS site_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  image_url text NOT NULL,
  width integer,
  height integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_schemas_project ON site_schemas(project_id);

ALTER TABLE site_schemas ENABLE ROW LEVEL SECURITY;

-- Photo pins placed on schemas
CREATE TABLE IF NOT EXISTS schema_photo_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id uuid REFERENCES site_schemas(id) ON DELETE CASCADE NOT NULL,
  photo_id uuid REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  x float NOT NULL,
  y float NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schema_photo_pins_schema ON schema_photo_pins(schema_id);
CREATE INDEX IF NOT EXISTS idx_schema_photo_pins_photo ON schema_photo_pins(photo_id);

ALTER TABLE schema_photo_pins ENABLE ROW LEVEL SECURITY;

-- ── RLS: site_schemas ──

CREATE POLICY "Users view schemas in their projects"
  ON site_schemas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_id
    )
  );

CREATE POLICY "Project owners and admins insert schemas"
  ON site_schemas FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM projects WHERE id = project_id
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Project owners and admins delete schemas"
  ON site_schemas FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM projects WHERE id = project_id
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── RLS: schema_photo_pins ──

CREATE POLICY "Users view pins on their schemas"
  ON schema_photo_pins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM site_schemas WHERE id = schema_id
    )
  );

CREATE POLICY "Users insert pins"
  ON schema_photo_pins FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM photos WHERE id = photo_id
    )
  );

CREATE POLICY "Users delete their own pins"
  ON schema_photo_pins FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM photos WHERE id = photo_id
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
  );
