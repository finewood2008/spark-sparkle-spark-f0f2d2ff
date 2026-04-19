import { useState } from 'react';
import { Brain, ToggleLeft, ToggleRight } from 'lucide-react';
import { useMemoryStore } from '@/store/memoryStore';
import { BrandProfileTab } from '@/components/memory/BrandProfileTab';
import { PreferenceTab } from '@/components/memory/PreferenceTab';
import { ContextTab } from '@/components/memory/ContextTab';

type TabKey = 'brand' | 'preference' | 'context';

const tabs: Array<{ key: TabKey; label: string; description: string }> = [
  { key: 'brand', label: '品牌身份', description: '你的品牌定位、目标读者、视觉风格' },
  { key: 'preference', label: '偏好规则', description: '你的写作偏好、平台调性、内容禁忌' },
  { key: 'context', label: '近期上下文', description: '最近聊过的话题与决定，临时记忆' },
];

export default function MemoryView() {
  const [activeTab, setActiveTab] = useState<TabKey>('brand');
  const memoryEnabled = useMemoryStore((s) => s.memoryEnabled);
  const setMemoryEnabled = useMemoryStore((s) => s.setMemoryEnabled);
  const brandProfile = useMemoryStore((s) => s.brandProfile);
  const preferences = useMemoryStore((s) => s.preferences);
  const memories = useMemoryStore((s) => s.memoryEntry);
  const contextCount = memories.filter((m) => m.layer === 'context').length;

  return (
    <div className="h-full overflow-hidden flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E5E4E2] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
          <Brain size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-[16px] font-semibold text-[#333]">火花记忆</h1>
          <p className="text-[12px] text-[#999]">三层记忆模型：身份 · 偏好 · 上下文</p>
        </div>
        <button
          onClick={() => setMemoryEnabled(!memoryEnabled)}
          className="flex items-center gap-1.5 text-[12px] text-[#666] hover:text-[#333] transition-colors"
        >
          {memoryEnabled ? (
            <>
              <ToggleRight size={20} className="text-orange-500" />
              <span>已开启</span>
            </>
          ) : (
            <>
              <ToggleLeft size={20} className="text-[#CCC]" />
              <span>未启用</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5E4E2] px-2">
        {tabs.map((t) => {
          const count =
            t.key === 'brand'
              ? brandProfile?.initialized
                ? 1
                : 0
              : t.key === 'preference'
                ? preferences.length
                : contextCount;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] border-b-2 transition-colors ${
                active
                  ? 'border-orange-500 text-orange-600 font-medium'
                  : 'border-transparent text-[#999] hover:text-[#666]'
              }`}
            >
              <span>{t.label}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                    active ? 'bg-orange-100 text-orange-600' : 'bg-[#F0EFED] text-[#999]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-6 pt-3 pb-1">
        <p className="text-[11px] text-[#999]">
          {tabs.find((t) => t.key === activeTab)?.description}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {activeTab === 'brand' && <BrandProfileTab />}
        {activeTab === 'preference' && <PreferenceTab />}
        {activeTab === 'context' && <ContextTab />}
      </div>
    </div>
  );
}
