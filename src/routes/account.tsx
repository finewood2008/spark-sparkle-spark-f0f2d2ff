import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Flame, ArrowLeft, User, Camera, MessageSquare, Github, Building2, Globe, Link2, Unlink, Loader2, Check, LogOut, Palette, PenLine, Save, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getBindingStatus, bindThirdPartyAccount, unbindThirdPartyAccount, type BindingStatus, type SocialProvider } from '@/services/authService';
import { toast } from 'sonner';

export const Route = createFileRoute('/account')({
  head: () => ({
    meta: [
      { title: '账号设置 — 火花' },
      { name: 'description', content: '管理你的火花账号和第三方绑定' },
    ],
  }),
  component: AccountPage,
});

const providerIcons: Record<string, React.ReactNode> = {
  wechat: <MessageSquare size={20} />,
  wecom: <Building2 size={20} />,
  github: <Github size={20} />,
  google: <Globe size={20} />,
};

interface UserPreferences {
  defaultPlatform: 'xiaohongshu' | 'wechat' | 'douyin';
  writingStyle: string;
  writingTone: string;
  signature: string;
}

const defaultPrefs: UserPreferences = {
  defaultPlatform: 'xiaohongshu',
  writingStyle: '专业严谨',
  writingTone: '友好亲切',
  signature: '',
};

function loadPrefs(): UserPreferences {
  try {
    const s = localStorage.getItem('spark-user-prefs');
    return s ? { ...defaultPrefs, ...JSON.parse(s) } : defaultPrefs;
  } catch { return defaultPrefs; }
}

function savePrefs(p: UserPreferences) {
  localStorage.setItem('spark-user-prefs', JSON.stringify(p));
}

function AccountPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [bindings, setBindings] = useState<BindingStatus[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences>(defaultPrefs);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: '/auth' });
      return;
    }
    getBindingStatus(user!.id).then(setBindings);
    setPrefs(loadPrefs());
  }, [isAuthenticated, navigate, user]);

  const handleBind = async (provider: SocialProvider) => {
    if (!user) return;
    setLoadingProvider(provider);
    const res = await bindThirdPartyAccount(user.id, provider);
    if (res.success) {
      setBindings(prev => prev.map(b => b.provider === provider ? { ...b, bound: true, boundAt: new Date().toISOString().slice(0, 10), boundName: `${provider}_user` } : b));
      toast.success('绑定成功');
    } else {
      toast.error(res.error || '绑定失败');
    }
    setLoadingProvider(null);
  };

  const handleUnbind = async (provider: SocialProvider) => {
    if (!user) return;
    setLoadingProvider(provider);
    const res = await unbindThirdPartyAccount(user.id, provider);
    if (res.success) {
      setBindings(prev => prev.map(b => b.provider === provider ? { ...b, bound: false, boundAt: undefined, boundName: undefined } : b));
      toast.success('已解除绑定');
    } else {
      toast.error(res.error || '解绑失败');
    }
    setLoadingProvider(null);
  };

  const handleLogout = () => {
    logout();
    toast.success('已退出登录');
    navigate({ to: '/auth' });
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-8"
      style={{ background: 'linear-gradient(180deg, oklch(0.95 0.04 70 / 20%), oklch(0.985 0.002 90))' }}>
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/" className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold text-foreground">账号设置</h1>
        </div>

        {/* Profile card */}
        <div className="rounded-2xl bg-card shadow-lg border border-border p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl spark-gradient flex items-center justify-center text-primary-foreground text-2xl font-bold">
                {user?.nickname?.charAt(0) || <User size={28} />}
              </div>
              <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                <Camera size={12} />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-foreground truncate">{user?.nickname}</h2>
              <p className="text-sm text-muted-foreground">{user?.email || user?.phone || user?.username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="spark-btn-secondary gap-1.5 text-xs"
            >
              <LogOut size={14} />
              退出
            </button>
          </div>
        </div>

        {/* Bindings card */}
        <div className="rounded-2xl bg-card shadow-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">账号绑定</h3>
            <p className="text-xs text-muted-foreground mt-0.5">绑定第三方账号，快捷登录更方便</p>
          </div>
          <div className="divide-y divide-border">
            {bindings.map(b => (
              <div key={b.provider} className="flex items-center gap-3 px-6 py-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${b.bound ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {providerIcons[b.provider] || <Globe size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{b.label}</p>
                  {b.bound ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Check size={12} className="text-primary" />
                      已绑定 · {b.boundName}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">未绑定</p>
                  )}
                </div>
                {b.bound ? (
                  <button
                    onClick={() => handleUnbind(b.provider)}
                    disabled={loadingProvider === b.provider}
                    className="spark-btn-secondary text-xs gap-1 text-destructive/80 hover:text-destructive"
                  >
                    {loadingProvider === b.provider ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
                    解除绑定
                  </button>
                ) : (
                  <button
                    onClick={() => handleBind(b.provider)}
                    disabled={loadingProvider === b.provider}
                    className="spark-btn-primary text-xs gap-1"
                  >
                    {loadingProvider === b.provider ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                    去绑定
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
