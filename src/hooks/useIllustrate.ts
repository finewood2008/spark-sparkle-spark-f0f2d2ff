/**
 * useIllustrate — 抽离自 ContentCard 的"全文配图"逻辑
 *
 * 职责：
 * 1) 维护配图相关 UI 状态（loading / 进度 / 单图重生 spinner / prompt 记忆）
 * 2) 提供 3 个动作：handleIllustrate（全文）、handleDeleteImage（删单张）、handleRegenerateImage（重生单张）
 * 3) 通过参数从外部接住共享状态（编辑态、撤销栈、错误提示），保持与 ContentCard 行为一致
 *
 * 用法：
 *   const ill = useIllustrate({ item, editing, editContent, setEditContent,
 *     setEditing, setExpanded, setUndoStack, setActionError, contents, setContents });
 *   ill.handleIllustrate();
 */
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ContentItem } from '../types/spark';
import { getAuthToken } from '@/lib/auth-helpers';
import { SUPABASE_URL } from '@/lib/env';

interface UseIllustrateArgs {
  item: ContentItem;
  editing: boolean;
  editContent: string;
  editTitle: string;
  setEditContent: (s: string) => void;
  setEditing: (b: boolean) => void;
  setExpanded: (b: boolean) => void;
  setUndoStack: React.Dispatch<React.SetStateAction<string[]>>;
  setActionError: (key: 'illustrate', msg: string | null) => void;
  contents: ContentItem[];
  setContents: (items: ContentItem[]) => void;
}

