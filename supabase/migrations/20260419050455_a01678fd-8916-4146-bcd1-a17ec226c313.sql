-- Drop deprecated tables: brand_memories and learning_entries.
-- Replaced by the unified `memories` table (Memory v2 三层模型).
-- Verified no application writes:
--   • learning_entries: 0 rows, no edge function references it
--   • brand_memories: 1 historical row, last write 2026-04-18 (before v2)
--   • Old `analyze-edit` edge function已删除，前端 ContentCard 中失效的 learnFromEdits 调用已清理
DROP TABLE IF EXISTS public.brand_memories;
DROP TABLE IF EXISTS public.learning_entries;