import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  ArrowLeft, Palette, PenLine, Save, CheckCircle2, Ruler, Megaphone, Image as ImageIcon,
  Sparkles, Zap, Settings2,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { type UserPreferences, defaultPrefs, saveUserPrefs, syncPrefsFromCloud } from '@/lib/user-prefs';
import DeviceTokenManager from '@/components/DeviceTokenManager';
import TonePresetCard from '@/components/settings/TonePresetCard';
import { requireSession } from '@/lib/auth-helpers';

export const Route = createFileRoute('/settings')({
  head: () => ({
    meta: [
      { title: '系统设置 — 火花' },
      { name: 'description', content: '管理写作偏好、火花语气、图片生成等系统设置' },
    ],
  }),
  ssr: false,
  beforeLoad: () => requireSession(),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [prefs, setPrefs] = useState<UserPreferences>(defaultPrefs);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: '/auth' });
      return;
    }
    syncPrefsFromCloud().then(setPrefs);
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  const updatePref = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8"
      style={{ background: 'linear-gradient(180deg, oklch(0.95 0.04 70 / 20%), oklch(0.985 0.002 90))' }}>
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/" className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <Settings2 size={18} className="text-primary" />
            <h1 className="text-lg font-bold text-foreground">系统设置</h1>
          </div>
        </div>

        {/* Personal preferences */}
        <div className="rounded-2xl bg-card shadow-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Palette size={16} className="text-primary" />
              写作偏好
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">设置默认写作偏好，生成内容时自动应用</p>
          </div>
          <div className="px-6 py-4 space-y-4">
            {/* Default platform */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">默认发布平台</label>
              <div className="flex gap-2">
                {([
                  { value: 'xiaohongshu', label: '小红书' },
                  { value: 'wechat', label: '公众号' },
                  { value: 'douyin', label: '抖音' },
                ] as const).map(p => (
                  <button
                    key={p.value}
                    onClick={() => updatePref('defaultPlatform', p.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      prefs.defaultPlatform === p.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Writing style */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">写作风格</label>
              <select
                value={prefs.writingStyle}
                onChange={e => updatePref('writingStyle', e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
              >
                <option value="专业严谨">专业严谨</option>
                <option value="轻松活泼">轻松活泼</option>
                <option value="种草安利">种草安利</option>
                <option value="知识科普">知识科普</option>
                <option value="故事叙述">故事叙述</option>
              </select>
            </div>

            {/* Writing tone */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">语气偏好</label>
              <select
                value={prefs.writingTone}
                onChange={e => updatePref('writingTone', e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
              >
                <option value="友好亲切">友好亲切</option>
                <option value="权威专业">权威专业</option>
                <option value="幽默风趣">幽默风趣</option>
                <option value="温暖感性">温暖感性</option>
                <option value="简洁直接">简洁直接</option>
              </select>
            </div>

            {/* Default length */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                <Ruler size={12} />
                默认文章长度
              </label>
              <div className="flex gap-2">
                {([
                  { value: 'short', label: '短篇 ~300字' },
                  { value: 'medium', label: '中篇 ~600字' },
                  { value: 'long', label: '长篇 1000+' },
                ] as const).map(l => (
                  <button
                    key={l.value}
                    onClick={() => updatePref('defaultLength', l.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      prefs.defaultLength === l.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto CTA */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Megaphone size={12} />
                自动添加行动号召（CTA）
              </label>
              <button
                onClick={() => updatePref('autoCta', !prefs.autoCta)}
                className={`w-11 h-6 rounded-full transition-colors relative ${prefs.autoCta ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${prefs.autoCta ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Signature */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                <PenLine size={12} />
                个性签名
              </label>
              <input
                value={prefs.signature}
                onChange={e => updatePref('signature', e.target.value)}
                placeholder="一句话介绍自己..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
              />
            </div>

            {/* Save (writing prefs) */}
            <button
              onClick={async () => {
                await saveUserPrefs(prefs);
                setPrefsSaved(true);
                toast.success('偏好已保存并同步到云端');
                setTimeout(() => setPrefsSaved(false), 2000);
              }}
              className="spark-btn-primary w-full text-sm gap-1.5"
            >
              {prefsSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
              {prefsSaved ? '已保存' : '保存偏好'}
            </button>
          </div>
        </div>

        {/* Image generation preferences */}
        <div className="rounded-2xl bg-card shadow-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <ImageIcon size={16} className="text-primary" />
              图片生成
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">封面图与全文配图的默认风格 / 模型</p>
          </div>
          <div className="px-6 py-4 space-y-4">
            {/* Cover style */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">封面图风格</label>
              <select
                value={prefs.coverStyle}
                onChange={e => updatePref('coverStyle', e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
              >
                <option value="简约清新">简约清新</option>
                <option value="商务专业">商务专业</option>
                <option value="活泼可爱">活泼可爱</option>
                <option value="高端大气">高端大气</option>
                <option value="文艺复古">文艺复古</option>
              </select>
            </div>

            {/* Image model */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">图片生成模型</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'standard', label: '标准', desc: '更快 · 适合日常配图', icon: Zap },
                  { value: 'hd', label: '高清', desc: '更精致 · 适合封面', icon: Sparkles },
                ] as const).map(m => {
                  const Icon = m.icon;
                  const active = prefs.imageModel === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => updatePref('imageModel', m.value)}
                      className={`text-left rounded-xl border-2 transition-all p-3 ${
                        active ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30 bg-background'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon size={13} className={active ? 'text-primary' : 'text-muted-foreground'} />
                        <span className={`text-xs font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{m.label}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">{m.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={async () => {
                await saveUserPrefs(prefs);
                toast.success('图片偏好已保存');
              }}
              className="spark-btn-secondary w-full text-sm gap-1.5"
            >
              <Save size={14} />
              保存图片偏好
            </button>
          </div>
        </div>

        {/* Tone preset (火花的语气) */}
        <TonePresetCard />

        {/* Desktop client tokens */}
        <DeviceTokenManager />
      </div>
    </div>
  );
}
