import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, Pencil, ClipboardCheck, Sparkles, Loader2, Undo2, Palette, BookmarkPlus, ImagePlus, ImageUp, RefreshCw, X, AlertCircle, RotateCcw, Lightbulb, Copy, Check, Images } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { ContentItem } from '../types/spark';
import { toast } from 'sonner';
import { streamEdit } from '../lib/ai-stream';
import { saveReviewItem } from '../lib/review-persistence';
import { getAuthToken } from '@/lib/auth-helpers';
import { useMemoryV2 } from '@/hooks/useMemoryV2';
import { useMemoryStore } from '@/store/memoryStore';
import { SUPABASE_URL } from '@/lib/env';
import { useIllustrate } from '@/hooks/useIllustrate';

interface ContentCardProps {
  item: ContentItem;
  onAction?: (action: string, item: ContentItem) => void;
}

interface ToolbarPos {
  top: number;
  left: number;
}

/**
 * 把含 ![alt](url) markdown + 流式占位符的正文渲染成 React 节点。
 * 占位符格式：[[SPARK_ILLUSTRATING:第 N/总 张]]  → 渲染成加载卡
 * 失败提示行：> ⚠️ 第 N 张配图失败 → 渲染成警告条
 *
 * imageActions: 当传入时，每张图右上角显示 ✕（删除）和 🔄（重新生成）按钮。
 */
