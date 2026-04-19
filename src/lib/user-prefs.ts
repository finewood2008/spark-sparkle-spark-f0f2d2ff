/** Shared user preferences – used by account page & AI generation */

import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';

export type TonePresetId = 'professional' | 'lively' | 'minimal';

export interface UserPreferences {
  defaultPlatform: 'xiaohongshu' | 'wechat' | 'douyin';
  writingStyle: string;
  writingTone: string;
  signature: string;
  defaultLength: 'short' | 'medium' | 'long';
  autoCta: boolean;
  coverStyle: string;
  /** 火花的语气预设：专业 / 活泼 / 极简 */
  tonePreset: TonePresetId;
  /** 图片生成模型：标准（更快）/ 高清（更好） */
  imageModel: 'standard' | 'hd';
}

export const defaultPrefs: UserPreferences = {
  defaultPlatform: 'xiaohongshu',
  writingStyle: '专业严谨',
  writingTone: '友好亲切',
  signature: '',
  defaultLength: 'medium',
  autoCta: true,
  coverStyle: '简约清新',
  tonePreset: 'lively',
  imageModel: 'standard',
};

const STORAGE_KEY = 'spark-user-prefs';

/** Load from localStorage (instant, offline-friendly) */
export function loadUserPrefs(): UserPreferences {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? { ...defaultPrefs, ...JSON.parse(s) } : defaultPrefs;
  } catch {
    return defaultPrefs;
  }
}

/** Save to localStorage */
function saveLocal(p: UserPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

/** Save to both localStorage and database (if logged in) */
export async function saveUserPrefs(p: UserPreferences) {
  saveLocal(p);
  const { user, isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated || !user?.id) return;

  const row = {
    user_id: user.id,
    default_platform: p.defaultPlatform,
    writing_style: p.writingStyle,
    writing_tone: p.writingTone,
    signature: p.signature,
    default_length: p.defaultLength,
    auto_cta: p.autoCta,
    cover_style: p.coverStyle,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('user_preferences')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('user_preferences').update(row).eq('id', existing.id);
  } else {
    await supabase.from('user_preferences').insert(row);
  }
}

/** Load from database and merge into localStorage. Returns the merged prefs. */
export async function syncPrefsFromCloud(): Promise<UserPreferences> {
  const { user, isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated || !user?.id) return loadUserPrefs();

  const { data } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (data) {
    const prefs: UserPreferences = {
      defaultPlatform: (data.default_platform as UserPreferences['defaultPlatform']) || defaultPrefs.defaultPlatform,
      writingStyle: data.writing_style || defaultPrefs.writingStyle,
      writingTone: data.writing_tone || defaultPrefs.writingTone,
      signature: data.signature || defaultPrefs.signature,
      defaultLength: ((data as any).default_length as UserPreferences['defaultLength']) || defaultPrefs.defaultLength,
      autoCta: (data as any).auto_cta ?? defaultPrefs.autoCta,
      coverStyle: (data as any).cover_style || defaultPrefs.coverStyle,
      tonePreset: loadUserPrefs().tonePreset, // 仅本地存储（数据库暂未加列）
    };
    saveLocal(prefs);
    return prefs;
  }
  return loadUserPrefs();
}

/** Build a context string for AI prompts */
export function getUserPrefsContext(): string {
  const p = loadUserPrefs();
  const parts: string[] = [];
  const lengthMap: Record<string, string> = { short: '短篇(300字内)', medium: '中篇(500-800字)', long: '长篇(1000字+)' };
  parts.push('【用户写作偏好】');
  parts.push(`默认平台: ${platformLabel(p.defaultPlatform)}`);
  parts.push(`写作风格: ${p.writingStyle}`);
  parts.push(`语气偏好: ${p.writingTone}`);
  parts.push(`文章长度: ${lengthMap[p.defaultLength] || p.defaultLength}`);
  parts.push(`自动添加CTA: ${p.autoCta ? '是' : '否'}`);
  parts.push(`封面图风格: ${p.coverStyle}`);
  if (p.signature) parts.push(`个性签名: ${p.signature}`);
  return parts.join('\n');
}

export function platformLabel(v: string) {
  const map: Record<string, string> = { xiaohongshu: '小红书', wechat: '公众号', douyin: '抖音' };
  return map[v] || v;
}
