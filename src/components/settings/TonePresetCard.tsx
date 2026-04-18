import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { loadUserPrefs, saveUserPrefs, type TonePresetId } from '@/lib/user-prefs';

interface PresetOption {
  id: TonePresetId;
  label: string;
  emoji: string;
  description: string;
  example: string;
}

const PRESETS: PresetOption[] = [
  {
    id: 'professional',
    label: '专业',
    emoji: '🎯',
    description: '严谨克制，逻辑清晰，几乎不用 emoji',
    example: '"建议从三个维度分析：用户画像、内容形式、发布时机。"',
  },
  {
    id: 'lively',
    label: '活泼',
    emoji: '✨',
    description: '热情有感染力，emoji 丰富，口语化',
    example: '"哇这个想法超棒的！我们一起把它做出来好不好～ 🎉"',
  },
  {
    id: 'minimal',
    label: '极简',
    emoji: '⚡',
    description: '简短直给，无寒暄无修饰，每句都有信息量',
    example: '"已生成。三处可优化：标题、CTA、首段。"',
  },
];

export default function TonePresetCard() {
  const [preset, setPreset] = useState<TonePresetId>('lively');

  useEffect(() => {
    setPreset(loadUserPrefs().tonePreset);
  }, []);

  const handleSelect = async (id: TonePresetId) => {
    setPreset(id);
    const prefs = loadUserPrefs();
    await saveUserPrefs({ ...prefs, tonePreset: id });
    const label = PRESETS.find((p) => p.id === id)?.label;
    toast.success(`火花切换到「${label}」语气`);
  };

  return (
    <div className="rounded-2xl bg-card shadow-lg border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <MessageCircle size={16} className="text-primary" />
          火花的语气
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          选择火花和你聊天、写文章时的整体调性。立即生效。
        </p>
      </div>
      <div className="px-6 py-4 space-y-2.5">
        {PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p.id)}
              className={`w-full text-left rounded-xl border-2 transition-all p-4 ${
                active
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30 bg-background'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl leading-none mt-0.5">{p.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{p.label}</span>
                    {active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                        当前
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
                  <div className="text-xs text-muted-foreground/70 mt-2 italic">{p.example}</div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 transition-all ${
                    active ? 'border-primary bg-primary' : 'border-border'
                  }`}
                >
                  {active && <div className="w-full h-full rounded-full bg-white scale-[0.4]" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
