import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { Platform } from '../types/spark';
import { Image as ImageIcon, PanelRightClose, PanelRightOpen } from 'lucide-react';

function PlatformPreview({
  title,
  body,
  cta,
  tags,
  coverImage,
  platform,
}: {
  title: string;
  body: string;
  cta: string;
  tags: string[];
  coverImage?: string;
  platform: Platform;
}) {
  if (platform === 'xiaohongshu') {
    return (
      <div className="bg-spark-surface rounded-xl border border-spark-gray-200 overflow-hidden">
        <div className="aspect-[4/5] bg-spark-gray-100 flex items-center justify-center">
          {coverImage ? (
            <img src={coverImage} alt="cover" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={28} className="text-spark-gray-300" />
          )}
        </div>
        <div className="p-3 space-y-2">
          <h3 className="font-semibold text-sm text-spark-gray-800">{title || '标题'}</h3>
          <p className="text-xs text-spark-gray-500 line-clamp-3">{body || '正文内容...'}</p>
          {cta && (
            <div className="bg-spark-warm text-spark-orange text-xs font-medium px-3 py-1.5 rounded-full text-center">
              {cta}
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="text-[10px] text-spark-orange">#{t}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (platform === 'wechat') {
    return (
      <div className="bg-spark-surface rounded-xl border border-spark-gray-200 overflow-hidden">
        <div className="p-4 border-b border-spark-gray-100">
          <h3 className="font-bold text-base text-spark-gray-800">{title || '文章标题'}</h3>
          <p className="text-xs text-spark-gray-400 mt-1">火花品牌</p>
        </div>
        {coverImage && (
          <div className="px-4 pt-3">
            <img src={coverImage} alt="cover" className="w-full rounded-lg" />
          </div>
        )}
        <div className="p-4">
          <p className="text-sm text-spark-gray-600 leading-relaxed">{body || '正文内容...'}</p>
          {cta && (
            <div className="mt-3 text-center text-sm text-spark-orange font-medium">{cta}</div>
          )}
        </div>
      </div>
    );
  }

  // douyin
  return (
    <div className="bg-spark-gray-800 rounded-xl overflow-hidden text-primary-foreground">
      <div className="aspect-[9/16] bg-spark-gray-700 flex items-center justify-center relative">
        {coverImage ? (
          <img src={coverImage} alt="cover" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={28} className="text-spark-gray-500" />
        )}
        <div className="absolute bottom-4 left-4 right-12">
          <h3 className="font-bold text-sm">{title || '视频标题'}</h3>
          {cta && <p className="text-xs mt-1 text-spark-orange">{cta}</p>}
          <div className="flex flex-wrap gap-1 mt-1">
            {tags.map((t) => (
              <span key={t} className="text-[10px] text-spark-gray-300">#{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PreviewPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const { contents, selectedContentId } = useAppStore();
  const selectedContent = contents.find((c) => c.id === selectedContentId);

  if (collapsed) {
    return (
      <div className="w-10 h-screen border-l border-spark-gray-200 bg-spark-surface flex flex-col items-center pt-3 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          title="展开预览"
          className="w-8 h-8 rounded-lg text-spark-gray-400 hover:bg-spark-gray-100 hover:text-spark-gray-600 flex items-center justify-center transition-colors"
        >
          <PanelRightOpen size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 h-screen border-l border-spark-gray-200 bg-spark-gray-50 flex flex-col shrink-0">
      {/* Header */}
      <div className="h-12 border-b border-spark-gray-200 bg-spark-surface flex items-center justify-between px-3 shrink-0">
        <span className="text-xs font-semibold text-spark-gray-500">预览</span>
        <button
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 rounded-lg text-spark-gray-400 hover:bg-spark-gray-100 hover:text-spark-gray-600 flex items-center justify-center transition-colors"
        >
          <PanelRightClose size={14} />
        </button>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedContent ? (
          <PlatformPreview
            title={selectedContent.title}
            body={selectedContent.content}
            cta={selectedContent.cta || ''}
            tags={selectedContent.tags || []}
            coverImage={selectedContent.coverImage}
            platform={selectedContent.platform}
          />
        ) : (
          <div className="text-center py-12 text-spark-gray-400 text-xs">
            选择草稿后在此预览
          </div>
        )}
      </div>
    </div>
  );
}
