/**
 * Brand Spark Auth Service
 * 类型定义 + OAuth 2.0 授权流程 + 第三方绑定接口
 *
 * 真实登录/注册已通过 Supabase Auth 实现（见 auth.tsx / account.tsx），
 * 此文件仅保留类型导出和 OAuth / 绑定相关的接口存根。
 */

export interface AuthUser {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  email?: string;
  phone?: string;
}

export interface OAuthRequest {
  clientId: string;
  redirectUri: string;
  scope: string[];
  state?: string;
  responseType?: string;
}

export interface OAuthCodeResult {
  code: string;
  state?: string;
  redirectUri: string;
}

export type SocialProvider = 'wechat' | 'wecom' | 'github' | 'google' | 'qrcode';

export interface BindingStatus {
  provider: SocialProvider;
  label: string;
  bound: boolean;
  boundAt?: string;
  boundName?: string;
}

// ---------- Third-party binding stubs ----------
// These are placeholder implementations. Real binding uses Supabase Auth
// provider linking (supabase.auth.linkIdentity / unlinkIdentity).
// Kept as stubs until provider OAuth apps are configured in Supabase dashboard.

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Bind a third-party account (stub — awaiting provider config) */
export async function bindThirdPartyAccount(
  userId: string,
  provider: SocialProvider,
): Promise<{ success: boolean; error?: string }> {
  await delay(800);
  // Stub: always succeeds
  return { success: true };
}

/** Unbind a third-party account (stub — awaiting provider config) */
export async function unbindThirdPartyAccount(
  userId: string,
  provider: SocialProvider,
): Promise<{ success: boolean; error?: string }> {
  await delay(800);
  // Stub: always succeeds
  return { success: true };
}

/** Get binding status list (stub — returns unbound for all providers) */
export async function getBindingStatus(userId: string): Promise<BindingStatus[]> {
  await delay(400);
  // Stub: returns unbound for all providers until dashboard config is done
  return [
    { provider: 'wechat', label: '微信', bound: false },
    { provider: 'wecom', label: '企业微信', bound: false },
    { provider: 'github', label: 'GitHub', bound: false },
    { provider: 'google', label: 'Google', bound: false },
  ];
}

// ---------- OAuth 2.0 flow (桌面端授权) ----------

/** 解析线下软件发起的 OAuth 授权请求参数 */
export function handleOAuthRequest(
  clientId: string,
  redirectUri: string,
  scope?: string,
  state?: string,
): OAuthRequest {
  return {
    clientId,
    redirectUri: decodeURIComponent(redirectUri),
    scope: scope ? scope.split(',') : ['profile', 'content:read', 'content:write'],
    state,
    responseType: 'code',
  };
}

/** 同意授权后生成临时 Auth Code 并回调 */
export async function grantOAuthCode(
  clientId: string,
  userId: string,
  redirectUri: string,
  state?: string,
): Promise<OAuthCodeResult> {
  await delay(1000);
  const code = `spark_auth_code_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);
  return {
    code,
    state,
    redirectUri: callbackUrl.toString(),
  };
}
