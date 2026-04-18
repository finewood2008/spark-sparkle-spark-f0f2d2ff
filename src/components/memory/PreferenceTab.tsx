import { useMemo } from 'react';
import { Check, Trash2, Sparkles, Info } from 'lucide-react';
import { useMemoryStore } from '@/store/memoryStore';
import { useMemoryV2 } from '@/hooks/useMemoryV2';
import type { MemoryEntry, PreferenceRule, PreferenceCategory } from '@/types/memory';
import { toast } from 'sonner';

const categoryLabels: Record<PreferenceCategory, string> = {
  writing_style: '写作风格',
  title_pattern: '标题模式',
  content_structure: '内容结构',
  tone_rule: '语气规则',
  topic_preference: '话题偏好',
  performance_insight: '表现洞察',
};

const categoryColors: Record<PreferenceCategory, string> = {
  writing_style: 'from-blue-50 to-sky-50 border-blue-100',
  title_pattern: 'from-violet-50 to-purple-50 border-violet-100',
  content_structure: 'from-emerald-50 to-green-50 border-emerald-100',
  tone_rule: 'from-orange-50 to-amber-50 border-orange-100',
  topic_preference: 'from-pink-50 to-rose-50 border-pink-100',
  performance_insight: 'from-yellow-50 to-amber-50 border-yellow-100',
};

export function PreferenceTab() {
  const preferences = useMemoryStore((s) => s.preferences);
  const confirmPreference = useMemoryStore((s) => s.confirmPreference);
  const removePreference = useMemoryStore((s) => s.removePreference);
  const { persistEntry, reloadMemories } = useMemoryV2();

  const grouped = useMemo(() => {
    const map = new Map<PreferenceCategory, MemoryEntry[]>();
    preferences.forEach((p) => {
      const cat = p.category as PreferenceCategory;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    return map;
  }, [preferences]);

  const handleConfirm = async (entry: MemoryEntry) => {
    confirmPreference(entry.id);
    const rule = entry.content as unknown as PreferenceRule;
    await persistEntry({
      ...entry,
      content: { ...rule, confirmed: true } as unknown as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
    });
    toast.success('偏好已确认');
  };

  const handleDelete = async (entry: MemoryEntry) => {
    removePreference(entry.id);
    // Fire-and-forget delete from DB via supabase directly; useMemoryV2 doesn't
    // expose delete, so we rely on reload after deletion via the store's removal.
    // For now we just remove locally; a subsequent reload from server would bring
    // it back — so persist with a cleaner approach: mark it gone by actually
    // deleting the row. We call the hook through a tiny indirection.
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('memories').delete().eq('id', entry.id);
      toast.success('偏好已删除');
      await reloadMemories();
    } catch (err) {
      console.error('[PreferenceTab] delete failed', err);
      toast.error('删除失败，请重试');
    }
  };

  if (preferences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-3">
          <Sparkles size={22} className="text-orange-400" />
        </div>
        <div className="text-[14px] text-[#666] mb-1">还没有偏好规则</div>
        <div className="text-[12px] text-[#999] max-w-[300px]">
          在品牌档案标签页抓取网页后会自动生成写作偏好；你也可以在使用过程中通过编辑内容让系统自动学习。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 p-3 bg-sky-50 border border-sky-100 rounded-xl text-[12px] text-sky-700">
        <Info size={14} className="mt-0.5 flex-shrink-0" />
        <div>
          带 <span className="font-medium">?</span> 的是系统自动推断、<span className="font-medium">未确认</span>的规则，只有被确认后才会注入到日常聊天；在生成内容时所有规则都会被参考。
        </div>
      </div>

      {[...grouped.entries()].map(([category, entries]) => (
        <section key={category}>
          <div className="text-[13px] font-medium text-[#666] mb-2 flex items-center gap-2">
            <span>{categoryLabels[category]}</span>
            <span className="text-[11px] text-[#999]">({entries.length})</span>
          </div>

          <div className="space-y-2">
            {entries.map((entry) => {
              const rule = entry.content as unknown as PreferenceRule;
              return (
                <div
                  key={entry.id}
                  className={`border rounded-xl p-3 bg-gradient-to-br ${categoryColors[category]}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold mt-0.5 ${
                        rule.confirmed
                          ? 'bg-green-500 text-white'
                          : 'bg-white border border-[#E5E4E2] text-[#999]'
                      }`}
                      title={rule.confirmed ? '已确认' : '待确认'}
                    >
                      {rule.confirmed ? '✓' : '?'}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-[#333]">{rule.rule}</div>
                      {rule.evidence && (
                        <div className="text-[11px] text-[#999] mt-1 italic truncate">
                          ↳ {rule.evidence}
                        </div>
                      )}
                      <div className="text-[10px] text-[#BBB] mt-1">
                        来源: {entry.source}
                        {entry.confidence > 0 &&
                          ` · 置信度 ${Math.round(entry.confidence * 100)}%`}
                      </div>
                    </div>

                    <div className="flex gap-1 flex-shrink-0">
                      {!rule.confirmed && (
                        <button
                          onClick={() => handleConfirm(entry)}
                          className="w-7 h-7 rounded-lg bg-white border border-[#E5E4E2] flex items-center justify-center text-green-600 hover:bg-green-50 transition-colors"
                          title="确认"
                        >
                          <Check size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(entry)}
                        className="w-7 h-7 rounded-lg bg-white border border-[#E5E4E2] flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default PreferenceTab;
