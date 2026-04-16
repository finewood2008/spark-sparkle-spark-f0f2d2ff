ALTER PUBLICATION supabase_realtime ADD TABLE public.review_items;
ALTER TABLE public.review_items REPLICA IDENTITY FULL;