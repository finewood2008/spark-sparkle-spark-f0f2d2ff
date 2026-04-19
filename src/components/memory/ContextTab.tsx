import { useMemo } from 'react';
import { Clock, Trash2, Calendar, MessageSquare, FileText } from 'lucide-react';
import { useMemoryStore } from '@/store/memoryStore';
import { useMemoryV2 } from '@/hooks/useMemoryV2';
import type { MemoryEntry, ContextCategory } from '@/types/memory';
import { toast } from 'sonner';

const categoryLabels: Record<ContextCategory, string> = {
  recent_content: '近期内容',
  active_schedule: '进行中计划',
  session_summary: '最近聊过的创作',
};

const categoryIcons: Record<ContextCategory, typeof Clock> = {
  recent_content: FileText,
  active_schedule: Calendar,
  session_summary: MessageSquare,
};

/**
 * Display order for categories — session_summary first so users immediately
 * see "what spark remembers from our recent creative chats".
 */
const categoryOrder: ContextCategory[] = ['session_summary', 'recent_content', 'active_schedule'];

function formatCountdown(expiresAt?: string): { text: string; urgent: boolean } {
  if (!expiresAt) return { text: '永久', urgent: false };
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { text: '已过期', urgent: true };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days >= 1) {
    return { text: `${days} 天后过期`, urgent: days <= 1 };
  }
  return { text: `${hours} 小时后过期`, urgent: true };
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3600000;
    if (diffH < 1) return '刚刚';
    if (diffH < 24) return `${Math.floor(diffH)} 小时前`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD} 天前`;
  } catch {
    return iso;
  }
}

export function ContextTab() {
  const memories = useMemoryStore((s) => s.memories);
  const setMemories = useMemoryStore((s) => s.setMemories);
  const { reloadMemories } = useMemoryV2();

  const contextEntries = useMemo(
    () =>
      memories
        .filter((m) => m.layer === 'context')
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [memories],
  );

  const grouped = useMemo(() => {
    const map = new Map<ContextCategory, MemoryEntry[]>();
    contextEntries.forEach((e) => {
      const cat = e.category as ContextCategory;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(e);
    });
    return map;
  }, [contextEntries]);

  const handleDelete = async (entry: MemoryEntry) => {
    // Optimistic local removal
    const nextMemories = memories.filter((m) => m.id !== entry.id);
    setMemories(nextMemories);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('memories').delete().eq('id', entry.id);
      toast.success('已删除');
    } catch (err) {
      console.error('[ContextTab] delete failed', err);
      toast.error('删除失败');
      await reloadMemories();
    }
  };

  const handleClearAll = async () => {
    if (contextEntries.length === 0) return;
    if (!confirm(`确定清空所有 ${contextEntries.length} 条上下文记忆？此操作不可撤销。`)) return;
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const ids = contextEntries.map((e) => e.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('memories').delete().in('id', ids);
      const nextMemories = memories.filter((m) => m.layer !== 'context');
      setMemories(nextMemories);
      toast.success('已清空上下文记忆');
    } catch (err) {
      console.error('[ContextTab] clearAll failed', err);
      toast.error('清空失败');
    }
  };

  if (contextEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-sky-50 flex items-center justify-center mb-3">
          <Clock size={22} className="text-sky-400" />
        </div>
        <div className="text-[14px] text-[#666] mb-1">暂无上下文记忆</div>
        <div className="text-[12px] text-[#999] max-w-[320px]">
          会话摘要、近期发布内容、进行中的内容计划会自动出现在这里。这一层记忆 7 天后自动过期，保持新鲜。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-[#999]">
          共 {contextEntries.length} 条 · 7 天过期策略
        </div>
        <button
          onClick={handleClearAll}
          className="text-[12px] text-red-500 hover:text-red-600 transition-colors"
        >
          清空全部
        </button>
      </div>

      {[...grouped.entries()].map(([category, entries]) => {
        const Icon = categoryIcons[category];
        return (
          <section key={category}>
            <div className="text-[13px] font-medium text-[#666] mb-2 flex items-center gap-1.5">
              <Icon size={13} className="text-[#999]" />
              <span>{categoryLabels[category]}</span>
              <span className="text-[11px] text-[#999]">({entries.length})</span>
            </div>

            <div className="space-y-2">
              {entries.map((entry) => {
                const content = entry.content as Record<string, unknown>;
                const summary =
                  (content.summary as string) ||
                  (content.title as string) ||
                  JSON.stringify(content);
                const countdown = formatCountdown(entry.expiresAt);

                return (
                  <div
                    key={entry.id}
                    className="border border-[#E5E4E2] rounded-xl p-3 bg-white hover:border-[#D5D4D2] transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-[#333] line-clamp-3">{summary}</div>
                        <div className="flex items-center gap-3 text-[11px] text-[#999] mt-1.5">
                          <span>{formatTimestamp(entry.createdAt)}</span>
                          <span
                            className={
                              countdown.urgent ? 'text-orange-500' : 'text-[#BBB]'
                            }
                          >
                            ⏱ {countdown.text}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(entry)}
                        className="w-7 h-7 rounded-lg bg-white border border-[#E5E4E2] flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        title="删除"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default ContextTab;
