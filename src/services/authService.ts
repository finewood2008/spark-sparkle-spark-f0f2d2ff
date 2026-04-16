/**
 * Brand Spark Auth Service
 * OAuth 2.0 风格接口定义 — Mock 实现，预留后端对接
 */

export interface AuthUser {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  email?: string;
  phone?: string;
}

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
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

// ---------- Mock helpers ----------

const MOCK_USER: AuthUser = {
  id: 'spark-user-001',
  username: 'spark_demo',
  nickname: '火花用户',
  avatar: '',
  email: 'demo@brandspark.ai',
  phone: '138****8888',
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------- API Stubs ----------

/** 密码登录 */
export async function loginWithPassword(
  username: string,
  password: string,
): Promise<LoginResult> {
  await delay(800);
  if (!username || !password) {
    return { success: false, error: '请输入账号和密码' };
  }
  // Mock: 基于用户名生成唯一 ID，确保不同账号数据隔离
  const uniqueId = `spark-user-${Array.from(username).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(36)}`;
  return {
    success: true,
    user: { ...MOCK_USER, id: uniqueId, username, nickname: username, email: `${username}@brandspark.ai` },
    token: `mock_token_${Date.now()}`,
  };
}

/** 申请注册（提交后等待管理员审核） */
export interface RegisterApplyInput {
  email: string;
  nickname: string;
  reason?: string;
}
export async function applyForRegistration(
  input: RegisterApplyInput,
): Promise<{ success: boolean; error?: string }> {
  await delay(1000);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email);
  if (!emailOk) return { success: false, error: '请输入正确的邮箱' };
  if (!input.nickname || input.nickname.trim().length < 2) {
    return { success: false, error: '昵称至少 2 个字符' };
  }
  // Mock：将申请存入 localStorage，便于演示
  try {
    const KEY = 'spark_register_applications';
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    list.push({ ...input, submittedAt: new Date().toISOString(), status: 'pending' });
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  return { success: true };
}

/** 验证码登录 */
export async function loginWithCode(
  phone: string,
  code: string,
): Promise<LoginResult> {
  await delay(800);
  if (!phone || !code) {
    return { success: false, error: '请输入手机号和验证码' };
  }
  if (code.length < 4) {
    return { success: false, error: '验证码格式不正确' };
  }
  return {
    success: true,
    user: { ...MOCK_USER, phone, nickname: `用户${phone.slice(-4)}` },
    token: `mock_token_${Date.now()}`,
  };
}

/** 发送验证码 */
export async function sendVerifyCode(phone: string): Promise<{ success: boolean; error?: string }> {
  await delay(500);
  if (!phone || phone.length < 6) {
    return { success: false, error: '请输入正确的手机号' };
  }
  return { success: true };
}

/** 第三方社交登录 */
export async function loginWithSocial(provider: SocialProvider): Promise<LoginResult> {
  await delay(1200);
  return {
    success: true,
    user: { ...MOCK_USER, nickname: `${provider}_user` },
    token: `mock_social_${provider}_${Date.now()}`,
  };
}

/** 绑定第三方账号 */
export async function bindThirdPartyAccount(
  userId: string,
  provider: SocialProvider,
): Promise<{ success: boolean; error?: string }> {
  await delay(800);
  return { success: true };
}

/** 解绑第三方账号 */
export async function unbindThirdPartyAccount(
  userId: string,
  provider: SocialProvider,
): Promise<{ success: boolean; error?: string }> {
  await delay(800);
  return { success: true };
}

/** 获取账号绑定状态列表 */
export async function getBindingStatus(userId: string): Promise<BindingStatus[]> {
  await delay(400);
  return [
    { provider: 'wechat', label: '微信', bound: true, boundAt: '2025-12-01', boundName: '火花微信号' },
    { provider: 'wecom', label: '企业微信', bound: false },
    { provider: 'github', label: 'GitHub', bound: true, boundAt: '2025-11-20', boundName: 'spark-dev' },
    { provider: 'google', label: 'Google', bound: false },
  ];
}

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
