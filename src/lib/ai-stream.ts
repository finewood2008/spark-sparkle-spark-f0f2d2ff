// Shared AI utilities for Lovable AI Gateway via Supabase edge functions
import { loadUserPrefs } from './user-prefs';
import { SUPABASE_URL } from './env';
import { getAuthToken } from './auth-helpers';
import { useMemoryStore } from '@/store/memoryStore';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

/**
 * Resolve the brand/memory context string for a given AI call mode.
 *
 * Precedence:
 *   1. An explicit `brandContext` from the caller wins (ChatLayout already
 *      composes its own v2 context upstream — don't double-inject).
 *   2. Otherwise pull from the v2 memoryStore using mode-specific rules:
 *        - chat     → identity + confirmed preferences + context facts
 *        - generate → identity + all preferences (including unconfirmed,
 *                     because draft tone should reflect auto-learned rules)
 *        - analyze  → minimal brand identity only
 *   3. Returns undefined when v2 is disabled or empty, preserving the
 *      legacy no-context behavior for unauthenticated flows.
 */
function resolveBrandContext(
  mode: 'chat' | 'generate' | 'analyze',
  explicit?: string,
): string | undefined {
  if (typeof explicit === 'string' && explicit.length > 0) return explicit;
  try {
    const v2 = useMemoryStore.getState().getFullContext(mode);
    return v2 && v2.trim().length > 0 ? v2 : undefined;
  } catch {
    return undefined;
  }
}

/** Brief returned by analyze-intent edge function */
export interface IntentBrief {
  intentType: string;
  matchedAssets: string[];
  matchedRules: string[];
  risks: string[];
  clarifyQuestion: {
    question: string;
    options: Array<{ id: string; label: string; anglePrompt: string; emoji?: string; description?: string }>;
  } | null;
  skipClarify: boolean;
}

/**
 * Call analyze-intent to get a structured pre-generation brief.
 * Returns null on failure — caller should fall back to direct generation.
 */
export async function analyzeIntent(userPrompt: string): Promise<IntentBrief | null> {
  try {
    const brandContext = resolveBrandContext('analyze') ?? '';
    const token = await getAuthToken();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/analyze-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userPrompt, brandContext }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as IntentBrief;
    return data;
  } catch {
    return null;
  }
}

/** One turn of the multi-turn pre-creation dialogue */
export interface DialogueSuggestion {
  id: string;
  emoji: string;
  label: string;
  description: string;
  /** Text sent on click (first-person tone) */
  value: string;
}
export interface DialogueTurn {
  reply: string;
  suggestions: DialogueSuggestion[];
  ready: boolean;
  brief?: {
    chosenAngle: string;
    matchedAssets: string[];
    matchedRules: string[];
    risks: string[];
  };
}

/**
 * Multi-turn pre-creation dialogue. Send original prompt + accumulated
 * (user+assistant) history; backend decides whether to ask another round
 * or signal ready=true with a brief to feed into generation.
 *
 * Pass forceReady=true when the user clicks the "直接生成" escape button.
 */
export async function creativeDialogue(args: {
  originalPrompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  forceReady?: boolean;
}): Promise<DialogueTurn | null> {
  try {
    const brandContext = resolveBrandContext('analyze') ?? '';
    const token = await getAuthToken();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/creative-dialogue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        originalPrompt: args.originalPrompt,
        history: args.history,
        brandContext,
        forceReady: !!args.forceReady,
      }),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as DialogueTurn;
  } catch {
    return null;
  }
}

/** Suggestion for "what to try next" after an article is generated */
export interface AngleSuggestion {
  id: string;
  emoji: string;
  label: string;
  /** Full prompt sent back to chat when user clicks this suggestion */
  anglePrompt: string;
}

/**
 * Generate 3-4 directional, content-aware suggestions for an article.
 * Returns [] on failure — caller should fall back gracefully (e.g. show
 * nothing, or only the "提交审核" button).
 */
export async function suggestAngles(args: {
  title: string;
  content: string;
  cta?: string;
  tags?: string[];
  platform?: string;
  /** 1 = first round after generation, 2+ = after each rewrite */
  iteration?: number;
  /** Labels of angles already applied in prior rounds (so the LLM won't repeat them) */
  usedAngles?: string[];
}): Promise<AngleSuggestion[]> {
  try {
    const token = await getAuthToken();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/suggest-angles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(args),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { suggestions?: AngleSuggestion[] };
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch {
    return [];
  }
}

export async function streamChat({
  messages,
  mode = 'chat',
  platform,
  brandContext,
  intent,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  mode?: 'chat' | 'generate';
  platform?: string;
  brandContext?: string;
  /** Pre-generation brief — injected into prompt by chat edge function */
  intent?: { matchedAssets?: string[]; matchedRules?: string[]; risks?: string[]; chosenAngle?: string };
  onDelta: (text: string) => void;
  onDone: () => void;
  onError?: (error: string) => void;
}) {
  const presetId = loadUserPrefs().tonePreset;
  const effectiveBrandContext = resolveBrandContext(mode, brandContext);
  const token = await getAuthToken();
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages,
      mode,
      platform,
      brandContext: effectiveBrandContext,
      presetId,
      intent,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    onError?.(err.error || `AI 服务错误 (${resp.status})`);
    onDone();
    return;
  }

  await processSSEStream(resp, onDelta, onDone);
}

export async function streamEdit({
  action,
  text,
  fullContent,
  platform,
  brandContext,
  onDelta,
  onDone,
  onError,
}: {
  action: string;
  text: string;
  fullContent?: string;
  platform?: string;
  brandContext?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError?: (error: string) => void;
}) {
  // streamEdit handles selection-level rewrites (polish/rewrite/expand/shorten).
  // We treat these as 'generate' mode so auto-learned preferences apply.
  const effectiveBrandContext = resolveBrandContext('generate', brandContext);
  const token = await getAuthToken();
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-edit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action,
      text,
      fullContent,
      platform,
      brandContext: effectiveBrandContext,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    onError?.(err.error || `AI 服务错误 (${resp.status})`);
    onDone();
    return;
  }

  await processSSEStream(resp, onDelta, onDone);
}

async function processSSEStream(
  resp: Response,
  onDelta: (text: string) => void,
  onDone: () => void,
) {
  if (!resp.body) { onDone(); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);

      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') { streamDone = true; break; }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }

  // Flush remaining
  if (buffer.trim()) {
    for (let raw of buffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (!raw.startsWith('data: ')) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

// Non-streaming generate for schedule auto-generation
export async function generateArticle({
  topic,
  platform,
  style,
  brandContext,
}: {
  topic: string;
  platform: string;
  style?: string;
  brandContext?: string;
}): Promise<{ title: string; content: string; cta: string; tags: string[] }> {
  let raw = '';
  await new Promise<void>((resolve, reject) => {
    streamChat({
      messages: [{ role: 'user', content: `请为"${topic}"这个主题生成一篇文章。${style ? `写作风格：${style}` : ''}` }],
      mode: 'generate',
      platform,
      brandContext,
      onDelta: (chunk) => { raw += chunk; },
      onDone: () => resolve(),
      onError: (err) => reject(new Error(err)),
    });
  });

  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  try {
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title || topic,
      content: parsed.content || raw,
      cta: parsed.cta || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    return { title: topic, content: raw, cta: '', tags: [] };
  }
}
