import { TrendingUp } from 'lucide-react';
import type { Platform } from '../types/spark';

export interface ReportData {
  title: string;
  platform: Platform;
  metrics: { views: number; likes: number; comments: number; saves: number };
  sparkComment: string;
  topComments?: { user: string; text: string }[];
  sparkAdvice?: string;
}

function formatNum(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

const metricConfig = [
  { key: 'views' as const, label: '阅读量', threshold: 10000 },
  { key: 'likes' as const, label: '点赞', threshold: 500 },
  { key: 'comments' as const, label: '评论', threshold: 100 },
  { key: 'saves' as const, label: '收藏', threshold: 200 },
];

export default function DataReportCard({ data, onAction }: { data: ReportData; onAction?: (action: string) => void }) {
  return (
    <div className="bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-1">
        <h4 className="text-[16px] font-bold text-[#333] leading-snug">{data.title}</h4>
        <p className="text-[12px] text-[#BBB] mt-1">昨天的发布表现</p>
      </div>

      {/* Metrics row */}
      <div className="px-5 py-4 grid grid-cols-4 gap-3">
        {metricConfig.map(({ key, label, threshold }) => {
          const value = data.metrics[key];
          const isGood = value >= threshold;
          return (
            <div key={key} className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                <span className="text-[22px] font-bold text-orange-500 leading-none">
                  {formatNum(value)}
                </span>
                {isGood && (
                  <TrendingUp size={14} className="text-green-500" />
                )}
              </div>
              <span className="text-[11px] text-[#BCBCBC] mt-1">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Spark insight */}
      {data.sparkAdvice && (
        <div className="mx-5 mb-4 bg-[#F9F9F7] rounded-xl px-4 py-3 flex items-start gap-2.5">
          <span className="text-[18px] shrink-0 mt-0.5">💡</span>
          <p className="text-[13px] text-[#666] italic leading-relaxed flex-1">
            {data.sparkAdvice}
          </p>
        </div>
      )}

      {/* Action button */}
      {onAction && (
        <div className="px-5 pb-5">
          <button
            onClick={(e) => { e.stopPropagation(); onAction('write_sequel'); }}
            className="w-full py-2.5 rounded-xl bg-orange-50 text-orange-500 text-[14px] font-medium hover:bg-orange-100 transition-colors"
          >
            ⚡️ 针对评论写续集
          </button>
        </div>
      )}
    </div>
  );
}
