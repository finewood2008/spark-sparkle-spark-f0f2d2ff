import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, Pencil, ClipboardCheck, Sparkles, Loader2, Undo2, Palette, BookmarkPlus, ImagePlus, ImageUp, RefreshCw, X, Plus } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { ContentItem, LearningEntry } from '../types/spark';
import { toast } from 'sonner';
import { streamEdit } from '../lib/ai-stream';
import { saveReviewItem } from '../lib/review-persistence';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

export default function ContentCard({ item: itemProp, onAction }: ContentCardProps) {
  const { contents, setContents, setLearnings, addMessage } = useAppStore();
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
        setEditContent(result);
        setAiLoading(null);
        toast.success('AI 润色完成');
      },
      onError: (err) => {
        toast.error(err);
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
    setCoverLoading(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-cover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          title: editing ? editTitle : item.title,
          content: editing ? editContent : item.content,
          platform: item.platform,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: '生成失败' }));
        toast.error(err.error || '配图生成失败');
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
        toast.error('未能生成配图，请重试');
      }
    } catch {
      toast.error('配图生成失败');
    }
    setCoverLoading(false);
  };
  const handleRegenerateTitle = async () => {
    setTitleLoading(true);
    try {
      const currentContent = editing ? editContent : item.content;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `请根据以下文章内容，重新生成一个吸引人的标题。只返回标题文字，不要任何解释或引号：\n\n${currentContent.substring(0, 500)}` }],
          mode: 'chat',
          platform: item.platform,
        }),
      });

      if (!resp.ok) {
        toast.error('标题生成失败');
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
        toast.error('未能生成新标题');
      }
    } catch {
      toast.error('标题生成失败');
    }
    setTitleLoading(false);
  };

  const handleSave = () => {
    const updated = contents.map(c =>
      c.id === item.id
        ? { ...c, title: editTitle, content: editContent, updatedAt: new Date().toISOString() }
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
        learnFromEdits(originalContent, editContent);
      }
    }
    setOriginalContent(editContent);
  };

  const learnFromEdits = async (original: string, edited: string) => {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          action: 'learn_from_edit',
          text: original,
          fullContent: edited,
          platform: item.platform,
        }),
      });

      if (!resp.ok) return;
      const data = await resp.json();
      let raw = data.raw || '{}';
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }
      const parsed = JSON.parse(raw);
      const insights: string[] = parsed.insights || [];

      if (insights.length > 0) {
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
      }
    } catch {
      // Silent fail
    }
  };

  const handlePublish = () => {
    const updated = contents.map(c =>
      c.id === item.id
        ? { ...c, status: 'published' as const, publishedAt: new Date().toISOString() }
        : c
    );
    setContents(updated);
    toast.success('内容已发布！');
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

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {item.tags.map(tag => (
            <span key={tag} className="text-[11px] text-spark-orange bg-spark-orange/10 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
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
            <button onClick={() => setEditDialogOpen(true)} className="content-card-btn">
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
              onClick={() => onAction ? onAction('distribute', item) : handlePublish()}
              className="content-card-btn text-spark-orange"
            >
              <Upload size={13} /> 发布
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
            <button onClick={() => { setEditing(false); setToolbarPos(null); setUndoStack([]); }} className="content-card-btn">取消</button>
          </>
        )}
      </div>

      {/* Edit Dialog */}
      <ContentEditDialog
        item={item}
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
      />
    </div>
  );
}
