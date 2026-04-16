import { ClipboardCheck, ArrowRight, Clock } from 'lucide-react';
import type { ContentItem, ContentStatus } from '../types/spark';

interface ReviewReminderCardProps {
  /** Optional content preview (title/snippet) */
  item?: Pick<ContentItem, 'id' | 'title' | 'content' | 'status'>;
  /** Friendly task name (e.g. "晨间护肤系列" or "手动创作") */
  taskName?: string;
  /** Override main message text */
  message?: string;
  /** Status to render badge for; falls back to item.status */
  status?: ContentStatus;
}

const STATUS_BADGE: Record<string, { text: string; cls: string }> = {
  reviewing: { text: '待审核', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  draft: { text: '草稿', cls: 'bg-muted text-muted-foreground border-border' },
  approved: { text: '已通过', cls: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { text: '已打回', cls: 'bg-red-100 text-red-700 border-red-200' },
  published: { text: '已发布', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
};

export default function ReviewReminderCard({
  item,
  taskName,
  message,
  status,
}: ReviewReminderCardProps) {
  const effectiveStatus = status || item?.status || 'reviewing';
  const badge = STATUS_BADGE[effectiveStatus];
  const goToReview = () => {
    window.location.href = '/review';
  };

  return (
    <div className="rounded-xl border border-yellow-300/60 bg-yellow-50/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-100/60 border-b border-yellow-200/60">
        <ClipboardCheck size={14} className="text-yellow-700" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-yellow-800 leading-tight">
            🔔 {message ?? `定时任务${taskName ? `「${taskName}」` : ''}已生成 1 篇内容，请前往审核中心查看`}
          </div>
        </div>
        {badge && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.cls}`}>
            {badge.text}
          </span>
        )}
      </div>

      {/* Content preview */}
      {item && (
        <div className="px-4 py-3 bg-white space-y-1.5">
          <div className="text-sm font-semibold text-[#333] truncate">{item.title}</div>
          {item.content && (
            <div className="text-xs text-[#888] line-clamp-2 leading-relaxed">
              {item.content.replace(/\n+/g, ' ').slice(0, 120)}
            </div>
          )}
        </div>
      )}

      {/* Action */}
      <div className="px-4 py-2.5 bg-yellow-50/30 border-t border-yellow-200/40 flex items-center justify-between">
        <span className="text-[11px] text-[#999] flex items-center gap-1">
          <Clock size={11} />
          完整审核操作请前往审核页
        </span>
        <button
          onClick={goToReview}
          className="flex items-center gap-1 px-3 py-1 rounded-full bg-spark-orange text-white text-[12px] font-medium hover:opacity-90 transition-opacity"
        >
          前往审核
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
