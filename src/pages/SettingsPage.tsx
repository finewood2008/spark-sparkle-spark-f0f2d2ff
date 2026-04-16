import { useState, useEffect } from 'react';
import { Settings, CheckCircle2, Sparkles, MessageCircle } from 'lucide-react';
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

export default function SettingsPage() {
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
    <div className="h-full overflow-y-auto p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-spark-gray-800 mb-1 flex items-center gap-2">
        <Settings size={20} className="text-spark-orange" />
        系统设置
      </h1>
      <p className="text-sm text-spark-gray-400 mb-6">个性化火花的回复风格和 AI 引擎</p>

      {/* 语气预设 */}
      <div className="spark-card p-5 mb-4">
        <h2 className="font-semibold text-sm text-spark-gray-700 mb-1 flex items-center gap-2">
          <MessageCircle size={16} className="text-spark-orange" />
          火花的语气
        </h2>
        <p className="text-xs text-spark-gray-500 mb-4">
          选择火花和你聊天、写文章时的整体调性。立即生效。
        </p>

        <div className="space-y-2.5">
          {PRESETS.map((p) => {
            const active = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p.id)}
                className={`w-full text-left rounded-xl border-2 transition-all p-4 ${
                  active
                    ? 'border-spark-orange bg-spark-orange/5'
                    : 'border-spark-gray-100 hover:border-spark-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl leading-none mt-0.5">{p.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-spark-gray-800">{p.label}</span>
                      {active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-spark-orange text-white">
                          当前
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-spark-gray-600 mt-1">{p.description}</div>
                    <div className="text-xs text-spark-gray-400 mt-2 italic">{p.example}</div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 transition-all ${
                      active ? 'border-spark-orange bg-spark-orange' : 'border-spark-gray-300'
                    }`}
                  >
                    {active && (
                      <div className="w-full h-full rounded-full bg-white scale-[0.4]" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI 引擎 */}
      <div className="spark-card p-5 mb-4">
        <h2 className="font-semibold text-sm text-spark-gray-700 mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-spark-orange" />
          AI 引擎
        </h2>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-spark-gray-50 border border-spark-gray-100">
          <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
          <div className="text-sm text-spark-gray-700 leading-relaxed">
            <div className="font-medium">已接入 Google Gemini</div>
            <div className="text-xs text-spark-gray-500 mt-1">
              文字模型：Gemini 2.5 Flash · 图像模型：Gemini 2.5 Flash Image
              <br />
              密钥由后端统一管理，无需配置即可使用所有 AI 能力。
            </div>
          </div>
        </div>
      </div>

      <div className="spark-card p-5 text-xs text-spark-gray-500 leading-relaxed">
        如需更换密钥或额度告罄，请联系管理员在后端密钥管理中更新{' '}
        <code className="px-1 py-0.5 rounded bg-spark-gray-100 text-spark-gray-700">
          GOOGLE_GEMINI_API_KEY
        </code>
        。
      </div>
    </div>
  );
}
