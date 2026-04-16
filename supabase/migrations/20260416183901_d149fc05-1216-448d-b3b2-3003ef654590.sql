-- Create review_items table for Human-in-the-loop persistence
CREATE TABLE public.review_items (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  device_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'xiaohongshu',
  status TEXT NOT NULL DEFAULT 'reviewing',
  tags TEXT[] NOT NULL DEFAULT '{}',
  cta TEXT NOT NULL DEFAULT '',
  cover_image TEXT,
  task_name TEXT NOT NULL DEFAULT '',
  task_source TEXT NOT NULL DEFAULT 'schedule',
  task_topic TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reject_reason TEXT,
  auto_generated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_items_user ON public.review_items(user_id);
CREATE INDEX idx_review_items_device ON public.review_items(device_id);
CREATE INDEX idx_review_items_status ON public.review_items(status);

ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to review_items"
ON public.review_items
FOR ALL
USING (true)
WITH CHECK (true);

-- Auto update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_review_items_updated_at
BEFORE UPDATE ON public.review_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();