export function useIllustrate(args: UseIllustrateArgs) {
  const {
    item, editing, editContent, editTitle,
    setEditContent, setEditing, setExpanded, setUndoStack, setActionError,
    contents, setContents,
  } = args;

  const [illustrateLoading, setIllustrateLoading] = useState(false);
  /** 全文配图进度：{done, total}，total=0 表示规划中（尚未拿到 plan） */
  const [illustrateProgress, setIllustrateProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  /** 每张已生成插图对应的英文 prompt（key=imageUrl）。会话级，刷新后丢失则用 alt 兜底。 */
  const imagePromptsRef = useRef<Map<string, { prompt: string; alt: string }>>(new Map());
  /** 正在重新生成的图片 URL 集合，用于在 figure 上盖一层 spinner */
  const [regeneratingUrls, setRegeneratingUrls] = useState<Set<string>>(new Set());

  /**
   * 全文智能配图（SSE 流式）：
   * 1) plan 事件：拿到所有插图位置，先在原文锚点处插入"🎨 正在配第 N/总 张..."占位
   * 2) image 事件：每张图完成立即把对应占位换成真实 markdown 图片
   * 3) image_failed：换成"⚠️ 第 N 张配图失败"提示
   * 4) done：清理 + toast
   */
  const handleIllustrate = useCallback(async () => {
    const startContent = editing ? editContent : item.content;
    const currentTitle = editing ? editTitle : item.title;
    if (startContent.length < 50) {
      toast.error('正文太短（少于 50 字），无法智能配图');
      return;
    }
    setActionError('illustrate', null);
    setIllustrateLoading(true);
    setIllustrateProgress({ done: 0, total: 0 });
    setUndoStack(prev => [...prev, startContent]);
    if (!editing) {
      setEditing(true);
      setExpanded(true);
      setEditContent(startContent);
    }

    // 占位 token：用人类可读 + 渲染器可识别的格式
    const placeholderFor = (i: number, total: number) => `[[SPARK_ILLUSTRATING:第 ${i + 1}/${total} 张]]`;
    const tokens: string[] = [];
    let working = startContent;

    const syncToStore = (next: string) => {
      const updated = contents.map(c =>
        c.id === item.id
          ? { ...c, content: next, updatedAt: new Date().toISOString() }
          : c
      );
      setContents(updated);
    };

    const insertAtAnchor = (text: string, anchor: string, payload: string): string => {
      const a = anchor.trim().substring(0, 30);
      const idx = text.indexOf(a);
      if (idx === -1) return text + payload; // 锚点丢失：追加到末尾
      const lineEnd = text.indexOf('\n', idx + a.length);
      const insertAt = lineEnd === -1 ? text.length : lineEnd;
      return text.substring(0, insertAt) + payload + text.substring(insertAt);
    };

    try {
      const authToken = await getAuthToken();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/illustrate-article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ title: currentTitle, content: startContent, platform: item.platform }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: '配图失败' }));
        setActionError('illustrate', err.error || '全文配图失败，请重试');
        setIllustrateLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let totalPlanned = 0;
      let succeeded = 0;
      let streamDone = false;

      const handleEvent = (event: string, data: string) => {
        let payload: Record<string, unknown>;
        try { payload = JSON.parse(data); } catch { return; }

        if (event === 'plan') {
          const items = (payload.items as Array<{ index: number; anchorSnippet: string; alt: string }>) || [];
          totalPlanned = (payload.total as number) || items.length;
          setIllustrateProgress({ done: 0, total: totalPlanned });
          let next = working;
          for (let i = 0; i < items.length; i++) tokens[items[i].index] = placeholderFor(items[i].index, totalPlanned);
          // 按文中出现位置降序插入，保证插入不互相影响
          const sorted = [...items].sort((a, b) => {
            const ai = next.indexOf(a.anchorSnippet.trim().substring(0, 30));
            const bi = next.indexOf(b.anchorSnippet.trim().substring(0, 30));
            return bi - ai;
          });
          for (const it of sorted) {
            const placeholder = `\n\n${tokens[it.index]}\n\n`;
            next = insertAtAnchor(next, it.anchorSnippet, placeholder);
          }
          working = next;
          setEditContent(next);
          syncToStore(next);
        } else if (event === 'image') {
          const idx = payload.index as number;
          const url = payload.imageUrl as string;
          const alt = (payload.alt as string) || '';
          const prompt = (payload.imagePrompt as string) || '';
          const token = tokens[idx];
          if (url && prompt) {
            imagePromptsRef.current.set(url, { prompt, alt });
          }
          if (token && working.includes(token)) {
            working = working.replace(token, `![${alt}](${url})`);
            setEditContent(working);
            syncToStore(working);
          }
          succeeded += 1;
          setIllustrateProgress(p => ({ done: p.done + 1, total: p.total || totalPlanned }));
        } else if (event === 'image_failed') {
          const idx = payload.index as number;
          const token = tokens[idx];
          if (token && working.includes(token)) {
            working = working.replace(token, `> ⚠️ 第 ${idx + 1} 张配图失败`);
            setEditContent(working);
            syncToStore(working);
          }
          setIllustrateProgress(p => ({ done: p.done + 1, total: p.total || totalPlanned }));
        } else if (event === 'done') {
          if (succeeded > 0) {
            toast.success(`已为正文配 ${succeeded} 张插图 ✨`);
          } else {
            setActionError('illustrate', '所有插图都生成失败，请重试');
          }
        } else if (event === 'error') {
          setActionError('illustrate', (payload.message as string) || '全文配图失败');
        }
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line === '') {
            currentEvent = '';
            continue;
          }
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            handleEvent(currentEvent || 'message', line.slice(6));
            if (currentEvent === 'done' || currentEvent === 'error') streamDone = true;
          }
        }
      }
      // 兜底：清理任何残留占位
      let cleaned = working;
      for (const t of tokens) {
        if (t && cleaned.includes(t)) {
          cleaned = cleaned.replace(t, '');
        }
      }
      if (cleaned !== working) {
        setEditContent(cleaned);
        syncToStore(cleaned);
      }
    } catch {
      setActionError('illustrate', '网络异常，全文配图失败');
    }
    setIllustrateLoading(false);
    setIllustrateProgress({ done: 0, total: 0 });
  }, [editing, editContent, editTitle, item, contents, setContents, setEditContent, setEditing, setExpanded, setUndoStack, setActionError]);

  /** 删除单张已配图：把对应的 ![alt](url) 从正文里移除，同时同步到 store。 */
  const handleDeleteImage = useCallback((url: string, alt: string) => {
    const current = editing ? editContent : item.content;
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\n*!\\[${esc(alt)}\\]\\(${esc(url)}\\)\\n*`, 'g');
    const next = current.replace(pattern, '\n\n');
    if (next === current) return;
    if (editing) setEditContent(next);
    setUndoStack(prev => [...prev, current]);
    const updated = contents.map(c =>
      c.id === item.id ? { ...c, content: next, updatedAt: new Date().toISOString() } : c,
    );
    setContents(updated);
    imagePromptsRef.current.delete(url);
    toast.success('已删除这张图');
  }, [editing, editContent, item.content, item.id, contents, setContents, setEditContent, setUndoStack]);

  /** 重新生成单张图：用记录的 prompt（或 alt 兜底）调 illustrate-article 的 single 模式，
   *  完成后把正文里的 url 替换成新的 url。 */
  const handleRegenerateImage = useCallback(async (url: string, alt: string) => {
    const meta = imagePromptsRef.current.get(url);
    const prompt = meta?.prompt || alt;
    if (!prompt) {
      toast.error('找不到这张图的生成提示，无法重新生成');
      return;
    }
    setRegeneratingUrls(prev => {
      const next = new Set(prev);
      next.add(url);
      return next;
    });
    try {
      const authToken = await getAuthToken();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/illustrate-article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          mode: 'single',
          imagePrompt: prompt,
          alt,
          platform: item.platform,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: '重新生成失败' }));
        toast.error(err.error || '重新生成失败');
        return;
      }
      const data = await resp.json() as { imageUrl: string; alt: string; imagePrompt: string };
      const newUrl = data.imageUrl;
      if (!newUrl) {
        toast.error('图片为空，请重试');
        return;
      }
      const current = editing ? editContent : item.content;
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`!\\[${esc(alt)}\\]\\(${esc(url)}\\)`, 'g');
      const next = current.replace(pattern, `![${alt}](${newUrl})`);
      setUndoStack(prev => [...prev, current]);
      if (editing) setEditContent(next);
      const updated = contents.map(c =>
        c.id === item.id ? { ...c, content: next, updatedAt: new Date().toISOString() } : c,
      );
      setContents(updated);
      imagePromptsRef.current.delete(url);
      imagePromptsRef.current.set(newUrl, { prompt: data.imagePrompt || prompt, alt });
      toast.success('已重新生成 ✨');
    } catch {
      toast.error('网络异常，重新生成失败');
    } finally {
      setRegeneratingUrls(prev => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  }, [editing, editContent, item.content, item.id, item.platform, contents, setContents, setEditContent, setUndoStack]);

  return {
    illustrateLoading,
    illustrateProgress,
    regeneratingUrls,
    handleIllustrate,
    handleDeleteImage,
    handleRegenerateImage,
  };
}
