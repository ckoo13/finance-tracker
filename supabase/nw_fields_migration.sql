CREATE TABLE user_nw_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('asset', 'liability')),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  is_liquid BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(user_id, key)
);

ALTER TABLE user_nw_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own nw fields"
  ON user_nw_fields FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
