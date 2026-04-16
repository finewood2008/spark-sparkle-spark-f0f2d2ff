-- 1. 扩展 review_items 表
ALTER TABLE public.review_items
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS published_platforms TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metrics_fetched_at TIMESTAMP WITH TIME ZONE;

-- 2. 新建 content_metrics 表
CREATE TABLE IF NOT EXISTS public.content_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_item_id TEXT NOT NULL,
  user_id TEXT,
  device_id TEXT NOT NULL DEFAULT 'default',
  platform TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'mock',
  ai_insight TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_metrics_review_item
  ON public.content_metrics(review_item_id);

ALTER TABLE public.content_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to content_metrics"
  ON public.content_metrics
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. 启用 cron + http 扩展（用于定时调用 edge function）
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 4. 取消可能存在的旧任务
DO $$
BEGIN
  PERFORM cron.unschedule('fetch-content-metrics-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. 注册每小时扫描任务（调用 edge function）
SELECT cron.schedule(
  'fetch-content-metrics-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rbrsjjxtpyjmmjbidtyp.supabase.co/functions/v1/fetch-metrics',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicnNqanh0cHlqbW1qYmlkdHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDY1MzUsImV4cCI6MjA5MTc4MjUzNX0.lvVTfqgtzu0JbVwji5cTZZUP97uJ1pDkcUhBbWed1cc"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) AS request_id;
  $$
);