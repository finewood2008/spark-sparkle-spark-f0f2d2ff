-- Enable pg_cron and pg_net extensions for server-side scheduling
-- pg_cron: runs SQL on a schedule
-- pg_net: makes HTTP requests from SQL (to call Edge Functions)

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule: every hour at minute 0, call the execute-schedule Edge Function
-- The function checks all enabled tasks and runs those whose scheduled_times
-- match the current hour.
--
-- We use pg_net to POST to the Edge Function endpoint. The service_role key
-- is used for authentication (bypasses RLS). CRON_SECRET is optional extra
-- auth if configured.

SELECT cron.schedule(
  'execute-schedule-hourly',
  '0 * * * *',  -- every hour at minute 0
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/execute-schedule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Also add a column for last_executed_at on config rows for quick dashboard display
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_tasks'
    AND column_name = 'last_executed_at'
  ) THEN
    ALTER TABLE public.schedule_tasks ADD COLUMN last_executed_at timestamptz;
  END IF;
END $$;
