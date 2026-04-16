import { useState, useEffect } from 'react';
import { Settings, CheckCircle2, Sparkles, MessageCircle, Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { loadUserPrefs, saveUserPrefs, type TonePresetId } from '@/lib/user-prefs';
import { loadScheduleConfig, executeScheduledTask } from '@/lib/schedule-persistence';

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
  const [running, setRunning] = useState(false);

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

  const handleRunOnce = async () => {
    setRunning(true);
    try {
      const cfg = await loadScheduleConfig();
      const topics = cfg.topics?.length ? cfg.topics : ['今日灵感分享'];
      const platforms = cfg.platforms?.length ? cfg.platforms : (['xiaohongshu'] as const);
      const topic = topics[Math.floor(Math.random() * topics.length)];
      const platform = platforms[Math.floor(Math.random() * platforms.length)];

      toast.info(`正在生成「${topic}」...`);
      const result = await executeScheduledTask({
        topic,
        platform,
        style: cfg.style,
        taskName: '手动触发测试',
      });

      if (result.success) {
        toast.success('✅ 已生成 1 篇内容并送入审核中心', {
          description: '点击右上角审核按钮查看',
        });
      } else {
        toast.error(`生成失败：${result.error || '未知错误'}`);
      }
    } catch (e) {
      toast.error(`执行出错：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
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

      {/* 定时任务测试 */}
      <div className="spark-card p-5 mb-4">
        <h2 className="font-semibold text-sm text-spark-gray-700 mb-1 flex items-center gap-2">
          <Play size={16} className="text-spark-orange" />
          定时任务测试
        </h2>
        <p className="text-xs text-spark-gray-500 mb-4">
          立即模拟一次定时任务执行：从你的计划里随机挑一个主题生成内容，并送进审核中心。无需等待 cron。
        </p>
        <button
          type="button"
          onClick={handleRunOnce}
          disabled={running}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-spark-orange text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {running ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              生成中，请稍候...
            </>
          ) : (
            <>
              <Play size={16} />
              立即执行一次
            </>
          )}
        </button>
        <p className="text-[11px] text-spark-gray-400 mt-3 leading-relaxed">
          💡 提示：如果还没在「定时计划」里配置主题，将使用默认主题「今日灵感分享」+ 小红书。
        </p>
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
