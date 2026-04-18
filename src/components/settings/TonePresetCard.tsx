import { useState, useEffect } from 'react';
import { MessageCircle, ChevronDown } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setPreset(loadUserPrefs().tonePreset);
  }, []);

  const current = PRESETS.find((p) => p.id === preset) ?? PRESETS[1];

  const handleSelect = async (id: TonePresetId) => {
    setPreset(id);
    const prefs = loadUserPrefs();
    await saveUserPrefs({ ...prefs, tonePreset: id });
    const label = PRESETS.find((p) => p.id === id)?.label;
    toast.success(`火花切换到「${label}」语气`);
    setExpanded(false);
  };

  return (
    <div className="rounded-2xl bg-card shadow-lg border border-border overflow-hidden">
      {/* Collapsed header — clickable to expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-6 py-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle size={16} className="text-primary shrink-0" />
          <h3 className="font-semibold text-foreground text-sm">火花的语气</h3>
          <span className="ml-1 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            <span>{current.emoji}</span>
            <span>{current.label}</span>
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded options */}
      {expanded && (
        <div className="px-6 pb-4 space-y-2.5 border-t border-border pt-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-xs text-muted-foreground -mt-1 mb-2">
            选择火花和你聊天、写文章时的整体调性。立即生效。
          </p>
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
      )}
    </div>
  );
}
