import { useEffect, useState } from 'react';
import { ClipboardCheck, CheckCircle2, RotateCcw, Clock, Loader2, RefreshCw, MessageSquareWarning } from 'lucide-react';
import { loadReviewHistory, type ReviewHistoryEntry } from '../lib/review-persistence';
import type { ContentStatus, Platform } from '../types/spark';

type FilterStatus = 'all' | 'reviewing' | 'approved' | 'rejected';

const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  wechat: '公众号',
  douyin: '抖音',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

const STATUS_CONFIG: Record<ContentStatus, { label: string; className: string; icon: React.ElementType }> = {
  draft: { label: '草稿', className: 'bg-spark-gray-100 text-spark-gray-600', icon: Clock },
  reviewing: { label: '待审核', className: 'bg-yellow-50 text-yellow-700 border border-yellow-200', icon: Clock },
  approved: { label: '已通过', className: 'bg-green-50 text-green-700 border border-green-200', icon: CheckCircle2 },
  published: { label: '已发布', className: 'bg-blue-50 text-blue-700 border border-blue-200', icon: CheckCircle2 },
  rejected: { label: '已打回', className: 'bg-red-50 text-red-700 border border-red-200', icon: RotateCcw },
};

const FILTERS: { id: FilterStatus; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'reviewing', label: '待审核' },
  { id: 'approved', label: '已通过' },
  { id: 'rejected', label: '已打回' },
];

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function ReviewHistoryList() {
  const [entries, setEntries] = useState<ReviewHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const fetchHistory = async () => {
    setLoading(true);
    const data = await loadReviewHistory();
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filtered = entries.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'approved') return e.status === 'approved' || e.status === 'published';
    return e.status === filter;
  });

  const counts = {
    all: entries.length,
    reviewing: entries.filter(e => e.status === 'reviewing').length,
    approved: entries.filter(e => e.status === 'approved' || e.status === 'published').length,
    rejected: entries.filter(e => e.status === 'rejected').length,
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm text-spark-gray-700 flex items-center gap-2">
          <ClipboardCheck size={16} className="text-spark-orange" />
          审核历史
          <span className="text-xs text-spark-gray-400 font-normal">({entries.length}条)</span>
        </h2>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="text-xs text-spark-gray-500 hover:text-spark-orange flex items-center gap-1 disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          刷新
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-spark-orange text-white'
                : 'bg-spark-gray-100 text-spark-gray-600 hover:bg-spark-gray-200'
            }`}
          >
            {f.label}
            <span className={`ml-1 text-[10px] ${filter === f.id ? 'text-white/80' : 'text-spark-gray-400'}`}>
              {counts[f.id]}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading && entries.length === 0 ? (
        <div className="spark-card p-8 text-center text-spark-gray-400">
          <Loader2 size={20} className="animate-spin mx-auto mb-2" />
          <p className="text-sm">加载中...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="spark-card p-8 text-center text-spark-gray-400">
          <ClipboardCheck size={24} className="mx-auto mb-2 text-spark-gray-300" />
          <p className="text-sm">{filter === 'all' ? '还没有审核记录' : '该分类下没有记录'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => {
            const cfg = STATUS_CONFIG[entry.status];
            const Icon = cfg.icon;
            return (
              <div key={entry.id} className="spark-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${cfg.className}`}>
                        <Icon size={10} />
                        {cfg.label}
                      </span>
                      <span className="text-[10px] bg-spark-gray-100 text-spark-gray-500 px-1.5 py-0.5 rounded">
                        {PLATFORM_LABELS[entry.platform] || entry.platform}
                      </span>
                      {entry.taskTopic && (
                        <span className="text-[10px] bg-spark-warm text-spark-orange px-1.5 py-0.5 rounded">
                          {entry.taskTopic}
                        </span>
                      )}
                      <span className="text-[10px] text-spark-gray-400 ml-auto">{formatTime(entry.updatedAt)}</span>
                    </div>
                    <p className="text-sm font-medium text-spark-gray-800 mt-1.5 truncate">{entry.title}</p>
                    {entry.contentPreview && (
                      <p className="text-xs text-spark-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {entry.contentPreview}
                        {entry.contentPreview.length >= 120 && '...'}
                      </p>
                    )}

                    {/* Reject reason */}
                    {entry.status === 'rejected' && entry.rejectReason && (
                      <div className="mt-2 px-2.5 py-1.5 rounded bg-red-50 border border-red-100 flex items-start gap-1.5">
                        <MessageSquareWarning size={12} className="text-red-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-red-600 font-medium">打回意见</div>
                          <div className="text-xs text-red-700 mt-0.5">{entry.rejectReason}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
