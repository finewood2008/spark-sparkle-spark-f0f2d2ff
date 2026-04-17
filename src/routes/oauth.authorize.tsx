import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Monitor, Cloud, ArrowLeftRight, Shield, FileText, MessageSquareText, RefreshCw, Check, Loader2, X, User } from 'lucide-react';
import SparkLogo from '@/components/SparkLogo';
import { useAuthStore } from '@/store/authStore';
import { handleOAuthRequest, grantOAuthCode } from '@/services/authService';
import { toast } from 'sonner';

export const Route = createFileRoute('/oauth/authorize')({
  head: () => ({
    meta: [
      { title: '授权 — 火花' },
      { name: 'description', content: '授权火花桌面版访问您的账号' },
    ],
  }),
  component: OAuthAuthorizePage,
});

const DEFAULT_PERMISSIONS = [
  { icon: <MessageSquareText size={16} />, text: '读取您的对话记录' },
  { icon: <FileText size={16} />, text: '同步生成内容与草稿' },
  { icon: <RefreshCw size={16} />, text: '同步品牌记忆与学习数据' },
  { icon: <Shield size={16} />, text: '安全加密传输，不会泄露密码' },
];

function OAuthAuthorizePage() {
  const { user, isAuthenticated } = useAuthStore();
  const [authorizing, setAuthorizing] = useState(false);
  const [done, setDone] = useState(false);

  // Mock client params
  const oauthReq = handleOAuthRequest(
    'spark-desktop-v1',
    'sparkclient://callback',
    'profile,content:read,content:write,memory:sync',
    'state_' + Date.now(),
  );

  const handleGrant = async () => {
    if (!user) return;
    setAuthorizing(true);
    const res = await grantOAuthCode(oauthReq.clientId, user.id, oauthReq.redirectUri, oauthReq.state);
    setAuthorizing(false);
    setDone(true);
    toast.success('授权成功，正在返回桌面客户端...');
    // Mock: in real flow would redirect to res.redirectUri
    console.log('[OAuth] Code granted:', res.code, 'Redirect:', res.redirectUri);
  };

  // Not logged in -> show login prompt
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4"
        style={{ background: 'linear-gradient(135deg, oklch(0.985 0.002 90), oklch(0.95 0.04 70 / 20%))' }}>
        <div className="w-full max-w-md rounded-2xl bg-card shadow-lg border border-border p-8 text-center">
          <div className="w-14 h-14 rounded-2xl spark-gradient flex items-center justify-center mx-auto mb-4 spark-shadow">
            <Flame className="text-primary-foreground" size={28} />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">需要先登录</h1>
          <p className="text-sm text-muted-foreground mb-6">火花桌面版请求授权访问您的账号，请先登录。</p>
          <Link to="/auth" className="spark-btn-primary inline-flex">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4"
        style={{ background: 'linear-gradient(135deg, oklch(0.985 0.002 90), oklch(0.95 0.04 70 / 20%))' }}>
        <div className="w-full max-w-md rounded-2xl bg-card shadow-lg border border-border p-8 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Check className="text-primary" size={32} />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">授权成功</h1>
          <p className="text-sm text-muted-foreground">正在返回火花桌面客户端，请稍候...</p>
          <div className="mt-6">
            <Link to="/" className="text-sm text-primary hover:underline">返回工作台</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4"
      style={{ background: 'linear-gradient(135deg, oklch(0.985 0.002 90), oklch(0.95 0.04 70 / 20%))' }}>
      <div className="w-full max-w-md rounded-2xl bg-card shadow-lg border border-border p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Connection diagram */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <Monitor className="text-foreground" size={26} />
            </div>
            <span className="text-xs text-muted-foreground font-medium">火花桌面版</span>
          </div>
          <div className="flex items-center gap-1 text-primary">
            <div className="w-8 h-px bg-primary/30" />
            <ArrowLeftRight size={20} className="animate-pulse" />
            <div className="w-8 h-px bg-primary/30" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl spark-gradient flex items-center justify-center spark-shadow">
              <Cloud className="text-primary-foreground" size={26} />
            </div>
            <span className="text-xs text-muted-foreground font-medium">火花云端</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold text-foreground">火花桌面版</h1>
          <p className="text-sm text-muted-foreground mt-1">请求获取您的账号授权</p>
        </div>

        {/* Permissions */}
        <div className="rounded-xl bg-muted/50 border border-border p-4 mb-6 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">授权权限</p>
          {DEFAULT_PERMISSIONS.map((perm, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-foreground">
              <span className="text-primary">{perm.icon}</span>
              {perm.text}
            </div>
          ))}
        </div>

        {/* Current user */}
        <div className="rounded-xl border border-border p-4 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl spark-gradient flex items-center justify-center text-primary-foreground text-sm font-bold">
            {user?.nickname?.charAt(0) || <User size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.nickname}</p>
            <p className="text-xs text-muted-foreground">{user?.email || user?.phone}</p>
          </div>
          <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">当前账号</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link to="/" className="spark-btn-secondary flex-1 h-11 justify-center text-base">
            <X size={16} /> 拒绝
          </Link>
          <button
            onClick={handleGrant}
            disabled={authorizing}
            className="spark-btn-primary flex-1 h-11 text-base"
          >
            {authorizing ? <Loader2 size={18} className="animate-spin" /> : <><Check size={16} /> 同意授权</>}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          授权后，桌面版将可在您的设备上安全访问以上权限
        </p>
      </div>
    </div>
  );
}
