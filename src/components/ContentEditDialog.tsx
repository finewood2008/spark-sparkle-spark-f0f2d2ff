import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Loader2, Sparkles, ImagePlus, ImageUp, RefreshCw, Undo2, History, Clock, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { ContentItem, ContentVersion } from '../types/spark';
import { streamEdit } from '../lib/ai-stream';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface ContentEditDialogProps {
  item: ContentItem;
  open: boolean;
  onClose: () => void;
}

export default function ContentEditDialog({ item: itemProp, open, onClose }: ContentEditDialogProps) {
  const { contents, setContents } = useAppStore();
  const item = contents.find(c => c.id === itemProp.id) || itemProp;

  const [editTitle, setEditTitle] = useState(item.title);
  const [editContent, setEditContent] = useState(item.content);
  const [editCta, setEditCta] = useState(item.cta || '');
  const [editTags, setEditTags] = useState<string[]>(item.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [titleLoading, setTitleLoading] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selRange, setSelRange] = useState<{ start: number; end: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync when item changes externally (e.g. cover image generated)
  useEffect(() => {
    if (!open) return;
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditCta(item.cta || '');
    setEditTags(item.tags || []);
  }, [item.title, item.content, item.cta, item.tags, open]);

  const handleSelect = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    if (s === e) { setSelRange(null); setSelectedText(''); return; }
    setSelRange({ start: s, end: e });
    setSelectedText(editContent.substring(s, e));
  }, [editContent]);

  if (!open) return null;

  const versions: ContentVersion[] = item.versions || [];

  const saveVersion = (label?: string) => {
    const ver: ContentVersion = {
      id: `v-${Date.now()}`,
      title: item.title,
      content: item.content,
      cta: item.cta,
      tags: item.tags,
      coverImage: item.coverImage,
      savedAt: new Date().toISOString(),
      label,
    };
    return ver;
  };

  const handleSave = () => {
    // Auto-save current as a version before updating
    const ver = saveVersion();
    const existingVersions = item.versions || [];
    const updated = contents.map(c =>
      c.id === item.id
        ? {
            ...c,
            title: editTitle,
            content: editContent,
            cta: editCta,
            tags: editTags,
            updatedAt: new Date().toISOString(),
            versions: [...existingVersions, ver].slice(-20), // keep last 20
          }
        : c
    );
    setContents(updated);
    toast.success('内容已保存');
    onClose();
  };

  const handleRestoreVersion = (ver: ContentVersion) => {
    setEditTitle(ver.title);
    setEditContent(ver.content);
    setEditCta(ver.cta || '');
    setEditTags(ver.tags || []);
    setShowVersions(false);
    toast.success('已恢复到该版本');
  };

  const handlePolish = async () => {
    if (!editContent.trim()) return;
    setUndoStack(prev => [...prev, editContent]);
    setAiLoading('polish');
    let result = '';
    await streamEdit({
      action: 'polish',
      text: editContent,
      platform: item.platform,
      onDelta: (chunk) => { result += chunk; },
      onDone: () => {
        setEditContent(result);
        setAiLoading(null);
        toast.success('AI 润色完成');
      },
      onError: (err) => { toast.error(err); setAiLoading(null); },
    });
  };

  const handleInlineEdit = async (action: string) => {
    if (!selRange) return;
    const sel = editContent.substring(selRange.start, selRange.end);
    if (!sel.trim()) return;
    setUndoStack(prev => [...prev, editContent]);
    setAiLoading(action);
    let result = '';
    await streamEdit({
      action,
      text: sel,
      fullContent: editContent,
      platform: item.platform,
      onDelta: (chunk) => { result += chunk; },
      onDone: () => {
        const before = editContent.substring(0, selRange.start);
        const after = editContent.substring(selRange.end);
        setEditContent(before + result + after);
        setSelRange(null);
        setSelectedText('');
        setAiLoading(null);
        toast.success('AI 编辑完成');
      },
      onError: (err) => { toast.error(err); setAiLoading(null); },
    });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    setEditContent(undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
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
          title: editTitle,
          content: editContent,
          platform: item.platform,
        }),
      });
      if (!resp.ok) { toast.error('配图生成失败'); setCoverLoading(false); return; }
      const data = await resp.json();
      if (data.imageUrl) {
        const updated = contents.map(c =>
          c.id === item.id ? { ...c, coverImage: data.imageUrl, updatedAt: new Date().toISOString() } : c
        );
        setContents(updated);
        toast.success('配图生成成功！');
      }
    } catch { toast.error('配图生成失败'); }
    setCoverLoading(false);
  };

  const handleRegenerateTitle = async () => {
    setTitleLoading(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `请根据以下文章内容，重新生成一个吸引人的标题。只返回标题文字：\n\n${editContent.substring(0, 500)}` }],
          mode: 'chat',
          platform: item.platform,
        }),
      });
      if (!resp.ok) { toast.error('标题生成失败'); setTitleLoading(false); return; }
      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let newTitle = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try { const j = JSON.parse(line.slice(6)); const d = j.choices?.[0]?.delta?.content; if (d) newTitle += d; } catch {}
            }
          }
        }
      }
      newTitle = newTitle.trim().replace(/^["'""'']+|["'""'']+$/g, '');
      if (newTitle) { setEditTitle(newTitle); toast.success('标题已更新'); }
    } catch { toast.error('标题生成失败'); }
    setTitleLoading(false);
  };

  const handleUploadCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('图片不能超过 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const updated = contents.map(c =>
        c.id === item.id ? { ...c, coverImage: reader.result as string, updatedAt: new Date().toISOString() } : c
      );
      setContents(updated);
      toast.success('封面已更新');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSelect = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    if (s === e) { setSelRange(null); setSelectedText(''); return; }
    setSelRange({ start: s, end: e });
    setSelectedText(editContent.substring(s, e));
  }, [editContent]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !editTags.includes(t)) setEditTags([...editTags, t]);
    setTagInput('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[90vw] max-w-[800px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFED]">
          <div className="flex items-center gap-3">
            <h2 className="text-[16px] font-semibold text-[#333]">编辑内容</h2>
            <span className="text-[11px] text-[#999] bg-[#F5F5F3] px-2 py-0.5 rounded-full">
              {item.platform === 'xiaohongshu' ? '小红书' : item.platform === 'wechat' ? '公众号' : '抖音'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="flex items-center gap-1.5 text-[13px] text-[#666] hover:text-spark-orange px-3 py-1.5 rounded-lg hover:bg-spark-orange/5 transition-colors"
            >
              <History size={14} />
              版本记录 {versions.length > 0 && <span className="text-[11px] text-spark-orange">({versions.length})</span>}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F5F3] text-[#999] hover:text-[#666] transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main editor */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Cover */}
            <div className="relative rounded-xl overflow-hidden bg-[#F9F9F7] border border-[#E5E4E2]">
              {item.coverImage ? (
                <img src={item.coverImage} alt="cover" className="w-full h-48 object-cover" />
              ) : (
                <div className="h-32 flex items-center justify-center text-[#CCC]">
                  <ImagePlus size={32} />
                </div>
              )}
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-[11px] bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm hover:bg-white transition-colors text-[#666]">
                  <ImageUp size={12} /> 上传
                </button>
                <button onClick={handleGenerateCover} disabled={coverLoading} className="flex items-center gap-1 text-[11px] bg-spark-orange text-white rounded-full px-3 py-1.5 shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                  {coverLoading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
                  AI配图
                </button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadCover} className="hidden" />

            {/* Title */}
            <div>
              <label className="text-[12px] font-medium text-[#999] mb-1.5 block">标题</label>
              <div className="flex items-center gap-2">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 text-[16px] font-semibold text-[#333] border border-[#E5E4E2] rounded-xl px-4 py-2.5 outline-none focus:border-spark-orange transition-colors"
                  placeholder="输入标题..."
                />
                <button onClick={handleRegenerateTitle} disabled={titleLoading} className="shrink-0 p-2.5 rounded-xl text-[#999] hover:text-spark-orange hover:bg-spark-orange/5 transition-colors disabled:opacity-40">
                  {titleLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </button>
              </div>
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] font-medium text-[#999]">正文</label>
                <div className="flex items-center gap-1">
                  {selectedText && (
                    <>
                      <button onClick={() => handleInlineEdit('rewrite')} disabled={!!aiLoading} className="text-[11px] px-2 py-1 rounded-md text-spark-orange hover:bg-spark-orange/5 disabled:opacity-40">改写</button>
                      <button onClick={() => handleInlineEdit('expand')} disabled={!!aiLoading} className="text-[11px] px-2 py-1 rounded-md text-spark-orange hover:bg-spark-orange/5 disabled:opacity-40">扩写</button>
                      <button onClick={() => handleInlineEdit('simplify')} disabled={!!aiLoading} className="text-[11px] px-2 py-1 rounded-md text-spark-orange hover:bg-spark-orange/5 disabled:opacity-40">精简</button>
                      <span className="w-px h-3 bg-[#E5E4E2] mx-1" />
                    </>
                  )}
                  <button onClick={handlePolish} disabled={!!aiLoading} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md text-spark-orange hover:bg-spark-orange/5 disabled:opacity-40">
                    {aiLoading === 'polish' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    润色全文
                  </button>
                  {undoStack.length > 0 && (
                    <button onClick={handleUndo} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md text-[#999] hover:bg-[#F5F5F3]">
                      <Undo2 size={11} /> 撤销
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onSelect={handleSelect}
                  onMouseUp={handleSelect}
                  className="w-full text-[14px] text-[#555] leading-[1.8] border border-[#E5E4E2] rounded-xl px-4 py-3 outline-none focus:border-spark-orange resize-none transition-colors"
                  style={{ minHeight: '280px' }}
                  placeholder="输入正文内容..."
                />
                {aiLoading && (
                  <div className="absolute inset-0 bg-white/60 rounded-xl flex items-center justify-center">
                    <div className="flex items-center gap-2 text-[13px] text-spark-orange">
                      <Loader2 size={16} className="animate-spin" /> AI 处理中...
                    </div>
                  </div>
                )}
              </div>
              {selectedText && <p className="text-[11px] text-spark-orange mt-1">已选中 {selectedText.length} 字，可使用上方 AI 编辑工具</p>}
            </div>

            {/* CTA */}
            <div>
              <label className="text-[12px] font-medium text-[#999] mb-1.5 block">行动号召 (CTA)</label>
              <input
                value={editCta}
                onChange={(e) => setEditCta(e.target.value)}
                className="w-full text-[14px] text-[#555] border border-[#E5E4E2] rounded-xl px-4 py-2.5 outline-none focus:border-spark-orange transition-colors"
                placeholder="如：点击链接了解更多"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-[12px] font-medium text-[#999] mb-1.5 block">标签</label>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 text-[14px] text-[#555] border border-[#E5E4E2] rounded-xl px-4 py-2 outline-none focus:border-spark-orange transition-colors"
                  placeholder="添加标签..."
                />
                <button onClick={addTag} className="px-4 py-2 rounded-xl bg-[#F5F5F3] text-[13px] text-[#666] hover:bg-[#EEEDEB] transition-colors">添加</button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {editTags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 bg-spark-orange/10 text-spark-orange text-[12px] px-2.5 py-0.5 rounded-full">
                    #{t}
                    <button onClick={() => setEditTags(editTags.filter(x => x !== t))} className="hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Version sidebar */}
          {showVersions && (
            <div className="w-[240px] border-l border-[#F0EFED] bg-[#FAFAF8] overflow-y-auto">
              <div className="p-4">
                <h3 className="text-[13px] font-semibold text-[#333] mb-3 flex items-center gap-1.5">
                  <History size={14} /> 版本记录
                </h3>
                {versions.length === 0 ? (
                  <p className="text-[12px] text-[#999]">保存后将自动生成版本记录</p>
                ) : (
                  <div className="space-y-2">
                    {[...versions].reverse().map((ver, i) => (
                      <button
                        key={ver.id}
                        onClick={() => handleRestoreVersion(ver)}
                        className="w-full text-left p-3 rounded-lg bg-white border border-[#E5E4E2] hover:border-spark-orange/40 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-medium text-[#333]">
                            {ver.label || `版本 ${versions.length - i}`}
                          </span>
                          <ChevronRight size={12} className="text-[#CCC] group-hover:text-spark-orange transition-colors" />
                        </div>
                        <p className="text-[11px] text-[#999] mt-1 truncate">{ver.title}</p>
                        <div className="flex items-center gap-1 text-[10px] text-[#BBB] mt-1">
                          <Clock size={10} />
                          {new Date(ver.savedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#F0EFED] flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-[13px] text-[#666] hover:bg-[#F5F5F3] transition-colors">取消</button>
          <button onClick={handleSave} className="px-6 py-2 rounded-xl bg-spark-orange text-white text-[13px] font-medium hover:opacity-90 transition-opacity">保存</button>
        </div>
      </div>
    </div>
  );
}
