-- ============================================================================
-- Migration: Create unified memories table
-- Date: 2026-04-19
-- Description: 
--   1. Create memories table with layered memory architecture
--   2. Migrate data from brand_memories -> memories (layer='identity')
--   3. Migrate data from learning_entries -> memories (layer='preference')
--   4. Old tables are NOT dropped — data is copied only
-- ============================================================================

-- ===================
-- 1. Create table
-- ===================

CREATE TABLE public.memories (
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

-- Add table comment
COMMENT ON TABLE public.memories IS 'Unified layered memory store (identity / preference / context)';

-- ===================
-- 2. Indexes
-- ===================

CREATE INDEX idx_memories_user_layer      ON public.memories (user_id, layer);
CREATE INDEX idx_memories_device_layer     ON public.memories (device_id, layer);
CREATE INDEX idx_memories_layer_category   ON public.memories (layer, category);
CREATE INDEX idx_memories_expires_at       ON public.memories (expires_at)
  WHERE expires_at IS NOT NULL;

-- ===================
-- 3. Auto-update updated_at trigger
-- ===================

CREATE OR REPLACE FUNCTION public.handle_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_memories_updated_at
  BEFORE UPDATE ON public.memories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_memories_updated_at();

-- ===================
-- 4. RLS policies
-- ===================

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Authenticated users: match on user_id = auth.uid()
CREATE POLICY "memories_select_own"
  ON public.memories FOR SELECT
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND device_id IS NOT NULL AND device_id = current_setting('request.headers', true)::json->>'x-device-id')
  );

CREATE POLICY "memories_insert_own"
  ON public.memories FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND device_id IS NOT NULL AND device_id = current_setting('request.headers', true)::json->>'x-device-id')
  );

CREATE POLICY "memories_update_own"
  ON public.memories FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND device_id IS NOT NULL AND device_id = current_setting('request.headers', true)::json->>'x-device-id')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND device_id IS NOT NULL AND device_id = current_setting('request.headers', true)::json->>'x-device-id')
  );

CREATE POLICY "memories_delete_own"
  ON public.memories FOR DELETE
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND device_id IS NOT NULL AND device_id = current_setting('request.headers', true)::json->>'x-device-id')
  );

-- Service role bypass (for server-side operations)
CREATE POLICY "memories_service_role_all"
  ON public.memories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ===================
-- 5. Data migration: brand_memories -> memories
-- ===================
-- brand_memories columns: id, device_id, name, industry, main_business,
--   target_customer, differentiation, tone_of_voice, keywords, taboo_words,
--   initialized, init_step, created_at, updated_at, user_id (text)
--
-- We pack all brand profile fields into content jsonb.
-- user_id in brand_memories is text; we cast to uuid where valid.

INSERT INTO public.memories (
  device_id,
  user_id,
  layer,
  category,
  content,
  source,
  confidence,
  created_at,
  updated_at
)
SELECT
  bm.device_id,
  CASE
    WHEN bm.user_id IS NOT NULL AND bm.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN bm.user_id::uuid
    ELSE NULL
  END,
  'identity',
  'brand_profile',
  jsonb_build_object(
    'name',             bm.name,
    'industry',         bm.industry,
    'main_business',    bm.main_business,
    'target_customer',  bm.target_customer,
    'differentiation',  bm.differentiation,
    'tone_of_voice',    bm.tone_of_voice,
    'keywords',         to_jsonb(bm.keywords),
    'taboo_words',      to_jsonb(bm.taboo_words),
    'initialized',      bm.initialized,
    'init_step',        bm.init_step
  ),
  'migration',
  1.0,
  bm.created_at,
  bm.updated_at
FROM public.brand_memories bm;

-- ===================
-- 6. Data migration: learning_entries -> memories
-- ===================
-- learning_entries columns: id, device_id, type, category, insight,
--   evidence, confidence, created_at, user_id (text)
--
-- Map type field -> category in memories.
-- Original type values are kept as the category.

INSERT INTO public.memories (
  device_id,
  user_id,
  layer,
  category,
  content,
  source,
  confidence,
  evidence,
  created_at,
  updated_at
)
SELECT
  le.device_id,
  CASE
    WHEN le.user_id IS NOT NULL AND le.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN le.user_id::uuid
    ELSE NULL
  END,
  'preference',
  le.type,
  jsonb_build_object(
    'insight',           le.insight,
    'original_category', le.category
  ),
  'migration',
  le.confidence,
  le.evidence,
  le.created_at,
  le.created_at   -- learning_entries has no updated_at, use created_at
FROM public.learning_entries le;
