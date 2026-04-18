-- Create memories table only if missing (migration was authored but never applied)
CREATE TABLE IF NOT EXISTS public.memories (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid          REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id   text,
  layer       text          NOT NULL CHECK (layer IN ('identity', 'preference', 'context')),
  category    text          NOT NULL,
  content     jsonb         NOT NULL DEFAULT '{}',
  source      text          DEFAULT 'manual',
  source_url  text,
  confidence  float         DEFAULT 1.0,
  evidence    text,
  expires_at  timestamptz,
  created_at  timestamptz   DEFAULT now(),
  updated_at  timestamptz   DEFAULT now()
);

COMMENT ON TABLE public.memories IS 'Unified layered memory store (identity / preference / context)';

CREATE INDEX IF NOT EXISTS idx_memories_user_layer    ON public.memories (user_id, layer);
CREATE INDEX IF NOT EXISTS idx_memories_device_layer  ON public.memories (device_id, layer);
CREATE INDEX IF NOT EXISTS idx_memories_layer_category ON public.memories (layer, category);
CREATE INDEX IF NOT EXISTS idx_memories_expires_at    ON public.memories (expires_at) WHERE expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_memories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_memories_updated_at ON public.memories;
CREATE TRIGGER set_memories_updated_at
  BEFORE UPDATE ON public.memories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_memories_updated_at();

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memories_select_own" ON public.memories;
CREATE POLICY "memories_select_own"
  ON public.memories FOR SELECT
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = current_setting('request.headers', true)::json->>'x-device-id')
  );

DROP POLICY IF EXISTS "memories_insert_own" ON public.memories;
CREATE POLICY "memories_insert_own"
  ON public.memories FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = current_setting('request.headers', true)::json->>'x-device-id')
  );

DROP POLICY IF EXISTS "memories_update_own" ON public.memories;
CREATE POLICY "memories_update_own"
  ON public.memories FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = current_setting('request.headers', true)::json->>'x-device-id')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = current_setting('request.headers', true)::json->>'x-device-id')
  );

DROP POLICY IF EXISTS "memories_delete_own" ON public.memories;
CREATE POLICY "memories_delete_own"
  ON public.memories FOR DELETE
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = current_setting('request.headers', true)::json->>'x-device-id')
  );

DROP POLICY IF EXISTS "memories_service_role_all" ON public.memories;
CREATE POLICY "memories_service_role_all"
  ON public.memories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- One-shot data migration from brand_memories (only if memories is empty)
INSERT INTO public.memories (
  device_id, user_id, layer, category, content, source, confidence, created_at, updated_at
)
SELECT
  bm.device_id,
  CASE WHEN bm.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       THEN bm.user_id::uuid ELSE NULL END,
  'identity',
  'brand_profile',
  jsonb_build_object(
    'brandName',       bm.name,
    'industry',        bm.industry,
    'mainBusiness',    bm.main_business,
    'targetCustomer',  bm.target_customer,
    'differentiation', bm.differentiation,
    'toneOfVoice',     bm.tone_of_voice,
    'keywords',        to_jsonb(bm.keywords),
    'tabooWords',      to_jsonb(bm.taboo_words),
    'initialized',     bm.initialized
  ),
  'manual',
  1.0,
  bm.created_at,
  bm.updated_at
FROM public.brand_memories bm
WHERE NOT EXISTS (SELECT 1 FROM public.memories WHERE layer = 'identity' AND category = 'brand_profile');

-- One-shot data migration from learning_entries
INSERT INTO public.memories (
  device_id, user_id, layer, category, content, source, confidence, evidence, created_at, updated_at
)
SELECT
  le.device_id,
  CASE WHEN le.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       THEN le.user_id::uuid ELSE NULL END,
  'preference',
  COALESCE(NULLIF(le.type, ''), 'writing_style'),
  jsonb_build_object(
    'rule',      le.insight,
    'evidence',  le.evidence,
    'confirmed', false
  ),
  'manual',
  le.confidence,
  le.evidence,
  le.created_at,
  le.created_at
FROM public.learning_entries le
WHERE NOT EXISTS (SELECT 1 FROM public.memories WHERE layer = 'preference');