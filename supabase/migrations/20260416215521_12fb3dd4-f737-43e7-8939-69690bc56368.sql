-- Desktop client device tokens for ingesting real platform metrics
CREATE TABLE public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  label text NOT NULL DEFAULT '桌面客户端',
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX idx_device_tokens_hash ON public.device_tokens(token_hash) WHERE revoked_at IS NULL;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage only their own device tokens (token_hash never returned to UI by convention)
CREATE POLICY "users manage own device tokens"
  ON public.device_tokens
  FOR ALL
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

-- Add 'platform_real' as an allowed source value via a CHECK-free design (existing column has no enum constraint)
-- Just document that source can be 'mock' | 'real' | 'desktop'
COMMENT ON COLUMN public.content_metrics.source IS 'mock | real | desktop (ingested from desktop client)';

-- Helpful index for ingest dedupe lookups
CREATE INDEX IF NOT EXISTS idx_content_metrics_lookup
  ON public.content_metrics(review_item_id, platform, fetched_at DESC);