
ALTER TABLE public.user_preferences
  ADD COLUMN default_length text NOT NULL DEFAULT 'medium',
  ADD COLUMN auto_cta boolean NOT NULL DEFAULT true,
  ADD COLUMN cover_style text NOT NULL DEFAULT '简约清新';
