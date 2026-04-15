import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { ContentItem, Platform } from '../types/spark';
import { Image as ImageIcon, Smartphone, Monitor, RefreshCw, Sparkles, Plus, Bot, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface DraftData {
  id: string;
  coverImage?: string;
  title: string;
  body: string;
  cta: string;
  platform: Platform;
  tags: string[];
}

function PlatformPreview({ draft, platform }: { draft: DraftData; platform: string }) {
  if (platform === 'xiaohongshu') {
    return (
      <div className="bg-spark-surface rounded-xl border border-spark-gray-200 overflow-hidden max-w-[320px]">
        <div className="aspect-[4/5] bg-spark-gray-100 flex items-center justify-center">
          {draft.coverImage
            ? <img src={draft.coverImage} alt="cover" className="w-full h-full object-cover" />
            : <ImageIcon size={32} className="text-spark-gray-300" />
          }
        </div>
        <div className="p-3 space-y-2">
          <h3 className="font-semibold text-sm text-spark-gray-800">{draft.title || '标题'}</h3>
          <p className="text-xs text-spark-gray-500 line-clamp-3">{draft.body || '正文内容...'}</p>
          {draft.cta && (
            <div className="bg-spark-warm text-spark-orange text-xs font-medium px-3 py-1.5 rounded-full text-center">
              {draft.cta}
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {draft.tags.map(t => <span key={t} className="text-[10px] text-spark-orange">#{t}</span>)}
          </div>
        </div>
      </div>
    );
  }
  if (platform === 'wechat') {
    return (
      <div className="bg-spark-surface rounded-xl border border-spark-gray-200 overflow-hidden max-w-[320px]">
        <div className="p-4 border-b border-spark-gray-100">
          <h3 className="font-bold text-base text-spark-gray-800">{draft.title || '文章标题'}</h3>
          <p className="text-xs text-spark-gray-400 mt-1">火花品牌</p>
        </div>
        {draft.coverImage && (
          <div className="px-4 pt-3">
            <img src={draft.coverImage} alt="cover" className="w-full rounded-lg" />
          </div>
        )}
        <div className="p-4">
          <p className="text-sm text-spark-gray-600 leading-relaxed">{draft.body || '正文内容...'}</p>
          {draft.cta && (
            <div className="mt-3 text-center text-sm text-spark-orange font-medium">{draft.cta}</div>
          )}
        </div>
      </div>
    );
  }
  // douyin
  return (
    <div className="bg-spark-gray-800 rounded-xl overflow-hidden max-w-[280px] text-primary-foreground">
      <div className="aspect-[9/16] bg-spark-gray-700 flex items-center justify-center relative">
        {draft.coverImage
          ? <img src={draft.coverImage} alt="cover" className="w-full h-full object-cover" />
          : <ImageIcon size={32} className="text-spark-gray-500" />
        }
        <div className="absolute bottom-4 left-4 right-12">
          <h3 className="font-bold text-sm">{draft.title || '视频标题'}</h3>
          {draft.cta && <p className="text-xs mt-1 text-spark-orange">{draft.cta}</p>}
          <div className="flex flex-wrap gap-1 mt-1">
            {draft.tags.map(t => <span key={t} className="text-[10px] text-spark-gray-300">#{t}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudioPage() {
  const { contents, setContents, selectedContentId, setSelectedContentId } = useAppStore();
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [tagInput, setTagInput] = useState('');

  const selectedContent = contents.find(c => c.id === selectedContentId);

  const draft: DraftData = selectedContent ? {
    id: selectedContent.id,
    coverImage: selectedContent.coverImage,
    title: selectedContent.title,
    body: selectedContent.content,
    cta: selectedContent.cta || '',
    platform: selectedContent.platform,
    tags: selectedContent.tags || [],
  } : {
    id: '',
    title: '',
    body: '',
    cta: '',
    platform: 'xiaohongshu',
    tags: [],
  };

  const updateDraft = (updates: Partial<DraftData>) => {
    if (!selectedContent) return;
    const updated: ContentItem = {
      ...selectedContent,
      title: updates.title ?? selectedContent.title,
      content: updates.body ?? selectedContent.content,
      cta: updates.cta ?? selectedContent.cta,
      platform: updates.platform ?? selectedContent.platform,
      tags: updates.tags ?? selectedContent.tags,
      coverImage: updates.coverImage ?? selectedContent.coverImage,
      updatedAt: new Date().toISOString(),
    };
    setContents(contents.map(c => c.id === updated.id ? updated : c));
  };

  const createNew = () => {
    const newItem: ContentItem = {
      id: Date.now().toString(),
      title: '',
      content: '',
      platform: 'xiaohongshu',
      status: 'draft',
      tags: [],
      cta: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setContents([newItem, ...contents]);
    setSelectedContentId(newItem.id);
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && selectedContent && !(selectedContent.tags || []).includes(tag)) {
      updateDraft({ tags: [...(selectedContent.tags || []), tag] });
    }
    setTagInput('');
  };

  return (
    <div className="flex h-full">
      {/* Left: Content list */}
      <div className="w-[240px] border-r border-spark-gray-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-spark-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-sm text-spark-gray-800">内容列表</h2>
          <button onClick={createNew} className="w-7 h-7 rounded-lg bg-spark-warm text-spark-orange flex items-center justify-center hover:bg-spark-orange hover:text-primary-foreground transition-colors">
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {contents.length === 0 && (
            <div className="text-center py-8 text-spark-gray-400 text-xs">
              <Sparkles size={24} className="mx-auto mb-2" />
              点击 + 创建第一篇内容
            </div>
          )}
          {contents.map(item => (
            <button
              key={item.id}
              onClick={() => setSelectedContentId(item.id)}
              className={`w-full text-left p-2.5 rounded-lg transition-colors text-sm ${
                selectedContentId === item.id
                  ? 'bg-spark-warm text-spark-orange'
                  : 'hover:bg-spark-gray-100 text-spark-gray-600'
              }`}
            >
              <div className="font-medium truncate">{item.title || '未命名草稿'}</div>
              <div className="text-[10px] text-spark-gray-400 mt-0.5">
                {item.platform === 'xiaohongshu' ? '小红书' : item.platform === 'wechat' ? '公众号' : '抖音'}
                {' · '}
                {item.status === 'draft' ? '草稿' : item.status === 'published' ? '已发布' : '审核中'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Middle: Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedContent ? (
          <>
            <div className="p-4 border-b border-spark-gray-200 flex items-center gap-3">
              <select
                value={draft.platform}
                onChange={(e) => updateDraft({ platform: e.target.value as Platform })}
                className="spark-input w-auto"
              >
                <option value="xiaohongshu">小红书</option>
                <option value="wechat">公众号</option>
                <option value="douyin">抖音</option>
              </select>
              <div className="flex gap-1 ml-auto">
                <button onClick={() => setPreviewMode('mobile')} className={`p-1.5 rounded-lg ${previewMode === 'mobile' ? 'bg-spark-warm text-spark-orange' : 'text-spark-gray-400'}`}>
                  <Smartphone size={16} />
                </button>
                <button onClick={() => setPreviewMode('desktop')} className={`p-1.5 rounded-lg ${previewMode === 'desktop' ? 'bg-spark-warm text-spark-orange' : 'text-spark-gray-400'}`}>
                  <Monitor size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-spark-gray-500 mb-1 block">标题</label>
                <input
                  value={draft.title}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                  className="spark-input"
                  placeholder="输入标题..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-spark-gray-500 mb-1 block">正文</label>
                <textarea
                  value={draft.body}
                  onChange={(e) => updateDraft({ body: e.target.value })}
                  className="spark-input h-40 resize-none py-2"
                  placeholder="输入正文内容..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-spark-gray-500 mb-1 block">行动号召 (CTA)</label>
                <input
                  value={draft.cta}
                  onChange={(e) => updateDraft({ cta: e.target.value })}
                  className="spark-input"
                  placeholder="如：点击链接了解更多"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-spark-gray-500 mb-1 block">标签</label>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="spark-input flex-1"
                    placeholder="添加标签..."
                  />
                  <button onClick={addTag} className="spark-btn-secondary text-xs">添加</button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(draft.tags).map(t => (
                    <span key={t} className="inline-flex items-center gap-1 bg-spark-warm text-spark-orange text-xs px-2 py-0.5 rounded-full">
                      #{t}
                      <button onClick={() => updateDraft({ tags: draft.tags.filter(x => x !== t) })} className="hover:text-destructive">×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-spark-gray-400">
            <div className="text-center">
              <Sparkles size={40} className="mx-auto mb-3 text-spark-gray-300" />
              <p className="text-sm">选择或创建一篇内容开始编辑</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Preview */}
      {selectedContent && (
        <div className="w-[360px] border-l border-spark-gray-200 bg-spark-gray-50 p-4 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-spark-gray-500">预览</h3>
            <button className="text-spark-gray-400 hover:text-spark-orange transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="flex justify-center">
            <PlatformPreview draft={draft} platform={draft.platform} />
          </div>
        </div>
      )}
    </div>
  );
}
