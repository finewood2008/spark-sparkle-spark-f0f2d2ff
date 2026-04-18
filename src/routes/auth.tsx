import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, AlertCircle, ShieldAlert } from 'lucide-react';
import SparkLogo from '@/components/SparkLogo';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  recordLoginFailure,
  clearLoginFailures,
} from '@/functions/login-rate-limit.functions';

export const Route = createFileRoute('/auth')({
  head: () => ({
    meta: [
      { title: '登录 — 火花 Brand Spark' },
      { name: 'description', content: '邮箱验证码登录或注册火花账号' },
    ],
  }),
  component: AuthPage,
  ssr: false,
});

function AuthPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // login (邮箱 + 密码)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  // 失败计数 + 冷却（持久化）
  const LOCK_KEY = 'spark_login_lock';
  const MAX_ATTEMPTS = 5;
  const COOLDOWN_SEC = 60;
  const [failCount, setFailCount] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [lockRemain, setLockRemain] = useState(0);

  // register (邮箱 + 密码 一步注册)
  const [regEmail, setRegEmail] = useState('');
  const [regPwd, setRegPwd] = useState('');
  const [regConfirmPwd, setRegConfirmPwd] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [regEmailErr, setRegEmailErr] = useState('');
  const [regPwdErr, setRegPwdErr] = useState('');

  // forgot password
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate({ to: '/' });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // 恢复锁定状态
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCK_KEY);
      if (!raw) return;
      const { count, until } = JSON.parse(raw) as { count: number; until: number };
      setFailCount(count || 0);
      if (until && until > Date.now()) setLockUntil(until);
      else if (until) localStorage.removeItem(LOCK_KEY);
    } catch {}
  }, []);

  // 冷却倒计时
  useEffect(() => {
    if (lockUntil <= 0) return;
    const tick = () => {
      const remain = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockRemain(remain);
      if (remain <= 0) {
        setLockUntil(0);
        setFailCount(0);
        localStorage.removeItem(LOCK_KEY);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  const validateEmail = (v: string) => {
    if (!v) return '请输入邮箱';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return '邮箱格式不正确';
    if (v.length > 254) return '邮箱过长';
    return '';
  };
  const validatePwd = (v: string) => {
    if (!v) return '请输入密码';
    if (v.length < 8) return '密码至少 8 位';
    if (v.length > 72) return '密码过长（最多 72 位）';
    return '';
  };

  const recordFailure = () => {
    const next = failCount + 1;
    setFailCount(next);
    if (next >= MAX_ATTEMPTS) {
      const until = Date.now() + COOLDOWN_SEC * 1000;
      setLockUntil(until);
      try {
        localStorage.setItem(LOCK_KEY, JSON.stringify({ count: next, until }));
      } catch {}
      toast.error(`登录失败次数过多，请 ${COOLDOWN_SEC} 秒后再试`);
    } else {
      try {
        localStorage.setItem(LOCK_KEY, JSON.stringify({ count: next, until: 0 }));
      } catch {}
    }
  };

  const resetFailures = () => {
    setFailCount(0);
    setLockUntil(0);
    localStorage.removeItem(LOCK_KEY);
  };

  const handleLogin = async () => {
    if (lockUntil > Date.now()) {
      toast.error(`请 ${lockRemain} 秒后再试`);
      return;
    }
    const eErr = validateEmail(loginEmail);
    const pErr = validatePwd(loginPwd);
    setEmailErr(eErr);
    setPwdErr(pErr);
    if (eErr || pErr) return;

    setLoading(true);
    // 直接登录（去掉了登录前的后端预检 RPC，节省一次往返）
    // 锁定保护依然由：前端 localStorage 兜底 + 失败时 recordLoginFailure 返回最新锁状态 来保证
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPwd,
    });
    if (error || !data.user) {
      // 3. 失败 → 后端写入记录并取最新锁定状态
      try {
        const status = await recordLoginFailure({ data: { email: loginEmail } });
        if (status.locked) {
          const until = Date.now() + status.remainSec * 1000;
          setLockUntil(until);
          try {
            localStorage.setItem(LOCK_KEY, JSON.stringify({ count: MAX_ATTEMPTS, until }));
          } catch {}
          const reasonText = status.reason === 'ip' ? '该网络' : '该账号';
          toast.error(`${reasonText}登录失败次数过多，已锁定 ${status.remainSec} 秒`);
          setLoading(false);
          return;
        }
      } catch {
        // 后端记录失败时降级到前端计数
      }
      recordFailure();
      const remaining = MAX_ATTEMPTS - failCount - 1;
      const msg = error?.message?.toLowerCase().includes('invalid')
        ? '邮箱或密码错误'
        : (error?.message || '登录失败');
      setPwdErr(msg);
      if (remaining > 0 && remaining <= 2) {
        toast.error(`${msg}，还剩 ${remaining} 次机会`);
      } else if (remaining > 2) {
        toast.error(msg);
      }
      setLoading(false);
      return;
    }
    setLoading(false);
    // 4. 成功 → 清空后端 + 前端记录
    resetFailures();
    clearLoginFailures({ data: { email: loginEmail } }).catch(() => {});
    login(
      {
        id: data.user.id,
        username: data.user.email?.split('@')[0] || 'user',
        nickname: (data.user.user_metadata?.nickname as string) || data.user.email?.split('@')[0] || '火花用户',
        avatar: '',
        email: data.user.email || undefined,
      },
      data.session?.access_token || '',
    );
    toast.success('登录成功，欢迎回来！');
    navigate({ to: '/' });
  };

  const handleSendOtp = async () => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail);
    if (!emailOk) {
      toast.error('请输入正确的邮箱');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: regEmail,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || '验证码发送失败');
      return;
    }
    setStep('otp');
    setCountdown(60);
    toast.success('验证码已发送，请查看邮箱');
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      toast.error('请输入 6 位验证码');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: regEmail,
      token: otp,
      type: 'email',
    });
    setLoading(false);
    if (error || !data.user) {
      toast.error(error?.message || '验证码错误或已过期');
      return;
    }
    // 邮箱验证通过 — 进入设置密码步骤（此时已有 session，可调用 updateUser）
    toast.success('邮箱验证成功，请设置登录密码');
    setStep('password');
  };

  const handleSetPassword = async () => {
    const pErr = validatePwd(newPwd);
    if (pErr) {
      toast.error(pErr);
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    const { data: updateData, error } = await supabase.auth.updateUser({
      password: newPwd,
    });
    if (error || !updateData.user) {
      setLoading(false);
      toast.error(error?.message || '密码设置失败，请重试');
      return;
    }
    // 拿到当前 session（verifyOtp 已建立）
    const { data: sessionData } = await supabase.auth.getSession();
    setLoading(false);

    login(
      {
        id: updateData.user.id,
        username: updateData.user.email?.split('@')[0] || 'user',
        nickname: updateData.user.email?.split('@')[0] || '火花用户',
        avatar: '',
        email: updateData.user.email || undefined,
      },
      sessionData.session?.access_token || '',
    );
    toast.success('注册完成，欢迎加入火花！');
    navigate({ to: '/' });
  };

  const handleForgotPassword = async () => {
    const eErr = validateEmail(forgotEmail);
    if (eErr) {
      toast.error(eErr);
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast.error(error.message || '发送重置邮件失败');
      return;
    }
    setForgotSent(true);
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
            <SparkLogo size={30} className="text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">欢迎来到火花</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === 'login' ? '登录以解锁你的 AI 内容助手' : '邮箱验证，立即开通账号'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-muted p-1 mb-6">
          <button
            type="button"
            onClick={() => { setTab('login'); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setStep('email'); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === 'register' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            注册
          </button>
        </div>

        {/* Login form */}
        {tab === 'login' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {lockUntil > Date.now() && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <span>登录失败次数过多，账户已临时锁定。请 <span className="font-semibold">{lockRemain}s</span> 后再试。</span>
              </div>
            )}
            <div>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={`spark-input pl-9 ${emailErr ? 'border-destructive focus:ring-destructive/30' : ''}`}
                  placeholder="邮箱"
                  type="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); if (emailErr) setEmailErr(''); }}
                  onBlur={() => loginEmail && setEmailErr(validateEmail(loginEmail))}
                />
              </div>
              {emailErr && (
                <p className="mt-1.5 ml-1 flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle size={12} /> {emailErr}
                </p>
              )}
            </div>
            <div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={`spark-input pl-9 pr-10 ${pwdErr ? 'border-destructive focus:ring-destructive/30' : ''}`}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="密码（至少 8 位）"
                  autoComplete="current-password"
                  value={loginPwd}
                  onChange={(e) => { setLoginPwd(e.target.value); if (pwdErr) setPwdErr(''); }}
                  onBlur={() => loginPwd && setPwdErr(validatePwd(loginPwd))}
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
              {pwdErr && (
                <p className="mt-1.5 ml-1 flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle size={12} /> {pwdErr}
                </p>
              )}
              <div className="mt-1.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(loginEmail);
                    setForgotSent(false);
                    setForgotOpen(true);
                  }}
                  className="text-xs text-muted-foreground hover:text-spark-orange transition"
                >
                  忘记密码？
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading || lockUntil > Date.now()}
              className="spark-btn-primary w-full h-11 text-base"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : lockUntil > Date.now() ? (
                <>已锁定 {lockRemain}s</>
              ) : (
                <>登录 <ArrowRight size={16} /></>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground pt-1">
              还没有账号？
              <button
                type="button"
                onClick={() => { setTab('register'); setStep('email'); }}
                className="text-spark-orange hover:underline ml-1"
              >
                立即注册
              </button>
            </p>
          </div>
        )}

        {/* Register: email step */}
        {tab === 'register' && step === 'email' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="spark-input pl-9"
                placeholder="邮箱"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
              />
            </div>
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading}
              className="spark-btn-primary w-full h-11 text-base"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>获取验证码 <ArrowRight size={16} /></>}
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

        {/* Register: OTP step */}
        {tab === 'register' && step === 'otp' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <p className="text-sm text-muted-foreground text-center">
              验证码已发送至 <span className="text-foreground font-medium">{regEmail}</span>
            </p>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="spark-input pl-9 tracking-[0.4em] text-center font-mono"
                placeholder="6 位验证码"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
              />
            </div>
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={loading}
              className="spark-btn-primary w-full h-11 text-base"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>验证邮箱 <ArrowRight size={16} /></>}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(''); }}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <ArrowLeft size={12} /> 修改邮箱
              </button>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={countdown > 0 || loading}
                className="text-spark-orange hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {countdown > 0 ? `${countdown}s 后重发` : '重新发送'}
              </button>
            </div>
          </div>
        )}

        {/* Register: set-password step */}
        {tab === 'register' && step === 'password' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <p className="text-sm text-muted-foreground text-center">
              邮箱 <span className="text-foreground font-medium">{regEmail}</span> 已验证 ✓
              <br />
              请设置一个登录密码（至少 8 位）
            </p>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="spark-input pl-9 pr-10"
                type={showNewPwd ? 'text' : 'password'}
                placeholder="新密码（至少 8 位）"
                autoComplete="new-password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowNewPwd(!showNewPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="spark-input pl-9"
                type={showNewPwd ? 'text' : 'password'}
                placeholder="再次输入密码"
                autoComplete="new-password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
              />
            </div>
            {confirmPwd && newPwd !== confirmPwd && (
              <p className="ml-1 flex items-center gap-1 text-xs text-destructive">
                <AlertCircle size={12} /> 两次输入的密码不一致
              </p>
            )}
            <button
              type="button"
              onClick={handleSetPassword}
              disabled={loading || !newPwd || !confirmPwd}
              className="spark-btn-primary w-full h-11 text-base"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>完成注册 <ArrowRight size={16} /></>}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          {tab === 'login' ? '登录' : '注册'}即表示同意{' '}
          <span className="text-spark-orange cursor-pointer hover:underline">服务条款</span> 和{' '}
          <span className="text-spark-orange cursor-pointer hover:underline">隐私政策</span>
        </p>
      </div>

      {/* 忘记密码弹窗 */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !forgotLoading && setForgotOpen(false)}
        >
          <div
            className="w-[92vw] max-w-[400px] rounded-2xl bg-card border border-border shadow-xl p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {forgotSent ? (
              <div className="text-center py-2">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail size={20} className="text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">重置邮件已发送</h3>
                <p className="text-xs text-muted-foreground mb-1">
                  请检查 <span className="text-foreground font-medium">{forgotEmail}</span>
                </p>
                <p className="text-xs text-muted-foreground mb-5">
                  点击邮件中的链接即可设置新密码（有效期 1 小时）
                </p>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="spark-btn-primary w-full h-10"
                >
                  我知道了
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-base font-semibold text-foreground mb-1">重置密码</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  输入注册邮箱，我们会发送一封含重置链接的邮件给你
                </p>
                <div className="relative mb-4">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="spark-input pl-9"
                    type="email"
                    placeholder="邮箱"
                    autoFocus
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !forgotLoading && handleForgotPassword()}
                    disabled={forgotLoading}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    disabled={forgotLoading}
                    className="flex-1 h-10 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={forgotLoading}
                    className="spark-btn-primary flex-1 h-10"
                  >
                    {forgotLoading ? <Loader2 size={16} className="animate-spin" /> : '发送重置邮件'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
