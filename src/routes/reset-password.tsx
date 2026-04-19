import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import SparkLogo from '@/components/SparkLogo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Route = createFileRoute('/reset-password')({
  head: () => ({
    meta: [
      { title: '重置密码 — 火花 Brand Spark' },
      { name: 'description', content: '设置新密码以重新登录火花账号' },
    ],
  }),
  component: ResetPasswordPage,
  ssr: false,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);

  // 校验恢复 session 是否就绪
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
        setValidSession(true);
      }
    });
    // 同时检查当前 session（用户可能已经在恢复模式）
    supabase.auth.getSession().then(({ data }) => {
      // hash 中带 type=recovery 时 supabase 会自动建立临时 session
      if (data.session) setValidSession(true);
      else if (!window.location.hash.includes('type=recovery')) {
        setValidSession(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const validatePwd = (v: string) => {
    if (!v) return '请输入新密码';
    if (v.length < 8) return '密码至少 8 位';
    if (v.length > 72) return '密码过长（最多 72 位）';
    return '';
  };

  const handleSubmit = async () => {
    const e1 = validatePwd(pwd);
    if (e1) {
      toast.error(e1);
      return;
    }
    if (pwd !== pwd2) {
      toast.error('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) {
      toast.error(error.message || '密码重置失败');
      return;
    }
    setDone(true);
    toast.success('密码已更新，请用新密码登录');
    // 退出恢复 session 后跳登录
    await supabase.auth.signOut();
    setTimeout(() => navigate({ to: '/auth' }), 1500);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--accent) / 0.08) 100%)' }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <SparkLogo size={32} />
            <span className="text-2xl font-semibold tracking-tight">火花</span>
          </div>
          <h1 className="text-xl font-medium text-foreground">重置密码</h1>
          <p className="text-sm text-muted-foreground mt-1">设置一个新的登录密码</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          {validSession === false ? (
            <div className="text-center py-6">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium mb-1">链接无效或已过期</p>
              <p className="text-xs text-muted-foreground mb-4">
                请回到登录页重新申请「忘记密码」
              </p>
              <button
                onClick={() => navigate({ to: '/auth' })}
                className="text-sm text-primary hover:underline"
              >
                返回登录
              </button>
            </div>
          ) : done ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium mb-1">密码已更新</p>
              <p className="text-xs text-muted-foreground">即将跳转到登录页…</p>
            </div>
          ) : validSession === null ? (
            <div className="text-center py-6">
              <Loader2 className="w-6 h-6 text-muted-foreground mx-auto animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    placeholder="至少 8 位"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                    maxLength={72}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">确认新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={pwd2}
                    onChange={(e) => setPwd2(e.target.value)}
                    placeholder="再次输入新密码"
                    className="w-full pl-10 py-2.5 rounded-lg bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                    maxLength={72}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && handleSubmit()}
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '更新密码'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
