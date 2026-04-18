import { useEffect, useState } from 'react';
import { Loader2, Plus, Copy, Check, Trash2, Smartphone, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  createDeviceToken,
  listDeviceTokens,
  revokeDeviceToken,
} from '@/functions/device-tokens.functions';
import { supabase } from '@/integrations/supabase/client';

/** Get auth headers for TSS server functions (they don't auto-attach Supabase JWT). */
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Convert a thrown Response (from middleware) into a readable Error message. */
async function toReadableError(e: unknown): Promise<Error> {
  if (e instanceof Response) {
    const text = await e.text().catch(() => '');
    return new Error(text || `请求失败 (${e.status})`);
  }
  return e instanceof Error ? e : new Error(String(e));
}

interface TokenRow {
  id: string;
  label: string;
  token_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '从未';
  return new Date(iso).toLocaleString('zh-CN', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DeviceTokenManager() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    try {
      const headers = await authHeaders();
      if (!headers.Authorization) {
        // Not signed in yet — render empty list, no error toast.
        setTokens([]);
        return;
      }
      const res = await listDeviceTokens({ headers });
      setTokens(res.tokens as TokenRow[]);
    } catch (e) {
      const err = await toReadableError(e);
      console.warn('[device-tokens] list failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const headers = await authHeaders();
      if (!headers.Authorization) {
        toast.error('请先登录后再创建 Token');
        return;
      }
      const res = await createDeviceToken({
        data: { label: newLabel.trim() || '桌面客户端' },
        headers,
      });
      setIssuedToken(res.token);
      setNewLabel('');
      setShowCreate(false);
      await refresh();
    } catch (e) {
      const err = await toReadableError(e);
      toast.error(err.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!issuedToken) return;
    try {
      await navigator.clipboard.writeText(issuedToken);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('复制失败，请手动选择文字');
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('吊销后桌面客户端将无法再上传数据，确认继续？')) return;
    try {
      const headers = await authHeaders();
      await revokeDeviceToken({ data: { id }, headers });
      toast.success('Token 已吊销');
      await refresh();
    } catch (e) {
      const err = await toReadableError(e);
      toast.error(err.message || '吊销失败');
    }
  };
  const activeTokens = tokens.filter(t => !t.revoked_at);

  return (
    <div className="rounded-2xl bg-card shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Smartphone size={16} className="text-primary" />
          桌面客户端 Token
        </h2>
        {!showCreate && !issuedToken && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus size={12} /> 新建 Token
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        用于火花桌面版上传小红书 / 抖音 / 微信公众号的真实数据。每个 Token 仅显示一次，请妥善保存。
      </p>

      {/* Issued token banner — show full token once */}
      {issuedToken && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start gap-2 text-amber-900">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <div className="text-xs leading-relaxed">
              <p className="font-semibold mb-0.5">Token 已生成 — 仅显示这一次</p>
              <p>请立即复制并粘贴到火花桌面版「设置 → 云端连接」。关闭此窗后无法再次查看，但可以随时新建。</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
            <code className="flex-1 text-xs font-mono text-foreground break-all select-all">
              {issuedToken}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 w-8 h-8 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-800 flex items-center justify-center transition-colors"
              title="复制"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <button
            onClick={() => setIssuedToken(null)}
            className="text-xs text-amber-800 hover:underline"
          >
            我已保存好，关闭提示
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="设备标签，如：MacBook Air、公司电脑"
            maxLength={64}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowCreate(false); setNewLabel(''); }}
              disabled={creating}
              className="px-3 py-1.5 text-xs rounded-lg text-muted-foreground hover:text-foreground"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 disabled:opacity-60"
            >
              {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              生成 Token
            </button>
          </div>
        </div>
      )}

      {/* Token list */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin mr-2" /> 加载中...
        </div>
      ) : activeTokens.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
          还没有桌面 Token，点上方「新建 Token」创建一个
        </div>
      ) : (
        <ul className="space-y-2">
          {activeTokens.map(t => (
            <li
              key={t.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-background"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{t.label}</span>
                  <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {t.token_prefix}…
                  </code>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  创建于 {formatDate(t.created_at)} · 上次使用 {formatDate(t.last_used_at)}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(t.id)}
                className="shrink-0 w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                title="吊销"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-4 text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          桌面客户端如何对接？
        </summary>
        <div className="mt-2 text-muted-foreground space-y-1 pl-1">
          <p>桌面 App 在用户已登录的小红书 / 抖音 / 微信公众号页面抓到数据后，POST 到：</p>
          <code className="block bg-muted p-2 rounded font-mono text-[11px] break-all">
            POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/ingest-metrics
            <br />Authorization: Bearer &lt;token&gt;
            <br />Body: {'{ metrics: [{ review_item_id, platform, views, likes, comments, saves, shares }] }'}
          </code>
          <p>详细协议见 <code>DESKTOP_INGEST.md</code>。</p>
        </div>
      </details>
    </div>
  );
}
