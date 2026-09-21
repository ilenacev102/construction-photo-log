-- Create drawing pins and photo annotations
CREATE TABLE IF NOT EXISTS drawing_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  pin_type text NOT NULL DEFAULT 'pin'
    CHECK (pin_type IN ('pin', 'arrow', 'rectangle', 'circle', 'freehand', 'text')),
  x float NOT NULL,
  y float NOT NULL,
  width float,
  height float,
  color text NOT NULL DEFAULT '#ef4444',
  label text DEFAULT '',
  drawing_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawing_pins_photo ON drawing_pins(photo_id);

ALTER TABLE drawing_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view pins on their photos"
  ON drawing_pins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM photos WHERE id = photo_id AND (
        photos.user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
      )
    )
  );

CREATE POLICY "Users create pins"
  ON drawing_pins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own pins"
  ON drawing_pins FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own pins"
  ON drawing_pins FOR DELETE
  USING (auth.uid() = user_id);