function renderContentWithImages(
  text: string,
  imageActions?: {
    onDelete: (url: string, alt: string) => void;
    onRegenerate: (url: string, alt: string) => void;
    regeneratingUrls: Set<string>;
  },
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // 同时匹配图片、加载占位、失败提示
  const re = /(!\[([^\]]*)\]\(([^)]+)\))|(\[\[SPARK_ILLUSTRATING:([^\]]+)\]\])|(^> ⚠️ [^\n]+$)/gm;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <span key={`t-${key++}`} className="whitespace-pre-wrap">
          {text.substring(lastIndex, match.index)}
        </span>,
      );
    }
    if (match[1]) {
      // markdown 图片
      const alt = match[2];
      const url = match[3];
      const isRegenerating = imageActions?.regeneratingUrls.has(url) ?? false;
      nodes.push(
        <figure
          key={`i-${key++}`}
          className="my-3 rounded-lg overflow-hidden border border-[#EDECE8] relative group/img"
        >
          <img src={url} alt={alt} className="w-full h-auto block" loading="lazy" />
          {isRegenerating && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <div className="flex items-center gap-2 text-[12px] text-spark-orange">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-spark-orange/30 border-t-spark-orange animate-spin" />
                重新生成中...
              </div>
            </div>
          )}
          {imageActions && !isRegenerating && (
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); imageActions.onRegenerate(url, alt); }}
                className="w-7 h-7 rounded-full bg-black/60 hover:bg-spark-orange text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                title="重新生成这张图"
                aria-label="重新生成这张图"
              >
                <RefreshCw size={13} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); imageActions.onDelete(url, alt); }}
                className="w-7 h-7 rounded-full bg-black/60 hover:bg-red-500 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                title="删除这张图"
                aria-label="删除这张图"
              >
                <X size={13} />
              </button>
            </div>
          )}
          {alt && <figcaption className="text-[11px] text-[#999] px-2 py-1 bg-[#FAFAF8]">{alt}</figcaption>}
        </figure>,
      );
    } else if (match[4]) {
      // 加载占位
      const label = match[5];
      nodes.push(
        <div
          key={`p-${key++}`}
          className="my-3 rounded-lg border border-spark-orange/30 bg-spark-orange/5 px-3 py-3 flex items-center gap-2"
        >
          <span className="inline-block animate-pulse text-base">🎨</span>
          <span className="text-[12px] text-spark-orange font-medium">正在配{label}插图...</span>
          <span className="ml-auto inline-block w-3 h-3 rounded-full border-2 border-spark-orange/30 border-t-spark-orange animate-spin" />
        </div>,
      );
    } else if (match[6]) {
      // 失败提示行
      const msg = match[6].replace(/^> /, '');
      nodes.push(
        <div
          key={`f-${key++}`}
          className="my-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600"
        >
          {msg}
        </div>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(
      <span key={`t-${key++}`} className="whitespace-pre-wrap">
        {text.substring(lastIndex)}
      </span>,
    );
  }
  return nodes;
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

/**
 * 编辑态正文：把 markdown 按"图片块"切分。
 * - 文字段：可编辑的 textarea（自动撑高），共享同一个 ref（最后一段）以兼容 AI 工具栏选区。
 * - 图片段：直接渲染图片缩略图 + 删除/重生按钮，不再以 `![](...)` 文本形式暴露给用户。
 * value 仍是完整的 markdown 字符串，onChange 只把"文字段"的修改回写到对应位置，
 * 保证图片 markdown 永远不会被用户误改成乱码。
 */
function EditableArticleBody({
  value,
  onChange,
  textareaRef,
  onSelect,
  imageActions,
}: {
  value: string;
  onChange: (next: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSelect: () => void;
  imageActions: {
    onDelete: (url: string, alt: string) => void;
    onRegenerate: (url: string, alt: string) => void;
    regeneratingUrls: Set<string>;
  };
}) {
  // 切分：把图片 / 占位 / 失败提示作为"块",其余作为可编辑文字段。
  type Seg =
    | { kind: 'text'; text: string; start: number; end: number }
    | { kind: 'image'; alt: string; url: string; raw: string }
    | { kind: 'placeholder'; label: string; raw: string }
    | { kind: 'failure'; msg: string; raw: string };
  const segs: Seg[] = [];
  const re = /(!\[([^\]]*)\]\(([^)]+)\))|(\[\[SPARK_ILLUSTRATING:([^\]]+)\]\])|(^> ⚠️ [^\n]+$)/gm;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    if (m.index > lastIndex) {
      segs.push({ kind: 'text', text: value.substring(lastIndex, m.index), start: lastIndex, end: m.index });
    }
    if (m[1]) segs.push({ kind: 'image', alt: m[2], url: m[3], raw: m[1] });
    else if (m[4]) segs.push({ kind: 'placeholder', label: m[5], raw: m[4] });
    else if (m[6]) segs.push({ kind: 'failure', msg: m[6].replace(/^> /, ''), raw: m[6] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < value.length) {
    segs.push({ kind: 'text', text: value.substring(lastIndex), start: lastIndex, end: value.length });
  }
  if (segs.length === 0) {
    segs.push({ kind: 'text', text: '', start: 0, end: 0 });
  }

  // 把"文字段索引"映射到原始 value 区间，便于回写
  const textSegs = segs.filter((s): s is Extract<Seg, { kind: 'text' }> => s.kind === 'text');
  const lastTextSegIdx = textSegs.length - 1;

  const updateTextSeg = (segIdx: number, nextText: string) => {
    const seg = segs[segIdx];
    if (seg.kind !== 'text') return;
    const before = value.substring(0, seg.start);
    const after = value.substring(seg.end);
    onChange(before + nextText + after);
  };

  let textCounter = 0;
  return (
    <div className="space-y-2 border border-[#E5E4E2] rounded-lg p-2 focus-within:border-spark-orange">
      {segs.map((seg, i) => {
        if (seg.kind === 'text') {
          const isLast = textCounter === lastTextSegIdx;
          textCounter += 1;
          return (
            <textarea
              key={`t-${i}`}
              ref={isLast ? textareaRef : undefined}
              value={seg.text}
              onChange={(e) => {
                const ta = e.target;
                updateTextSeg(i, ta.value);
                ta.style.height = 'auto';
                ta.style.height = `${ta.scrollHeight}px`;
              }}
              onSelect={isLast ? onSelect : undefined}
              onMouseUp={isLast ? onSelect : undefined}
              onInput={(e) => {
                const ta = e.currentTarget;
                ta.style.height = 'auto';
                ta.style.height = `${ta.scrollHeight}px`;
              }}
              rows={Math.max(1, seg.text.split('\n').length)}
              className="w-full text-[14px] text-[#555] leading-[1.6] outline-none resize-none bg-transparent px-1 py-0.5"
              placeholder={isLast && segs.length === 1 ? '在这里写内容…' : ''}
            />
          );
        }
        if (seg.kind === 'image') {
          const isRegenerating = imageActions.regeneratingUrls.has(seg.url);
          return (
            <figure
              key={`i-${i}`}
              className="my-1 rounded-lg overflow-hidden border border-[#EDECE8] relative group/img"
            >
              <img src={seg.url} alt={seg.alt} className="w-full h-auto block" loading="lazy" />
              {isRegenerating && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-[12px] text-spark-orange">
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-spark-orange/30 border-t-spark-orange animate-spin" />
                    重新生成中...
                  </div>
                </div>
              )}
              {!isRegenerating && (
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); imageActions.onRegenerate(seg.url, seg.alt); }}
                    className="w-7 h-7 rounded-full bg-black/60 hover:bg-spark-orange text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                    title="重新生成这张图"
                    aria-label="重新生成这张图"
                  >
                    <RefreshCw size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); imageActions.onDelete(seg.url, seg.alt); }}
                    className="w-7 h-7 rounded-full bg-black/60 hover:bg-red-500 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                    title="删除这张图"
                    aria-label="删除这张图"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              {seg.alt && <figcaption className="text-[11px] text-[#999] px-2 py-1 bg-[#FAFAF8]">{seg.alt}</figcaption>}
            </figure>
          );
        }
        if (seg.kind === 'placeholder') {
          return (
            <div
              key={`p-${i}`}
              className="my-1 rounded-lg border border-spark-orange/30 bg-spark-orange/5 px-3 py-3 flex items-center gap-2"
            >
              <span className="inline-block animate-pulse text-base">🎨</span>
              <span className="text-[12px] text-spark-orange font-medium">正在配{seg.label}插图...</span>
              <span className="ml-auto inline-block w-3 h-3 rounded-full border-2 border-spark-orange/30 border-t-spark-orange animate-spin" />
            </div>
          );
        }
        return (
          <div
            key={`f-${i}`}
            className="my-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600"
          >
            {seg.msg}
          </div>
        );
      })}
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

