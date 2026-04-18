import { useState, useEffect } from 'react';
import { Brain, Sparkles, BookOpen, Clock, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './ui/sheet';
import { useMemoryStore } from '@/store/memoryStore';
import { BrandProfileTab } from './memory/BrandProfileTab';
import { PreferenceTab } from './memory/PreferenceTab';
import { ContextTab } from './memory/ContextTab';

interface MemoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabKey = 'brand' | 'preference' | 'context';

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: typeof Brain;
  description: string;
}> = [
  { key: 'brand', label: '品牌档案', icon: Sparkles, description: '品牌定位、故事、视觉规范' },
  { key: 'preference', label: '偏好规则', icon: BookOpen, description: '写作风格、语气、标题模式' },
  { key: 'context', label: '上下文', icon: Clock, description: '7 天内的会话与计划' },
];

export function MemoryPanel({ open, onOpenChange }: MemoryPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('brand');
  const memoryEnabled = useMemoryStore((s) => s.memoryEnabled);
  const setMemoryEnabled = useMemoryStore((s) => s.setMemoryEnabled);
  const brandProfile = useMemoryStore((s) => s.brandProfile);
  const preferences = useMemoryStore((s) => s.preferences);
  const memories = useMemoryStore((s) => s.memories);

  // Reset to first tab whenever the panel opens (nice default)
  useEffect(() => {
    if (open) setActiveTab('brand');
  }, [open]);

  const confirmedPreferenceCount = preferences.filter((p) => {
    const rule = p.content as { confirmed?: boolean };
    return rule.confirmed;
  }).length;
  const contextCount = memories.filter((m) => m.layer === 'context').length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[520px] sm:max-w-[520px] p-0 flex flex-col bg-[#FAF9F7]"
      >
        {/* Header */}
        <SheetHeader className="p-5 pb-3 border-b border-[#E5E4E2] bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
              <Brain size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-[16px] text-[#333]">火花记忆</SheetTitle>
              <SheetDescription className="text-[12px] text-[#999]">
                三层记忆模型：身份 · 偏好 · 上下文
              </SheetDescription>
            </div>
            <button
              onClick={() => setMemoryEnabled(!memoryEnabled)}
              className="flex items-center gap-1.5 text-[12px] text-[#666] hover:text-[#333] transition-colors"
              title={memoryEnabled ? '点击关闭记忆注入' : '点击开启记忆注入'}
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
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b border-[#E5E4E2] bg-white px-2">
          {tabs.map((t) => {
            const Icon = t.icon;
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
                <Icon size={14} />
                <span>{t.label}</span>
                {count > 0 && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
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

        {/* Tab helper */}
        <div className="px-5 pt-3 pb-1 bg-white">
          <p className="text-[11px] text-[#999]">
            {tabs.find((t) => t.key === activeTab)?.description}
          </p>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 bg-white">
          {activeTab === 'brand' && <BrandProfileTab />}
          {activeTab === 'preference' && <PreferenceTab />}
          {activeTab === 'context' && <ContextTab />}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E5E4E2] bg-[#FAF9F7] text-[11px] text-[#999] flex items-center justify-between">
          <span>
            {memoryEnabled ? '✨ 记忆正在注入到对话' : '💤 记忆已关闭，不会影响 AI 输出'}
          </span>
          <span className="text-[#BBB]">v2</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MemoryPanel;
