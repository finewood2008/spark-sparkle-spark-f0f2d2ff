
CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  default_platform text NOT NULL DEFAULT 'xiaohongshu',
  writing_style text NOT NULL DEFAULT '专业严谨',
  writing_tone text NOT NULL DEFAULT '友好亲切',
  signature text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON public.user_preferences FOR ALL
  USING (true) WITH CHECK (true);
