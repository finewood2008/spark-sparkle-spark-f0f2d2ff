import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, Pencil, ClipboardCheck, Sparkles, Loader2, Undo2, Palette, BookmarkPlus, ImagePlus, ImageUp, RefreshCw, X, AlertCircle, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { ContentItem, LearningEntry } from '../types/spark';
import { toast } from 'sonner';
import { streamEdit } from '../lib/ai-stream';
import { saveReviewItem } from '../lib/review-persistence';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useMemoryV2 } from '@/hooks/useMemoryV2';
import { useMemoryStore } from '@/store/memoryStore';
import { SUPABASE_URL } from '@/lib/env';

interface ContentCardProps {
  item: ContentItem;
  onAction?: (action: string, item: ContentItem) => void;
}

interface ToolbarPos {
  top: number;
  left: number;
}

function AIFloatingToolbar({
  pos,
  onAction,
  loading,
}: {
  pos: ToolbarPos;
  onAction: (action: string) => void;
  loading: string | null;
}) {
  const actions = [
    { id: 'rewrite', label: '改写' },
    { id: 'expand', label: '扩写' },
    { id: 'simplify', label: '精简' },
  ];

  return (
    <div
      className="absolute z-50 flex items-center gap-1 bg-white rounded-lg shadow-lg border border-[#E5E4E2] px-1.5 py-1"
      style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
    >
      <span className="text-[11px] text-[#BBB] px-1">AI</span>
      {actions.map(a => (
        <button
          key={a.id}
          onClick={(e) => { e.stopPropagation(); onAction(a.id); }}
          disabled={!!loading}
          className="text-[12px] px-2.5 py-1 rounded-md text-[#666] hover:bg-spark-orange/10 hover:text-spark-orange transition-colors disabled:opacity-40 flex items-center gap-1"
        >
          {loading === a.id && <Loader2 size={10} className="animate-spin" />}
          {a.label}
        </button>
      ))}
    </div>
  );
}

function InlineActionError({
  label,
  message,
  loading,
  onRetry,
  onDismiss,
}: {
  label: string;
  message: string;
  loading: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px]">
      <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-red-700">{label}失败</div>
        <div className="text-red-600/90 break-words">{message}</div>
      </div>
      <button
        onClick={onRetry}
        disabled={loading}
        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-1 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
        重试
      </button>
      <button
        onClick={onDismiss}
        className="shrink-0 p-1 text-red-400 hover:text-red-600 transition-colors"
        aria-label="关闭"
      >
        <X size={11} />
      </button>
    </div>
  );
}

