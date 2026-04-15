import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Heart, MessageCircle, Bookmark } from 'lucide-react';
import type { Platform } from '../types/spark';

export interface ReportData {
  title: string;
  platform: Platform;
  metrics: { views: number; likes: number; comments: number; saves: number };
  sparkComment: string;
  topComments?: { user: string; text: string }[];
  sparkAdvice?: string;
}

const platformLabel: Record<Platform, { name: string; color: string }> = {
  xiaohongshu: { name: '小红书', color: '#FF2442' },
  wechat: { name: '公众号', color: '#07C160' },
  douyin: { name: '抖音', color: '#111' },
};

function formatNum(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

const metricIcons = [
  { key: 'views' as const, icon: Eye, label: '阅读' },
  { key: 'likes' as const, icon: Heart, label: '点赞' },
  { key: 'comments' as const, icon: MessageCircle, label: '评论' },
  { key: 'saves' as const, icon: Bookmark, label: '收藏' },
];

export default function DataReportCard({ data }: { data: ReportData }) {
  const [expanded, setExpanded] = useState(false);
  const pl = platformLabel[data.platform];

  return (
    <div
      className="bg-white rounded-xl border border-[#F0EFED] shadow-sm overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header: title + platform */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h4 className="text-[15px] font-semibold text-[#333] truncate flex-1">{data.title}</h4>
        <span
          className="ml-2 text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0"
          style={{ color: pl.color, background: pl.color + '15' }}
        >
          {pl.name}
        </span>
      </div>

      {/* Metrics row */}
      <div className="px-4 py-3 flex items-center gap-5">
        {metricIcons.map(({ key, icon: Icon, label }) => (
          <div key={key} className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              <Icon size={13} className="text-[#CCC]" />
              <span className="text-[17px] font-bold text-spark-orange">{formatNum(data.metrics[key])}</span>
            </div>
            <span className="text-[11px] text-[#BBB]">{label}</span>
          </div>
        ))}
      </div>

      {/* Spark comment */}
      <div className="px-4 pb-3">
        <p className="text-[13px] text-[#999] italic leading-relaxed">{data.sparkComment}</p>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-[#F0EFED] px-4 py-3 space-y-3" style={{ animation: 'spark-fade-in 0.2s ease' }}>
          {/* Top comments */}
          {data.topComments && data.topComments.length > 0 && (
            <div>
              <h5 className="text-[13px] font-medium text-[#666] mb-2">💬 评论精选</h5>
              <div className="space-y-1.5">
                {data.topComments.map((c, i) => (
                  <div key={i} className="flex gap-2 text-[13px]">
                    <span className="text-[#999] shrink-0">@{c.user}</span>
                    <span className="text-[#555]">{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Spark advice */}
          {data.sparkAdvice && (
            <div>
              <h5 className="text-[13px] font-medium text-[#666] mb-1">✨ 火花建议</h5>
              <p className="text-[13px] text-[#555] leading-relaxed">{data.sparkAdvice}</p>
            </div>
          )}
        </div>
      )}

      {/* Expand indicator */}
      <div className="flex justify-center py-1.5 border-t border-[#F5F5F3]">
        {expanded ? <ChevronUp size={14} className="text-[#CCC]" /> : <ChevronDown size={14} className="text-[#CCC]" />}
      </div>
    </div>
  );
}
