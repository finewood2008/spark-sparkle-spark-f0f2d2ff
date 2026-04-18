-- 1) Add is_active column (default false for new rows)
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

-- 2) Backfill: existing brand_profile rows are treated as active
UPDATE public.memories
   SET is_active = true
 WHERE layer = 'identity'
   AND category = 'brand_profile';

-- 3) Partial unique indexes — at most ONE active brand_profile per owner
-- For authenticated users (user_id NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS memories_one_active_brand_profile_per_user
  ON public.memories (user_id, category)
  WHERE layer = 'identity'
    AND category = 'brand_profile'
    AND is_active = true
    AND user_id IS NOT NULL;

-- For anonymous device users (user_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS memories_one_active_brand_profile_per_device
  ON public.memories (device_id, category)
  WHERE layer = 'identity'
    AND category = 'brand_profile'
    AND is_active = true
    AND user_id IS NULL
    AND device_id IS NOT NULL;