export default function ContentCard({ item: itemProp, onAction }: ContentCardProps) {
  const { contents, setContents, setLearnings, addMessage } = useAppStore();
  // v2 memory learning — extracts preference rules from edit diffs
  const { learnFromEdit } = useMemoryV2();
  const memoryV2Enabled = useMemoryStore((s) => s.memoryEnabled);
  // Use live item from store if available, fall back to prop
  const item = contents.find(c => c.id === itemProp.id) || itemProp;
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editCta, setEditCta] = useState(item.cta || '');
  const [editTags, setEditTags] = useState<string[]>(item.tags || []);
  const [tagDraft, setTagDraft] = useState('');
  const [originalContent, setOriginalContent] = useState(item.content);
  const [toolbarPos, setToolbarPos] = useState<ToolbarPos | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [coverLoading, setCoverLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [titleLoading, setTitleLoading] = useState(false);
  type ActionKey = 'cover' | 'polish' | 'title';
  const [actionErrors, setActionErrors] = useState<Partial<Record<ActionKey, string>>>({});
  const setActionError = (key: ActionKey, msg: string | null) =>
    setActionErrors(prev => {
      const next = { ...prev };
      if (msg) next[key] = msg; else delete next[key];
      return next;
    });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enterEditMode = () => {
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditCta(item.cta || '');
    setEditTags(item.tags || []);
    setOriginalContent(item.content);
    setEditing(true);
    setExpanded(true);
  };

  const addTag = () => {
    const t = tagDraft.trim().replace(/^#+/, '');
    if (!t) return;
    if (editTags.includes(t)) {
      setTagDraft('');
      return;
    }
    if (editTags.length >= 10) {
      toast.error('最多 10 个标签');
      return;
    }
    setEditTags([...editTags, t]);
    setTagDraft('');
  };

  const removeTag = (t: string) => {
    setEditTags(editTags.filter(x => x !== t));
  };

  const handleUploadCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片不能超过 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const updated = contents.map(c =>
        c.id === item.id
          ? { ...c, coverImage: dataUrl, updatedAt: new Date().toISOString() }
          : c
      );
      setContents(updated);
      toast.success('封面已更新');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const previewText = item.content.split('\n').slice(0, 3).join('\n');

  // Detect text selection in textarea
  const handleSelect = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta || !cardRef.current) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) {
      setToolbarPos(null);
      setSelectedRange(null);
      return;
    }

    setSelectedRange({ start, end });

    const cardRect = cardRef.current.getBoundingClientRect();
    const taRect = ta.getBoundingClientRect();
    const textBefore = editContent.substring(0, start);
    const lines = textBefore.split('\n');
    const lineHeight = 22;
    const lineNum = lines.length - 1;

    const top = taRect.top - cardRect.top + lineNum * lineHeight - 8;
    const left = Math.min(taRect.width / 2, 200);

    setToolbarPos({ top, left });
  }, [editContent]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setToolbarPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAIAction = async (action: string) => {
    if (!selectedRange || !textareaRef.current) return;

    const selectedText = editContent.substring(selectedRange.start, selectedRange.end);
    if (!selectedText.trim()) return;

    setUndoStack(prev => [...prev, editContent]);
    setAiLoading(action);
    let result = '';

    await streamEdit({
      action,
      text: selectedText,
      fullContent: editContent,
      platform: item.platform,
      onDelta: (chunk) => { result += chunk; },
      onDone: () => {
        const before = editContent.substring(0, selectedRange.start);
        const after = editContent.substring(selectedRange.end);
        const newContent = before + result + after;
        setEditContent(newContent);
        setToolbarPos(null);
        setSelectedRange(null);
        setAiLoading(null);
        toast.success(`AI ${action === 'rewrite' ? '改写' : action === 'expand' ? '扩写' : '精简'}完成`);
      },
      onError: (err) => {
        toast.error(err);
        setAiLoading(null);
      },
    });
  };

  const handlePolish = async () => {
    const textToPolish = editing ? editContent : item.content;
    if (!textToPolish.trim()) return;

    setActionError('polish', null);
    setUndoStack(prev => [...prev, editing ? editContent : item.content]);
    setAiLoading('polish');
    if (!editing) {
      setEditing(true);
      setExpanded(true);
      setEditContent(textToPolish);
    }

    let result = '';
    await streamEdit({
      action: 'polish',
      text: textToPolish,
      platform: item.platform,
      onDelta: (chunk) => { result += chunk; },
      onDone: () => {
        if (!result.trim()) {
          setActionError('polish', 'AI 没有返回内容，请重试');
          setAiLoading(null);
          return;
        }
        setEditContent(result);
        setAiLoading(null);
        toast.success('AI 润色完成');
      },
      onError: (err) => {
        setActionError('polish', err || '润色失败');
        setAiLoading(null);
      },
    });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setEditContent(prev);
    toast.success('已撤销');
  };

  const handleGenerateCover = async () => {
    setActionError('cover', null);
    setCoverLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-cover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: editing ? editTitle : item.title,
          content: editing ? editContent : item.content,
          platform: item.platform,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: '生成失败' }));
        setActionError('cover', err.error || '配图生成失败，请重试');
        setCoverLoading(false);
        return;
      }

      const data = await resp.json();
      if (data.imageUrl) {
        const updated = contents.map(c =>
          c.id === item.id
            ? { ...c, coverImage: data.imageUrl, updatedAt: new Date().toISOString() }
            : c
        );
        setContents(updated);
        toast.success('配图生成成功！');
      } else {
        setActionError('cover', '未能生成配图，请重试');
      }
    } catch {
      setActionError('cover', '网络异常，配图生成失败');
    }
    setCoverLoading(false);
  };
  const handleRegenerateTitle = async () => {
    setActionError('title', null);
    setTitleLoading(true);
    try {
      const currentContent = editing ? editContent : item.content;
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `请根据以下文章内容，重新生成一个吸引人的标题。只返回标题文字，不要任何解释或引号：\n\n${currentContent.substring(0, 500)}` }],
          mode: 'chat',
          platform: item.platform,
        }),
      });

      if (!resp.ok) {
        setActionError('title', '标题生成失败，请重试');
        setTitleLoading(false);
        return;
      }

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let newTitle = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const json = JSON.parse(line.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) newTitle += delta;
              } catch {}
            }
          }
        }
      }

      newTitle = newTitle.trim().replace(/^["'""'']+|["'""'']+$/g, '');
      if (newTitle) {
        if (editing) {
          setEditTitle(newTitle);
        }
        const updated = contents.map(c =>
          c.id === item.id
            ? { ...c, title: newTitle, updatedAt: new Date().toISOString() }
            : c
        );
        setContents(updated);
        toast.success('标题已更新');
      } else {
        setActionError('title', '未能生成新标题，请重试');
      }
    } catch {
      setActionError('title', '网络异常，标题生成失败');
    }
    setTitleLoading(false);
  };

  const handleSave = () => {
    const updated = contents.map(c =>
      c.id === item.id
        ? {
            ...c,
            title: editTitle,
            content: editContent,
            cta: editCta,
            tags: editTags,
            updatedAt: new Date().toISOString(),
          }
        : c
    );
    setContents(updated);
    setEditing(false);
    setToolbarPos(null);
    toast.success('内容已保存');

    if (item.autoGenerated && editContent !== originalContent && editContent.length > 10) {
      const diff = Math.abs(editContent.length - originalContent.length);
      const ratio = diff / Math.max(originalContent.length, 1);
      if (ratio > 0.05 || editContent !== originalContent) {
        // v1 learning (legacy analyze-edit → learning_entries)
        learnFromEdits(originalContent, editContent);
        // v2 learning (learn-from-edit → memories.preference) — fire & forget
        if (memoryV2Enabled) {
          learnFromEdit(originalContent, editContent, item.title).then((rules) => {
            if (rules.length > 0) {
              addMessage({
                id: `memv2-learn-${Date.now()}`,
                role: 'assistant',
                content: `✨ 记忆 v2 从你的编辑中学到了：\n${rules
                  .map((r) => `• ${r.rule}`)
                  .join('\n')}\n\n前往「火花记忆 → 偏好规则」可以逐条确认后启用。`,
                timestamp: new Date().toISOString(),
              });
            }
          });
        }
      }
    }
    setOriginalContent(editContent);
  };

  const learnFromEdits = async (original: string, edited: string) => {
    try {
      // 调用新版 analyze-edit：服务端会做 diff 分析、生成 insight 并写入 learning_entries
      const { user, isAuthenticated } = useAuthStore.getState();
      const userId = isAuthenticated && user?.id ? user.id : null;

      const { data, error } = await supabase.functions.invoke('analyze-edit', {
        body: {
          original,
          edited,
          deviceId: 'default',
          userId,
        },
      });

      if (error || !data?.ok) return;

      const analysis = data.analysis as
        | { insights?: string[]; entries?: Array<{ insight: string; category?: string; confidence?: number }> }
        | undefined;

      // 兼容两种返回结构：insights 数组 或 entries 完整对象数组
      const insights: string[] = analysis?.entries?.map(e => e.insight).filter(Boolean) as string[]
        ?? analysis?.insights
        ?? [];

      if (insights.length === 0) return;

      // 同步前端 learning store（服务端已写库，这里只是为了立即在 UI 上反映）
      const newEntries: LearningEntry[] = insights.map((insight, i) => ({
        id: `learn-${Date.now()}-${i}`,
        type: 'edit' as const,
        category: 'edit',
        insight,
        evidence: `从「${item.title}」的编辑中学到`,
        confidence: 0.8,
        timestamp: new Date().toISOString(),
      }));

      const currentLearnings = useAppStore.getState().learnings;
      setLearnings([...currentLearnings, ...newEntries]);

      addMessage({
        id: `learn-${Date.now()}`,
        role: 'assistant',
        content: `📝 我从你的编辑中学到了：\n${insights.map(i => `• ${i}`).join('\n')}\n\n这些偏好会在后续创作中自动应用。`,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[learn-from-edit] failed:', err);
    }
  };

  const handleSubmitReview = async () => {
    setSubmitLoading(true);
    // 如果在编辑态，先把编辑内容合并进来
    const finalItem: ContentItem = {
      ...item,
      title: editing ? editTitle : item.title,
      content: editing ? editContent : item.content,
      cta: editing ? editCta : item.cta,
      tags: editing ? editTags : item.tags,
      status: 'reviewing',
      updatedAt: new Date().toISOString(),
    };
    const updated = contents.map(c => (c.id === item.id ? finalItem : c));
    setContents(updated);

    try {
      await saveReviewItem(finalItem, {
        source: 'manual',
        taskName: '手动提交审核',
        triggeredAt: new Date().toISOString(),
      });
      toast.success('已提交审核，请前往审核页查看');
      if (editing) {
        setEditing(false);
        setToolbarPos(null);
      }
    } catch {
      toast.error('提交审核失败，请重试');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="content-card relative" ref={cardRef}>
      {/* AI Toolbar */}
      {editing && toolbarPos && (
        <AIFloatingToolbar pos={toolbarPos} onAction={handleAIAction} loading={aiLoading} />
      )}

      {/* Cover Image */}
      {item.coverImage && (
        <div className="relative -mx-4 -mt-4 mb-3 rounded-t-xl overflow-hidden">
          <img
            src={item.coverImage}
            alt={item.title}
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 text-[11px] text-white/90 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1 hover:bg-black/60 transition-colors"
            >
              <ImageUp size={11} /> 上传
            </button>
            <button
              onClick={handleGenerateCover}
              disabled={coverLoading}
              className="flex items-center gap-1 text-[11px] text-white/90 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1 hover:bg-black/60 transition-colors disabled:opacity-50"
            >
              {coverLoading ? <Loader2 size={11} className="animate-spin" /> : <ImagePlus size={11} />}
              AI换图
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadCover}
        className="hidden"
      />

      {/* Title */}
      {editing ? (
        <div className="flex items-center gap-1.5 mb-2">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 text-[15px] font-semibold text-[#333] border border-[#E5E4E2] rounded-lg px-3 py-1.5 outline-none focus:border-spark-orange"
          />
          <button
            onClick={handleRegenerateTitle}
            disabled={titleLoading}
            className="shrink-0 p-1.5 rounded-lg text-[#999] hover:text-spark-orange hover:bg-spark-orange/10 transition-colors disabled:opacity-40"
            title="重新生成标题"
          >
            {titleLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mb-2 group">
          <h4 className="text-[15px] font-semibold text-[#333] flex-1">{item.title}</h4>
          <button
            onClick={handleRegenerateTitle}
            disabled={titleLoading}
            className="shrink-0 p-1 rounded-md text-[#CCC] hover:text-spark-orange hover:bg-spark-orange/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
            title="重新生成标题"
          >
            {titleLoading ? <Loader2 size={13} className="animate-spin text-spark-orange" /> : <RefreshCw size={13} />}
          </button>
        </div>
      )}

      {/* Content */}
      {editing ? (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onSelect={handleSelect}
            onMouseUp={handleSelect}
            className="w-full text-[14px] text-[#555] leading-[1.6] border border-[#E5E4E2] rounded-lg px-3 py-2 outline-none focus:border-spark-orange resize-none min-h-[160px]"
          />
          {aiLoading && (
            <div className="absolute inset-0 bg-white/60 rounded-lg flex items-center justify-center">
              <div className="flex items-center gap-2 text-[13px] text-spark-orange">
                <Loader2 size={16} className="animate-spin" />
                AI 处理中...
              </div>
            </div>
          )}
          <p className="text-[11px] text-[#CCC] mt-1">💡 选中文字后可使用 AI 改写、扩写或精简</p>
        </div>
      ) : (
        <div className="text-[14px] text-[#555] leading-[1.6] whitespace-pre-wrap">
          {expanded ? item.content : previewText}
          {!expanded && item.content.split('\n').length > 3 && '...'}
        </div>
      )}

      {/* CTA (edit mode) */}
      {editing && (
        <div className="mt-3">
          <label className="block text-[11px] text-[#999] mb-1">CTA（行动号召）</label>
          <input
            value={editCta}
            onChange={(e) => setEditCta(e.target.value)}
            placeholder="如：点击关注，下期更新…"
            className="w-full text-[13px] text-[#555] border border-[#E5E4E2] rounded-lg px-3 py-1.5 outline-none focus:border-spark-orange"
            maxLength={100}
          />
        </div>
      )}

      {/* Tags */}
      {editing ? (
        <div className="mt-3">
          <label className="block text-[11px] text-[#999] mb-1">标签</label>
          <div className="flex flex-wrap items-center gap-1.5 border border-[#E5E4E2] rounded-lg px-2 py-1.5 focus-within:border-spark-orange">
            {editTags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[11px] text-spark-orange bg-spark-orange/10 px-2 py-0.5 rounded-full"
              >
                #{tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:text-spark-orange/70"
                  aria-label={`删除 ${tag}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
                  e.preventDefault();
                  addTag();
                } else if (e.key === 'Backspace' && !tagDraft && editTags.length > 0) {
                  removeTag(editTags[editTags.length - 1]);
                }
              }}
              onBlur={() => tagDraft && addTag()}
              placeholder={editTags.length === 0 ? '输入标签，回车添加' : ''}
              className="flex-1 min-w-[100px] text-[12px] text-[#555] outline-none bg-transparent"
              maxLength={20}
            />
          </div>
        </div>
      ) : (
        item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {item.tags.map(tag => (
              <span key={tag} className="text-[11px] text-spark-orange bg-spark-orange/10 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )
      )}

      {/* Non-edit CTA preview */}
      {!editing && item.cta && (
        <p className="text-[12px] text-[#999] italic mt-2">👉 {item.cta}</p>
      )}

      {/* Inline action errors with retry */}
      {(actionErrors.cover || actionErrors.polish || actionErrors.title) && (
        <div className="mt-3 space-y-1.5">
          {actionErrors.cover && (
            <InlineActionError
              label="AI 配图"
              message={actionErrors.cover}
              loading={coverLoading}
              onRetry={handleGenerateCover}
              onDismiss={() => setActionError('cover', null)}
            />
          )}
          {actionErrors.polish && (
            <InlineActionError
              label="润色"
              message={actionErrors.polish}
              loading={aiLoading === 'polish'}
              onRetry={handlePolish}
              onDismiss={() => setActionError('polish', null)}
            />
          )}
          {actionErrors.title && (
            <InlineActionError
              label="生成标题"
              message={actionErrors.title}
              loading={titleLoading}
              onRetry={handleRegenerateTitle}
              onDismiss={() => setActionError('title', null)}
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#F0EFED] flex-wrap">
        {!editing ? (
          <>
            <button onClick={() => setExpanded(!expanded)} className="content-card-btn">
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? '收起' : '展开全文'}
            </button>
            <button onClick={enterEditMode} className="content-card-btn">
              <Pencil size={13} /> 编辑
            </button>
            <button onClick={handlePolish} disabled={!!aiLoading} className="content-card-btn text-spark-orange">
              {aiLoading === 'polish' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {aiLoading === 'polish' ? '润色中...' : '润色'}
            </button>
            <button
              onClick={handleGenerateCover}
              disabled={coverLoading}
              className="content-card-btn text-spark-orange"
            >
              {coverLoading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
              {coverLoading ? '生成中...' : 'AI配图'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="content-card-btn"
            >
              <ImageUp size={13} /> 上传封面
            </button>
            <button onClick={() => onAction?.('restyle', item)} className="content-card-btn">
              <Palette size={13} /> 换风格
            </button>
            <button
              onClick={handleSubmitReview}
              disabled={submitLoading}
              className="content-card-btn text-spark-orange"
            >
              {submitLoading ? <Loader2 size={13} className="animate-spin" /> : <ClipboardCheck size={13} />}
              {submitLoading ? '提交中...' : '提交审核'}
            </button>
            <button
              onClick={() => { toast.success('已存入草稿箱'); }}
              className="content-card-btn"
            >
              <BookmarkPlus size={13} /> 存稿
            </button>
          </>
        ) : (
          <>
            <button onClick={handleSave} className="content-card-btn text-spark-orange font-medium">保存</button>
            <button onClick={handlePolish} disabled={!!aiLoading} className="content-card-btn text-spark-orange">
              {aiLoading === 'polish' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {aiLoading === 'polish' ? '润色中...' : '润色'}
            </button>
            <button
              onClick={handleGenerateCover}
              disabled={coverLoading}
              className="content-card-btn text-spark-orange"
            >
              {coverLoading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
              {coverLoading ? '生成中...' : 'AI配图'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="content-card-btn"
            >
              <ImageUp size={13} /> 上传
            </button>
            {undoStack.length > 0 && (
              <button onClick={handleUndo} disabled={!!aiLoading} className="content-card-btn text-[#999]">
                <Undo2 size={13} /> 撤销
              </button>
            )}
            <button
              onClick={() => {
                setEditing(false);
                setToolbarPos(null);
                setUndoStack([]);
                setTagDraft('');
              }}
              className="content-card-btn"
            >
              取消
            </button>
          </>
        )}
      </div>
    </div>
  );
}
