
-- Brand memories table
CREATE TABLE public.brand_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  main_business TEXT NOT NULL DEFAULT '',
  target_customer TEXT NOT NULL DEFAULT '',
  differentiation TEXT NOT NULL DEFAULT '',
  tone_of_voice TEXT NOT NULL DEFAULT '',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  taboo_words TEXT[] NOT NULL DEFAULT '{}',
  initialized BOOLEAN NOT NULL DEFAULT false,
  init_step INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(device_id)
);

-- Learning entries table
CREATE TABLE public.learning_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL DEFAULT 'default',
  type TEXT NOT NULL DEFAULT 'preference',
  category TEXT NOT NULL DEFAULT 'preference',
  insight TEXT NOT NULL,
  evidence TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brand_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_entries ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth yet)
CREATE POLICY "Allow all access to brand_memories" ON public.brand_memories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to learning_entries" ON public.learning_entries FOR ALL USING (true) WITH CHECK (true);
