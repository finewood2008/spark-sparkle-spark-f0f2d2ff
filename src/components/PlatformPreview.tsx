import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Bookmark, Share2, Eye, Play, Music2, ImageIcon } from 'lucide-react';
import type { ContentItem, Platform } from '../types/spark';

// 客户端日期，避免 SSR/CSR 跨日跨时区导致 hydration mismatch
function useClientDate(formatter: (d: Date) => string): string {
  const [value, setValue] = useState('');
  useEffect(() => {
    setValue(formatter(new Date()));
  }, [formatter]);
  return value;
}

const formatCnDate = (d: Date) => d.toLocaleDateString('zh-CN');

interface PlatformPreviewProps {
  item: ContentItem;
  platform: Platform;
}

export default function PlatformPreview({ item, platform }: PlatformPreviewProps) {
  if (platform === 'xiaohongshu') return <XiaohongshuPreview item={item} />;
  if (platform === 'wechat') return <WechatPreview item={item} />;
  if (platform === 'douyin') return <DouyinPreview item={item} />;
  return null;
}

/* ============ 小红书 笔记预览 ============ */
function XiaohongshuPreview({ item }: { item: ContentItem }) {
  return (
    <div className="rounded-lg overflow-hidden border border-red-100 bg-white shadow-sm max-w-[260px] mx-auto">
      {/* 封面 */}
      <div className="relative aspect-[3/4] bg-gradient-to-br from-red-50 to-pink-50 overflow-hidden">
        {item.coverImage ? (
          <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-red-200">
            <ImageIcon size={32} />
          </div>
        )}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-sm text-white text-[10px] font-medium">
          📕 小红书
        </div>
      </div>
      {/* 标题 + 互动 */}
      <div className="p-2.5 space-y-1.5">
        <div className="text-[12px] font-medium text-[#333] leading-snug line-clamp-2">
          {item.title || '（待添加标题）'}
        </div>
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] text-red-500">#{t}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-red-50">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 to-pink-400" />
            <span className="text-[10px] text-[#999]">@账号</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[#999]">
            <Heart size={10} className="text-red-400" />
            <span>1.2k</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ 微信公众号 图文预览 ============ */
function WechatPreview({ item }: { item: ContentItem }) {
  const preview = (item.content || '').slice(0, 60);
  const dateText = useClientDate(formatCnDate);
  return (
    <div className="rounded-lg overflow-hidden border border-green-100 bg-white shadow-sm">
      {/* 顶部品牌条 */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border-b border-green-100">
        <span className="text-[10px]">💬</span>
        <span className="text-[10px] text-green-700 font-medium">公众号</span>
        <span className="text-[10px] text-green-600/60">· 图文消息</span>
      </div>
      {/* 标题大图样式 */}
      <div className="relative aspect-[16/9] bg-gradient-to-br from-green-50 to-emerald-50 overflow-hidden">
        {item.coverImage ? (
          <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-green-200">
            <ImageIcon size={28} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5">
          <div className="text-white text-[13px] font-semibold leading-snug line-clamp-2">
            {item.title || '（待添加标题）'}
          </div>
        </div>
      </div>
      {/* 摘要 */}
      <div className="p-2.5 space-y-1.5">
        <div className="text-[11px] text-[#666] leading-relaxed line-clamp-2">
          {preview || '正文摘要会显示在这里...'}
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-green-50">
          <span className="text-[10px] text-[#999]" suppressHydrationWarning>{dateText || '今天'}</span>
          <div className="flex items-center gap-2 text-[10px] text-[#999]">
            <span className="flex items-center gap-0.5"><Eye size={10} /> 阅读</span>
            <span className="flex items-center gap-0.5"><MessageCircle size={10} /> 留言</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ 抖音 短视频脚本预览 ============ */
function DouyinPreview({ item }: { item: ContentItem }) {
  // 把正文按句号/换行切分成"分镜"
  const beats = (item.content || '')
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 bg-[#161823] shadow-sm">
      {/* 模拟竖屏视频框 + 脚本叠层 */}
      <div className="relative aspect-[9/14] bg-gradient-to-b from-gray-800 to-black overflow-hidden">
        {item.coverImage ? (
          <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover opacity-40" />
        ) : null}
        {/* 顶部抖音标识 */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
          <span className="text-[10px] text-white/80 font-medium">🎵 抖音 · 视频脚本</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/80">15-30s</span>
        </div>

        {/* 中央播放图标 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play size={18} className="text-white ml-0.5" fill="white" />
          </div>
        </div>

        {/* 右侧互动按钮 */}
        <div className="absolute right-2 bottom-16 flex flex-col gap-2.5 items-center text-white">
          <Heart size={16} />
          <MessageCircle size={16} />
          <Bookmark size={16} />
          <Share2 size={16} />
        </div>

        {/* 底部标题 + BGM */}
        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 to-transparent">
          <div className="text-white text-[11px] font-semibold leading-snug line-clamp-2 mb-1">
            {item.title || '（待添加标题）'}
          </div>
          <div className="flex items-center gap-1 text-[9px] text-white/80">
            <Music2 size={9} />
            <span className="truncate">原创音乐 · 火花作品</span>
          </div>
        </div>
      </div>

      {/* 分镜脚本 */}
      <div className="p-2.5 bg-white space-y-1">
        <div className="text-[10px] text-spark-orange font-medium mb-1">📝 分镜脚本</div>
        {beats.length > 0 ? (
          beats.map((beat, i) => (
            <div key={i} className="flex gap-1.5 items-start">
              <span className="text-[10px] text-gray-400 font-mono shrink-0 mt-0.5">
                {String(i + 1).padStart(2, '0')}s
              </span>
              <span className="text-[11px] text-[#444] leading-snug flex-1 line-clamp-1">{beat}</span>
            </div>
          ))
        ) : (
          <div className="text-[10px] text-gray-400">正文将自动拆分为分镜...</div>
        )}
        {item.cta && (
          <div className="flex gap-1.5 items-start pt-1 mt-1 border-t border-gray-100">
            <span className="text-[10px] text-spark-orange font-mono shrink-0 mt-0.5">CTA</span>
            <span className="text-[11px] text-spark-orange leading-snug flex-1">{item.cta}</span>
          </div>
        )}
      </div>
    </div>
  );
}
