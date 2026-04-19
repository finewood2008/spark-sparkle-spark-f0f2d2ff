import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, User, Camera, MessageSquare, Github, Building2, Globe, Link2, Unlink, Loader2, Check, LogOut, Save, Lock, Eye, EyeOff, ShieldCheck, AlertCircle, KeyRound, Settings2, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getBindingStatus, bindThirdPartyAccount, unbindThirdPartyAccount, type BindingStatus, type SocialProvider } from '@/services/authService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { requireSession } from '@/lib/auth-helpers';

export const Route = createFileRoute('/account')({
  head: () => ({
    meta: [
      { title: '账号设置 — 火花' },
      { name: 'description', content: '管理你的火花账号和第三方绑定' },
    ],
  }),
  ssr: false,
  beforeLoad: () => requireSession(),
  component: AccountPage,
});

const providerIcons: Record<string, React.ReactNode> = {
  wechat: <MessageSquare size={20} />,
  wecom: <Building2 size={20} />,
  github: <Github size={20} />,
  google: <Globe size={20} />,
};

function AccountPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [bindings, setBindings] = useState<BindingStatus[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  // 密码设置
  const [hasPassword, setHasPassword] = useState<boolean>(false);
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdErr, setPwdErr] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: '/auth' });
      return;
    }
    getBindingStatus(user!.id).then(setBindings);
    syncPrefsFromCloud().then(setPrefs);
    // 通过 user_metadata.has_password 标记位判断（注册成功后写入）
    supabase.auth.getUser().then(({ data }) => {
      setHasPassword(!!data.user?.user_metadata?.has_password);
    });
  }, [isAuthenticated, navigate, user]);

  const handleSavePassword = async () => {
    setPwdErr('');
    if (newPwd.length < 8) { setPwdErr('新密码至少 8 位'); return; }
    if (newPwd.length > 72) { setPwdErr('新密码不超过 72 位'); return; }
    if (newPwd !== confirmPwd) { setPwdErr('两次输入的密码不一致'); return; }
    if (hasPassword && !currentPwd) { setPwdErr('请输入当前密码'); return; }

    setPwdSaving(true);
    // 修改密码：先用旧密码校验
    if (hasPassword) {
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPwd,
      });
      if (signErr) {
        setPwdSaving(false);
        setPwdErr('当前密码错误');
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({
      password: newPwd,
      data: { has_password: true },
    });
    setPwdSaving(false);
    if (error) {
      setPwdErr(error.message || '保存失败');
      return;
    }
    setHasPassword(true);
    setShowPwdForm(false);
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    toast.success(hasPassword ? '密码已修改' : '密码已设置，下次可直接用邮箱+密码登录');
  };

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
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

        {/* Security card — 设置/修改密码 */}
        <div className="rounded-2xl bg-card shadow-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" />
                登录密码
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasPassword
                  ? '已设置密码，可使用邮箱 + 密码登录'
                  : '尚未设置密码，目前仅支持邮箱验证码登录'}
              </p>
            </div>
            {!showPwdForm && (
              <button
                onClick={() => { setShowPwdForm(true); setPwdErr(''); }}
                className="spark-btn-secondary text-xs gap-1.5"
              >
                <KeyRound size={14} />
                {hasPassword ? '修改密码' : '设置密码'}
              </button>
            )}
          </div>

          {showPwdForm && (
            <div className="px-6 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              {hasPassword && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">当前密码</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      placeholder="输入当前密码"
                      className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">新密码（至少 8 位）</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="输入新密码"
                    className="w-full rounded-xl border border-border bg-background pl-9 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">再次确认新密码</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePassword()}
                    placeholder="再次输入新密码"
                    className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              {pwdErr && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle size={12} /> {pwdErr}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSavePassword}
                  disabled={pwdSaving}
                  className="spark-btn-primary flex-1 text-sm gap-1.5"
                >
                  {pwdSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {hasPassword ? '保存新密码' : '设置密码'}
                </button>
                <button
                  onClick={() => {
                    setShowPwdForm(false);
                    setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); setPwdErr('');
                  }}
                  disabled={pwdSaving}
                  className="spark-btn-secondary text-sm px-4"
                >
                  取消
                </button>
              </div>
            </div>
          )}
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

        {/* Preferences card */}
        <div className="rounded-2xl bg-card shadow-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Palette size={16} className="text-primary" />
              个人偏好
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">设置你的默认写作偏好，生成内容时自动应用</p>
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
                    onClick={() => setPrefs(prev => ({ ...prev, defaultPlatform: p.value }))}
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
                onChange={e => setPrefs(prev => ({ ...prev, writingStyle: e.target.value }))}
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
                onChange={e => setPrefs(prev => ({ ...prev, writingTone: e.target.value }))}
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
                    onClick={() => setPrefs(prev => ({ ...prev, defaultLength: l.value }))}
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
                onClick={() => setPrefs(prev => ({ ...prev, autoCta: !prev.autoCta }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${prefs.autoCta ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${prefs.autoCta ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Cover style */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                <Image size={12} />
                封面图风格
              </label>
              <select
                value={prefs.coverStyle}
                onChange={e => setPrefs(prev => ({ ...prev, coverStyle: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
              >
                <option value="简约清新">简约清新</option>
                <option value="商务专业">商务专业</option>
                <option value="活泼可爱">活泼可爱</option>
                <option value="高端大气">高端大气</option>
                <option value="文艺复古">文艺复古</option>
              </select>
            </div>

            {/* Signature */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                <PenLine size={12} />
                个性签名
              </label>
              <input
                value={prefs.signature}
                onChange={e => setPrefs(prev => ({ ...prev, signature: e.target.value }))}
                placeholder="一句话介绍自己..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
              />
            </div>

            {/* Save */}
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

        {/* Tone preset (原系统设置) */}
        <TonePresetCard />

        {/* Desktop client tokens */}
        <DeviceTokenManager />
      </div>
    </div>
  );
}
