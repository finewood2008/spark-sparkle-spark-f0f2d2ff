import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Platform } from '../types/spark';

export interface MetricGrowth {
  views: number;
  likes: number;
  comments: number;
  saves: number;
}

export interface ReportData {
  title: string;
  platform: Platform;
  metrics: { views: number; likes: number; comments: number; saves: number };
  sparkComment: string;
  topComments?: { user: string; text: string }[];
  sparkAdvice?: string;
  /** Growth % over the last 7 days (vs earliest sample in window). */
  growth?: MetricGrowth;
  /** Number of samples used to compute growth. */
  growthSampleCount?: number;
  /** AI-generated short insight + recommendation based on 7-day trend. */
  aiInsight?: string;
}

function formatNum(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function formatPct(p: number): string {
  if (p > 0) return `+${p}%`;
  if (p < 0) return `${p}%`;
  return '0%';
}

function GrowthBadge({ value }: { value: number }) {
  const positive = value > 0;
  const negative = value < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  const color = positive
    ? 'text-green-600 bg-green-50'
    : negative
    ? 'text-red-500 bg-red-50'
    : 'text-gray-500 bg-gray-50';
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
      <Icon size={10} />
      {formatPct(value)}
    </span>
  );
}

const metricConfig = [
  { key: 'views' as const, label: '阅读量', threshold: 10000 },
  { key: 'likes' as const, label: '点赞', threshold: 500 },
  { key: 'comments' as const, label: '评论', threshold: 100 },
  { key: 'saves' as const, label: '收藏', threshold: 200 },
];

export default function DataReportCard({ data, onAction }: { data: ReportData; onAction?: (action: string) => void }) {
  const hasGrowth = !!data.growth && (data.growthSampleCount ?? 0) >= 2;

  return (
    <div className="bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-1">
        <h4 className="text-[16px] font-bold text-[#333] leading-snug">{data.title}</h4>
        <p className="text-[12px] text-[#BBB] mt-1">
          {hasGrowth ? `近 7 天数据表现 · ${data.growthSampleCount} 次采样` : '昨天的发布表现'}
        </p>
      </div>

      {/* Metrics row */}
      <div className="px-5 py-4 grid grid-cols-4 gap-3">
        {metricConfig.map(({ key, label, threshold }) => {
          const value = data.metrics[key];
          const isGood = value >= threshold;
          const growthVal = data.growth?.[key];
          return (
            <div key={key} className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                <span className="text-[22px] font-bold text-orange-500 leading-none">
                  {formatNum(value)}
                </span>
                {isGood && !hasGrowth && (
                  <TrendingUp size={14} className="text-green-500" />
                )}
              </div>
              <span className="text-[11px] text-[#BCBCBC] mt-1">{label}</span>
              {hasGrowth && typeof growthVal === 'number' && (
                <div className="mt-1">
                  <GrowthBadge value={growthVal} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI insight (priority over legacy sparkAdvice) */}
      {(data.aiInsight || data.sparkAdvice) && (
        <div className="mx-5 mb-4 bg-[#F9F9F7] rounded-xl px-4 py-3 flex items-start gap-2.5">
          <span className="text-[18px] shrink-0 mt-0.5">💡</span>
          <p className="text-[13px] text-[#666] italic leading-relaxed flex-1">
            {data.aiInsight || data.sparkAdvice}
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
