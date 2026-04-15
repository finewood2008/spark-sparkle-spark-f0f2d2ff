
-- Add user_id column to brand_memories
ALTER TABLE public.brand_memories ADD COLUMN user_id text DEFAULT NULL;

-- Create unique constraint on user_id (allow multiple device_id rows but unique per user)
CREATE UNIQUE INDEX brand_memories_user_id_unique ON public.brand_memories (user_id) WHERE user_id IS NOT NULL;

-- Add user_id column to learning_entries
ALTER TABLE public.learning_entries ADD COLUMN user_id text DEFAULT NULL;