/**
 * 通用下拉菜单按钮 — 点外关闭、Esc 关闭。
 * 用于"AI 改写"、"封面图"等多操作合并入口。
 */
function MenuButton({
  trigger,
  items,
  align = 'left',
}: {
  trigger: React.ReactNode;
  items: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    hint?: string;
    danger?: boolean;
  }>;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="content-card-btn"
      >
        {trigger}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`absolute z-40 top-full mt-1 min-w-[160px] rounded-lg border border-[#E5E4E2] bg-white shadow-lg py-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map(it => (
            <button
              key={it.id}
              onClick={() => { if (!it.disabled && !it.loading) { it.onClick(); setOpen(false); } }}
              disabled={it.disabled || it.loading}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left transition-colors disabled:opacity-40 ${
                it.danger ? 'text-red-600 hover:bg-red-50' : 'text-[#555] hover:bg-spark-orange/8 hover:text-spark-orange'
              }`}
            >
              {it.loading ? <Loader2 size={12} className="animate-spin" /> : it.icon}
              <span className="flex-1">{it.label}</span>
              {it.hint && <span className="text-[10px] text-[#BBB]">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContentCard({ item: itemProp, onAction }: ContentCardProps) {
  const { contents, setContents, addMessage } = useAppStore();
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
  // 全文配图相关状态由 useIllustrate hook 管理（在下方初始化，避免引用循环）
  const [copied, setCopied] = useState(false);
  const [dialogueOpen, setDialogueOpen] = useState(false);
  type ActionKey = 'cover' | 'polish' | 'title' | 'illustrate';
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
  // 全文配图状态由 useIllustrate 提供（imagePromptsRef / regeneratingUrls 都在 hook 内部）

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
      const authToken = await getAuthToken();
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
      const authToken = await getAuthToken();
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

  /**
   * 全文配图、删单图、重生单图全部由 useIllustrate 提供。
   * Hook 内部维护 illustrateLoading / illustrateProgress / regeneratingUrls / imagePrompts。
   */
  const {
    illustrateLoading,
    illustrateProgress,
    regeneratingUrls,
    handleIllustrate,
    handleDeleteImage,
    handleRegenerateImage,
  } = useIllustrate({
    item,
    editing,
    editContent,
    editTitle,
    setEditContent,
    setEditing,
    setExpanded,
    setUndoStack,
    setActionError,
    contents,
    setContents,
  });

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
        // 自动学习：v2 learn-from-edit → memories.preference (fire & forget)
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

  /**
   * Copy the full article (title + body + CTA + tags) to clipboard in a
   * shareable plain-text format. Uses navigator.clipboard with a textarea
   * fallback for older browsers / non-secure contexts.
   */
  const handleCopyAll = async () => {
    const title = editing ? editTitle : item.title;
    const body = editing ? editContent : item.content;
    const cta = editing ? editCta : (item.cta || '');
    const tags = editing ? editTags : (item.tags || []);

    const parts: string[] = [];
    if (title) parts.push(title);
    if (body) parts.push(body);
    if (cta) parts.push(cta);
    if (tags.length > 0) parts.push(tags.map(t => `#${t}`).join(' '));
    const text = parts.join('\n\n');

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success('已复制全文到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败，请手动选择文字复制');
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

      {/* Reasoning — AI's creative choices, shown by default for that "smart" feel */}
      {!editing && item.reasoning && item.reasoning.length > 0 && (
        <div className="mb-3 rounded-lg border border-spark-orange/20 bg-spark-orange/5 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb size={13} className="text-spark-orange" />
            <span className="text-[12px] font-medium text-spark-orange">我的创作思路</span>
          </div>
          <ul className="space-y-1">
            {item.reasoning.map((r, i) => (
              <li key={i} className="text-[12px] leading-[1.55] text-[#666] pl-3 relative">
                <span className="absolute left-0 top-0 text-spark-orange/60">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pre-creation dialogue transcript — collapsible "我们一起聊了 N 轮" */}
      {!editing && item.dialogueHistory && item.dialogueHistory.length > 0 && (
        <div className="mb-3 rounded-lg border border-[#E5E4E2] bg-[#FAFAF8] overflow-hidden">
          <button
            onClick={() => setDialogueOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#F2F1ED] transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[12px]">💬</span>
              <span className="text-[12px] font-medium text-[#666]">
                我们一起聊了 {item.dialogueTurns ?? Math.ceil(item.dialogueHistory.length / 2)} 轮
              </span>
              <span className="text-[11px] text-[#BBB]">· 创作前的对齐过程</span>
            </div>
            {dialogueOpen ? (
              <ChevronUp size={14} className="text-[#999]" />
            ) : (
              <ChevronDown size={14} className="text-[#999]" />
            )}
          </button>
          {dialogueOpen && (
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-[#EDECE8]">
              {item.dialogueHistory.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'assistant' && (
                    <div className="shrink-0 w-5 h-5 rounded-full bg-spark-orange/15 flex items-center justify-center text-[10px]">
                      ✨
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] text-[12px] leading-[1.55] rounded-lg px-2.5 py-1.5 whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-spark-orange/10 text-[#555]'
                        : 'bg-white border border-[#EDECE8] text-[#666]'
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.role === 'user' && (
                    <div className="shrink-0 w-5 h-5 rounded-full bg-[#E5E4E2] flex items-center justify-center text-[10px] text-[#999]">
                      你
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
          <button
            onClick={handleCopyAll}
            className="shrink-0 p-1.5 rounded-lg text-[#999] hover:text-spark-orange hover:bg-spark-orange/10 transition-colors"
            title="复制全文（标题 + 正文 + CTA + 标签）"
            aria-label="复制全文"
          >
            {copied ? <Check size={14} className="text-spark-orange" /> : <Copy size={14} />}
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
          <button
            onClick={handleCopyAll}
            className={`shrink-0 p-1 rounded-md hover:text-spark-orange hover:bg-spark-orange/10 transition-colors ${
              copied ? 'opacity-100 text-spark-orange' : 'opacity-0 group-hover:opacity-100 text-[#CCC]'
            }`}
            title="复制全文（标题 + 正文 + CTA + 标签）"
            aria-label="复制全文"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      )}

      {/* Content */}
      {editing ? (
        <div className="relative">
          <EditableArticleBody
            value={editContent}
            onChange={setEditContent}
            textareaRef={textareaRef}
            onSelect={handleSelect}
            imageActions={{
              onDelete: handleDeleteImage,
              onRegenerate: handleRegenerateImage,
              regeneratingUrls,
            }}
          />
          {aiLoading && (
            <div className="absolute inset-0 bg-white/60 rounded-lg flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 text-[13px] text-spark-orange">
                <Loader2 size={16} className="animate-spin" />
                AI 处理中...
              </div>
            </div>
          )}
          <p className="text-[11px] text-[#CCC] mt-1">💡 选中文字后可使用 AI 改写、扩写或精简</p>
        </div>
      ) : (
        <div className="text-[14px] text-[#555] leading-[1.6]">
          {renderContentWithImages(expanded ? item.content : previewText, expanded ? {
            onDelete: handleDeleteImage,
            onRegenerate: handleRegenerateImage,
            regeneratingUrls,
          } : undefined)}
          {!expanded && item.content.split('\n').length > 3 && (
            <span className="text-[#999]">...</span>
          )}
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
      {(actionErrors.cover || actionErrors.polish || actionErrors.title || actionErrors.illustrate) && (
        <div className="mt-3 space-y-1.5">
          {actionErrors.cover && (
            <InlineActionError
              label="封面图"
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
          {actionErrors.illustrate && (
            <InlineActionError
              label="全文配图"
              message={actionErrors.illustrate}
              loading={illustrateLoading}
              onRetry={handleIllustrate}
              onDismiss={() => setActionError('illustrate', null)}
            />
          )}
        </div>
      )}

      {/* Actions — 分三组：📝 内容编辑 | 🎨 图片 | ✅ 流程（右靠） */}
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-[#F0EFED] flex-wrap">
        {!editing ? (
          <>
            {/* —— 组 1：内容编辑 —— */}
            <button onClick={() => setExpanded(!expanded)} className="content-card-btn">
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? '收起' : '展开'}
            </button>
            <button onClick={enterEditMode} className="content-card-btn">
              <Pencil size={13} /> 编辑
            </button>
            <MenuButton
              trigger={
                <>
                  {aiLoading === 'polish' ? <Loader2 size={13} className="animate-spin text-spark-orange" /> : <Sparkles size={13} className="text-spark-orange" />}
                  <span className="text-spark-orange">AI 改写</span>
                </>
              }
              items={[
                { id: 'polish', label: '润色（保留原意）', icon: <Sparkles size={12} />, hint: '微调用词', onClick: handlePolish, loading: aiLoading === 'polish' },
                { id: 'restyle', label: '换风格（活泼/专业/极简）', icon: <Palette size={12} />, hint: '换调性', onClick: () => onAction?.('restyle', item) },
                { id: 'expand', label: '扩写全文', icon: <ChevronDown size={12} />, hint: '更详细', onClick: () => onAction?.('expand', item) },
                { id: 'simplify', label: '精简全文', icon: <ChevronUp size={12} />, hint: '更简洁', onClick: () => onAction?.('simplify', item) },
              ]}
            />

            {/* 分组分隔符 */}
            <span className="w-px h-4 bg-[#E5E4E2] mx-1" aria-hidden />

            {/* —— 组 2：图片 —— */}
            <MenuButton
              trigger={
                <>
                  {coverLoading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                  <span>封面图</span>
                </>
              }
              items={[
                { id: 'gen', label: 'AI 生成封面', icon: <Sparkles size={12} />, onClick: handleGenerateCover, loading: coverLoading },
                { id: 'upload', label: '上传封面', icon: <ImageUp size={12} />, onClick: () => fileInputRef.current?.click() },
              ]}
            />
            <button
              onClick={handleIllustrate}
              disabled={illustrateLoading}
              className="content-card-btn text-spark-orange"
              title="AI 分析全文，在合适段落自动插图"
            >
              {illustrateLoading ? <Loader2 size={13} className="animate-spin" /> : <Images size={13} />}
              {illustrateLoading
                ? (illustrateProgress.total > 0
                    ? `配图中 ${illustrateProgress.done}/${illustrateProgress.total} ✨`
                    : '规划配图位置...')
                : '全文配图'}
            </button>

            {/* 流程组：右靠 */}
            <span className="ml-auto" aria-hidden />
            <button
              onClick={() => { toast.success('已存入草稿箱'); }}
              className="content-card-btn"
            >
              <BookmarkPlus size={13} /> 存稿
            </button>
            <button
              onClick={handleSubmitReview}
              disabled={submitLoading}
              className="content-card-btn bg-spark-orange text-white hover:bg-spark-orange/90 border-transparent"
            >
              {submitLoading ? <Loader2 size={13} className="animate-spin" /> : <ClipboardCheck size={13} />}
              {submitLoading ? '提交中...' : '提交审核'}
            </button>
          </>
        ) : (
          <>
            {/* —— 编辑态：保存 + AI 改写 + 图片 + 撤销/取消 —— */}
            <button onClick={handleSave} className="content-card-btn bg-spark-orange text-white hover:bg-spark-orange/90 border-transparent font-medium">
              保存
            </button>
            <MenuButton
              trigger={
                <>
                  {aiLoading === 'polish' ? <Loader2 size={13} className="animate-spin text-spark-orange" /> : <Sparkles size={13} className="text-spark-orange" />}
                  <span className="text-spark-orange">AI 改写</span>
                </>
              }
              items={[
                { id: 'polish', label: '润色（保留原意）', icon: <Sparkles size={12} />, onClick: handlePolish, loading: aiLoading === 'polish' },
                { id: 'restyle', label: '换风格', icon: <Palette size={12} />, onClick: () => onAction?.('restyle', item) },
              ]}
            />

            <span className="w-px h-4 bg-[#E5E4E2] mx-1" aria-hidden />

            <MenuButton
              trigger={
                <>
                  {coverLoading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                  <span>封面图</span>
                </>
              }
              items={[
                { id: 'gen', label: 'AI 生成封面', icon: <Sparkles size={12} />, onClick: handleGenerateCover, loading: coverLoading },
                { id: 'upload', label: '上传封面', icon: <ImageUp size={12} />, onClick: () => fileInputRef.current?.click() },
              ]}
            />
            <button
              onClick={handleIllustrate}
              disabled={illustrateLoading}
              className="content-card-btn text-spark-orange"
            >
              {illustrateLoading ? <Loader2 size={13} className="animate-spin" /> : <Images size={13} />}
              {illustrateLoading
                ? (illustrateProgress.total > 0
                    ? `配图中 ${illustrateProgress.done}/${illustrateProgress.total} ✨`
                    : '规划配图位置...')
                : '全文配图'}
            </button>

            <span className="ml-auto" aria-hidden />
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
