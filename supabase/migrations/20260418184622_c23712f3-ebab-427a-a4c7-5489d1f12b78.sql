-- Ensure pg_cron + pg_net are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with the same name (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'execute-schedule-hourly') THEN
    PERFORM cron.unschedule('execute-schedule-hourly');
  END IF;
END $$;

-- Schedule execute-schedule edge function every hour at minute 0
SELECT cron.schedule(
  'execute-schedule-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rbrsjjxtpyjmmjbidtyp.supabase.co/functions/v1/execute-schedule',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicnNqanh0cHlqbW1qYmlkdHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDY1MzUsImV4cCI6MjA5MTc4MjUzNX0.lvVTfqgtzu0JbVwji5cTZZUP97uJ1pDkcUhBbWed1cc"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);