-- Create profiles table for role-based access control
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'photographer'
    CHECK (role IN ('photographer', 'foreman', 'site_manager', 'client', 'admin')),
  company_name text DEFAULT '',
  full_name text DEFAULT '',
  avatar_url text DEFAULT '',
  phone text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own profile
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role which is admin-managed)
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'full_name', ''));
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
