// Shared AI utilities for Lovable AI Gateway via Supabase edge functions
import { loadUserPrefs } from './user-prefs';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY as SUPABASE_KEY } from './env';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

export async function streamChat({
  messages,
  mode = 'chat',
  platform,
  brandContext,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  mode?: 'chat' | 'generate';
  platform?: string;
  brandContext?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError?: (error: string) => void;
}) {
  const presetId = loadUserPrefs().tonePreset;
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ messages, mode, platform, brandContext, presetId }),
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
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-edit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ action, text, fullContent, platform, brandContext }),
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
