import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, Pencil, Upload, RefreshCw, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { ContentItem } from '../types/spark';
import { toast } from 'sonner';
import { streamEdit } from '../lib/ai-stream';

interface ContentCardProps {
  item: ContentItem;
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

export default function ContentCard({ item }: ContentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [editTitle, setEditTitle] = useState(item.title);
  const [toolbarPos, setToolbarPos] = useState<ToolbarPos | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const { contents, setContents } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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

    // Position toolbar above selection
    // Use a rough approximation based on character position
    const cardRect = cardRef.current.getBoundingClientRect();
    const taRect = ta.getBoundingClientRect();

    // Create a temporary span to measure position
    const textBefore = editContent.substring(0, start);
    const lines = textBefore.split('\n');
    const lineHeight = 22; // approximate
    const lineNum = lines.length - 1;

    const top = taRect.top - cardRect.top + lineNum * lineHeight - 8;
    const left = Math.min(taRect.width / 2, 200);

    setToolbarPos({ top, left });
  }, [editContent]);

  // Hide toolbar on click outside
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

    setAiLoading(action);
    let result = '';

    await streamEdit({
      action,
      text: selectedText,
      fullContent: editContent,
      platform: item.platform,
      onDelta: (chunk) => { result += chunk; },
      onDone: () => {
        // Replace selected text with AI result
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

      {/* Title */}
      {editing ? (
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full text-[15px] font-semibold text-[#333] border border-[#E5E4E2] rounded-lg px-3 py-1.5 mb-2 outline-none focus:border-spark-orange"
        />
      ) : (
        <h4 className="text-[15px] font-semibold text-[#333] mb-2">{item.title}</h4>
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
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#F0EFED]">
        {!editing ? (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="content-card-btn"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? '收起' : '展开全文'}
            </button>
            <button
              onClick={() => { setEditing(true); setExpanded(true); }}
              className="content-card-btn"
            >
              <Pencil size={13} />
              编辑
            </button>
            <button
              onClick={handlePublish}
              className="content-card-btn text-spark-orange"
            >
              <Upload size={13} />
              发布
            </button>
          </>
        ) : (
          <>
            <button onClick={handleSave} className="content-card-btn text-spark-orange font-medium">
              保存
            </button>
            <button onClick={() => { setEditing(false); setToolbarPos(null); }} className="content-card-btn">
              取消
            </button>
          </>
        )}
      </div>
    </div>
  );
}
