/**
 * 登录限流 Server Function
 * 双维度（邮箱 + IP）+ 渐进式锁定
 *   - 5  次失败 → 锁 1 分钟
 *   - 10 次失败 → 锁 15 分钟
 *   - 20 次失败 → 锁 24 小时
 */
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader, getRequestIP } from '@tanstack/react-start/server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

/**
 * 本地开发缺少 SUPABASE_SERVICE_ROLE_KEY 时，限流功能直接降级为 no-op，
 * 避免登录流程被一个 dev-only 的密钥缺失炸成白屏。
 * 线上环境密钥一定存在，正常生效。
 */
function isMissingAdminKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('SUPABASE_SERVICE_ROLE_KEY');
}

const LOCK_TIERS = [
  { threshold: 20, windowMin: 60 * 24, lockSec: 60 * 60 * 24 }, // 20 次/24h → 锁 24h
  { threshold: 10, windowMin: 60, lockSec: 60 * 15 },           // 10 次/1h → 锁 15min
  { threshold: 5,  windowMin: 15, lockSec: 60 },                // 5  次/15min → 锁 1min
];

function getClientIP(): string {
  try {
    const xff = getRequestHeader('x-forwarded-for');
    if (xff) return xff.split(',')[0]!.trim();
    const cf = getRequestHeader('cf-connecting-ip');
    if (cf) return cf;
    const real = getRequestHeader('x-real-ip');
    if (real) return real;
    return getRequestIP({ xForwardedFor: true }) || 'unknown';
  } catch {
    return 'unknown';
  }
}

interface LockStatus {
  locked: boolean;
  remainSec: number;
  reason?: 'email' | 'ip';
  tier?: number; // 触发的失败次数阈值
}

/** 检查邮箱 + IP 是否处于锁定状态 */
export const checkLoginLock = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string }) => ({
    email: String(data.email || '').toLowerCase().trim().slice(0, 254),
  }))
  .handler(async ({ data }): Promise<LockStatus> => {
    const ip = getClientIP();
    if (!data.email) return { locked: false, remainSec: 0 };

    // 取最大窗口内的所有失败记录，一次查完按时间戳分桶
    const maxWindowMin = Math.max(...LOCK_TIERS.map(t => t.windowMin));
    const since = new Date(Date.now() - maxWindowMin * 60 * 1000).toISOString();

    const [emailRes, ipRes] = await Promise.all([
      supabaseAdmin
        .from('login_attempts')
        .select('attempted_at')
        .eq('email', data.email)
        .gte('attempted_at', since)
        .order('attempted_at', { ascending: false }),
      supabaseAdmin
        .from('login_attempts')
        .select('attempted_at')
        .eq('ip_address', ip)
        .gte('attempted_at', since)
        .order('attempted_at', { ascending: false }),
    ]);

    const evaluate = (rows: { attempted_at: string }[] | null, reason: 'email' | 'ip'): LockStatus | null => {
      if (!rows || rows.length === 0) return null;
      // tier 从严到松：先看是否触发 24h 锁
      for (const tier of LOCK_TIERS) {
        const cutoff = Date.now() - tier.windowMin * 60 * 1000;
        const inWindow = rows.filter(r => new Date(r.attempted_at).getTime() >= cutoff);
        if (inWindow.length >= tier.threshold) {
          // 锁定截止 = 最近一次失败 + lockSec
          const latest = new Date(inWindow[0]!.attempted_at).getTime();
          const unlockAt = latest + tier.lockSec * 1000;
          const remainSec = Math.max(0, Math.ceil((unlockAt - Date.now()) / 1000));
          if (remainSec > 0) {
            return { locked: true, remainSec, reason, tier: tier.threshold };
          }
        }
      }
      return null;
    };

    const emailLock = evaluate(emailRes.data, 'email');
    const ipLock = evaluate(ipRes.data, 'ip');
    // 取剩余时间更长的那个
    if (emailLock && ipLock) {
      return emailLock.remainSec >= ipLock.remainSec ? emailLock : ipLock;
    }
    return emailLock || ipLock || { locked: false, remainSec: 0 };
  });

/** 记录一次登录失败 */
export const recordLoginFailure = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string }) => ({
    email: String(data.email || '').toLowerCase().trim().slice(0, 254),
  }))
  .handler(async ({ data }): Promise<LockStatus> => {
    const ip = getClientIP();
    if (!data.email) return { locked: false, remainSec: 0 };

    await supabaseAdmin.from('login_attempts').insert({
      email: data.email,
      ip_address: ip,
    });

    // 顺手清理过期记录（异步，不阻塞响应）
    supabaseAdmin.rpc('cleanup_old_login_attempts').then(() => {}, () => {});

    // 写完立刻重新评估锁定状态
    return await checkLoginLock({ data: { email: data.email } });
  });

/** 登录成功后清空该邮箱的失败记录 */
export const clearLoginFailures = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string }) => ({
    email: String(data.email || '').toLowerCase().trim().slice(0, 254),
  }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    if (!data.email) return { success: true };
    await supabaseAdmin
      .from('login_attempts')
      .delete()
      .eq('email', data.email);
    return { success: true };
  });
