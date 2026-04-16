import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Flame, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, User as UserIcon, MessageSquareText, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { loginWithPassword, applyForRegistration } from '@/services/authService';
import { toast } from 'sonner';

export const Route = createFileRoute('/auth')({
  head: () => ({
    meta: [
      { title: '登录 — 火花 Brand Spark' },
      { name: 'description', content: '登录或申请注册火花账号' },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();
  const [tab, setTab] = useState<'login' | 'apply'>('login');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // apply
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [reason, setReason] = useState('');
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate({ to: '/' });
  }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    setLoading(true);
    const res = await loginWithPassword(username, password);
    setLoading(false);
    if (res.success && res.user && res.token) {
      login(res.user, res.token);
      toast.success('登录成功，欢迎回来！');
      navigate({ to: '/' });
    } else {
      toast.error(res.error || '登录失败');
    }
  };

  const handleApply = async () => {
    setLoading(true);
    const res = await applyForRegistration({ email, nickname, reason });
    setLoading(false);
    if (res.success) {
      setApplied(true);
      toast.success('注册申请已提交，请等待审核');
    } else {
      toast.error(res.error || '提交失败');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, oklch(0.985 0.002 90), oklch(0.95 0.04 70 / 30%))' }}
    >
      <div className="w-full max-w-[420px] rounded-2xl bg-card shadow-lg border border-border p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-2xl spark-gradient flex items-center justify-center mb-4 spark-shadow">
            <Flame className="text-primary-foreground" size={28} />
          </div>
          <h1 className="text-xl font-bold text-foreground">欢迎来到火花</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === 'login' ? '登录以解锁你的 AI 内容助手' : '提交申请，加入火花内测'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-muted p-1 mb-6">
          <button
            type="button"
            onClick={() => { setTab('login'); setApplied(false); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => setTab('apply')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === 'apply' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            申请注册
          </button>
        </div>

        {/* Login form */}
        {tab === 'login' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="spark-input pl-9"
                placeholder="邮箱 / 用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="spark-input pl-9 pr-10"
                type={showPwd ? 'text' : 'password'}
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="spark-btn-primary w-full h-11 text-base"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>登录 <ArrowRight size={16} /></>}
            </button>

            <p className="text-center text-xs text-muted-foreground pt-1">
              还没有账号？
              <button
                type="button"
                onClick={() => setTab('apply')}
                className="text-spark-orange hover:underline ml-1"
              >
                申请注册
              </button>
            </p>
          </div>
        )}

        {/* Apply form */}
        {tab === 'apply' && !applied && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="spark-input pl-9"
                placeholder="邮箱（审核通过后通知）"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="spark-input pl-9"
                placeholder="昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
            <div className="relative">
              <MessageSquareText size={16} className="absolute left-3 top-3 text-muted-foreground" />
              <textarea
                className="spark-input pl-9 pt-2.5 min-h-[88px] resize-none"
                placeholder="申请理由（选填，例如：你的内容场景）"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
              />
              <span className="absolute right-3 bottom-2 text-[11px] text-muted-foreground">
                {reason.length}/200
              </span>
            </div>
            <button
              type="button"
              onClick={handleApply}
              disabled={loading}
              className="spark-btn-primary w-full h-11 text-base"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>提交申请 <ArrowRight size={16} /></>}
            </button>

            <p className="text-center text-xs text-muted-foreground pt-1">
              已有账号？
              <button
                type="button"
                onClick={() => setTab('login')}
                className="text-spark-orange hover:underline ml-1"
              >
                直接登录
              </button>
            </p>
          </div>
        )}

        {/* Apply success */}
        {tab === 'apply' && applied && (
          <div className="flex flex-col items-center text-center py-6 animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-full bg-spark-orange/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="text-spark-orange" size={32} />
            </div>
            <h2 className="text-base font-semibold text-foreground">申请已提交</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              我们会在 1-2 个工作日内审核，<br />通过后将通过邮箱 <span className="text-foreground">{email}</span> 通知你。
            </p>
            <button
              type="button"
              onClick={() => { setTab('login'); setApplied(false); }}
              className="spark-btn-secondary mt-6 px-6"
            >
              返回登录
            </button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          {tab === 'login' ? '登录' : '提交'}即表示同意{' '}
          <span className="text-spark-orange cursor-pointer hover:underline">服务条款</span> 和{' '}
          <span className="text-spark-orange cursor-pointer hover:underline">隐私政策</span>
        </p>
      </div>
    </div>
  );
}
