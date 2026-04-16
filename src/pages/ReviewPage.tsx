import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Trash2,
  X,
  Sparkles,
  Briefcase,
  Scissors,
  Inbox,
  Clock,
  Tag,
  Send,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  loadReviewHistory,
  updateReviewItemStatus,
  deleteReviewItem,
  saveReviewItem,
  type ReviewHistoryEntry,
} from '@/lib/review-persistence';
import { streamChat } from '@/lib/ai-stream';
import { loadUserPrefs } from '@/lib/user-prefs';
import type { ContentItem, ContentStatus, Platform, ReviewTaskData } from '@/types/spark';
import DistributionCard from '@/components/DistributionCard';
import MetricsTrendChart from '@/components/MetricsTrendChart';
import { useAppStore } from '@/store/appStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type FilterKey = 'all' | 'reviewing' | 'approved' | 'rejected' | 'published';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'reviewing', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已打回' },
  { key: 'published', label: '已发布' },
];

const PLATFORM_LABEL: Record<string, string> = {
  xiaohongshu: '小红书',
  wechat: '公众号',
  douyin: '抖音',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

const SOURCE_LABEL: Record<string, string> = {
  manual: '手动创作',
  schedule: '定时任务',
  auto: '自动重写',
};

function statusDot(status: ContentStatus) {
  switch (status) {
    case 'reviewing':
    case 'draft':
      return 'bg-yellow-500';
    case 'approved':
      return 'bg-green-500';
    case 'rejected':
      return 'bg-red-500';
    case 'published':
      return 'bg-blue-500';
    default:
      return 'bg-muted-foreground';
  }
}

function statusBadge(status: ContentStatus) {
  switch (status) {
    case 'reviewing':
    case 'draft':
      return { text: '待审核', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    case 'approved':
      return { text: '已通过', cls: 'bg-green-100 text-green-700 border-green-200' };
    case 'rejected':
      return { text: '已打回', cls: 'bg-red-100 text-red-700 border-red-200' };
    case 'published':
      return { text: '已发布', cls: 'bg-blue-100 text-blue-700 border-blue-200' };
    default:
      return { text: status, cls: 'bg-muted text-muted-foreground border-border' };
  }
}

function formatTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ReviewPageProps {
  embedded?: boolean;
}

export default function ReviewPage({ embedded = false }: ReviewPageProps = {}) {
  const [entries, setEntries] = useState<ReviewHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const { contents, setContents, addMessage } = useAppStore();

  const fetchHistory = async () => {
    setLoading(true);
    const data = await loadReviewHistory();
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const reviewingCount = useMemo(
    () => entries.filter(e => e.status === 'reviewing' || e.status === 'draft').length,
    [entries],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    if (filter === 'reviewing')
      return entries.filter(e => e.status === 'reviewing' || e.status === 'draft');
    return entries.filter(e => e.status === filter);
  }, [entries, filter]);

  const selected = useMemo(
    () => entries.find(e => e.id === selectedId) || null,
    [entries, selectedId],
  );

  // Reset reject panel when switching items
  useEffect(() => {
    setRejecting(false);
    setRejectReason('');
  }, [selectedId]);

  // Sync status changes from appStore (e.g. DistributionCard publish) back into entries
  useEffect(() => {
    setEntries(prev =>
      prev.map(e => {
        const c = contents.find(c => c.id === e.id);
        if (!c) return e;
        if (c.status !== e.status || (c.publishedAt && c.publishedAt !== e.publishedAt)) {
          return {
            ...e,
            status: c.status,
            publishedAt: c.publishedAt || e.publishedAt,
            updatedAt: c.updatedAt || e.updatedAt,
          };
        }
        return e;
      }),
    );
  }, [contents]);

  const updateLocalStatus = (id: string, status: ContentStatus, rejectReason?: string) => {
    setEntries(prev =>
      prev.map(e =>
        e.id === id
          ? { ...e, status, rejectReason: rejectReason ?? e.rejectReason, updatedAt: new Date().toISOString() }
          : e,
      ),
    );
    // Sync with app store contents if present
    const updated = contents.map(c =>
      c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c,
    );
    setContents(updated);
  };

  const handleApprove = async () => {
    if (!selected) return;
    await updateReviewItemStatus(selected.id, 'approved');
    updateLocalStatus(selected.id, 'approved');
    toast.success('内容已通过审核');
  };

  const handleIgnore = async () => {
    if (!selected) return;
    await deleteReviewItem(selected.id);
    setEntries(prev => prev.filter(e => e.id !== selected.id));
    setSelectedId(null);
    toast.success('已忽略此审核任务');
  };

  const runRegenerate = async (reason: string, _presetLabel?: string) => {
    if (!selected) return;
    if (!reason.trim()) {
      toast.error('请填写打回意见');
      return;
    }

    await updateReviewItemStatus(selected.id, 'rejected', reason);
    updateLocalStatus(selected.id, 'rejected', reason);
    setRejecting(false);
    setRegenerating(true);

    const userPrefs = loadUserPrefs();
    let raw = '';
    const newId = `${Date.now()}-regen`;
    const original = selected;

    await streamChat({
      messages: [
        {
          role: 'user',
          content: `请基于以下原文和修改意见重新生成一篇文章。\n\n原标题：${original.title}\n原内容：${original.content}\n\n修改意见：${reason}\n\n写作风格：${userPrefs.writingStyle}，语气：${userPrefs.writingTone}`,
        },
      ],
      mode: 'generate',
      platform: original.platform,
      onDelta: chunk => {
        raw += chunk;
      },
      onDone: async () => {
        let parsed: { title: string; content: string; cta: string; tags: string[] };
        try {
          let cleaned = raw.trim();
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
          }
          parsed = JSON.parse(cleaned);
        } catch {
          parsed = {
            title: original.title,
            content: raw,
            cta: original.cta || '',
            tags: original.tags || [],
          };
        }

        const newItem: ContentItem = {
          id: newId,
          title: parsed.title || original.title,
          content: parsed.content || raw,
          platform: original.platform,
          status: 'reviewing',
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          cta: parsed.cta || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          autoGenerated: true,
        };

        const newTask: ReviewTaskData = {
          source: 'auto',
          taskName: `${original.taskName}（重写版）`,
          triggeredAt: new Date().toISOString(),
          topic: original.taskTopic,
        };

        // Persist new version
        await saveReviewItem(newItem, newTask);

        // Mirror in app store so chat flow shows it too
        setContents([newItem, ...useAppStore.getState().contents]);
        addMessage({
          id: `${Date.now()}-regen-card`,
          role: 'assistant',
          content: '✏️ 根据你的反馈，我重新写了一版，请审核：',
          timestamp: new Date().toISOString(),
          contentItem: newItem,
          reviewTask: newTask,
        });

        setRegenerating(false);
        setRejectReason('');
        toast.success('已生成新版本，请在「待审核」中查看');
        fetchHistory();
      },
      onError: err => {
        setRegenerating(false);
        toast.error(`重新生成失败：${err}`);
      },
    });
  };

  return (
    <div
      className={embedded ? 'h-full overflow-hidden' : 'min-h-screen bg-background'}
      style={
        embedded
          ? undefined
          : {
              background:
                'linear-gradient(180deg, oklch(0.95 0.04 70 / 20%), oklch(0.985 0.002 90))',
            }
      }
    >
      <div
        className={
          embedded
            ? 'h-full flex flex-col px-4 py-4'
            : 'max-w-7xl mx-auto px-4 py-6'
        }
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {!embedded && (
            <Link
              to="/"
              className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
          )}
          <h1 className="text-base font-bold text-foreground">审核中心</h1>
          <button
            onClick={fetchHistory}
            className="ml-auto w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="刷新列表"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Two-column layout */}
        <div
          className={
            embedded
              ? 'flex-1 min-h-0 flex flex-col gap-3'
              : 'flex flex-col md:flex-row gap-4 md:gap-5 md:h-[calc(100vh-7rem)]'
          }
        >
          {/* Left: list panel */}
          <div
            className={
              embedded
                ? 'shrink-0 max-h-[40%] rounded-xl bg-card shadow-sm border border-border flex flex-col overflow-hidden'
                : 'md:w-[40%] rounded-2xl bg-card shadow-lg border border-border flex flex-col overflow-hidden'
            }
          >
            {/* Tabs */}
            <div className="flex items-center gap-1 p-2 border-b border-border overflow-x-auto">
              {FILTERS.map(f => {
                const isActive = filter === f.key;
                const showBadge = f.key === 'reviewing' && reviewingCount > 0;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`relative shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {f.label}
                    {showBadge && (
                      <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                        {reviewingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  加载中...
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Inbox size={32} className="mb-2 opacity-50" />
                  <span className="text-sm">暂无{filter === 'all' ? '审核内容' : FILTERS.find(f => f.key === filter)?.label}</span>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map(e => {
                    const active = e.id === selectedId;
                    const badge = statusBadge(e.status);
                    return (
                      <li key={e.id}>
                        <button
                          onClick={() => setSelectedId(e.id)}
                          className={`w-full text-left px-4 py-3 transition-colors ${
                            active
                              ? 'bg-primary/5 border-l-2 border-l-primary'
                              : 'hover:bg-muted/40 border-l-2 border-l-transparent'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusDot(e.status)}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">
                                {e.title}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {PLATFORM_LABEL[e.platform] || e.platform}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {SOURCE_LABEL[e.taskSource] || e.taskSource}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls}`}
                                >
                                  {badge.text}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                <Clock size={10} />
                                {formatTime(e.triggeredAt)}
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right: detail panel */}
          <div className="md:w-[60%] rounded-2xl bg-card shadow-lg border border-border flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20">
                <Inbox size={40} className="mb-3 opacity-40" />
                <p className="text-sm">选择一条内容查看详情</p>
              </div>
            ) : (
              <DetailView
                entry={selected}
                rejecting={rejecting}
                rejectReason={rejectReason}
                regenerating={regenerating}
                onApprove={handleApprove}
                onIgnore={handleIgnore}
                onStartReject={() => setRejecting(true)}
                onCancelReject={() => {
                  setRejecting(false);
                  setRejectReason('');
                }}
                onChangeReason={setRejectReason}
                onSubmitReject={() => runRegenerate(rejectReason)}
                onPresetReject={(prompt, label) => runRegenerate(prompt, label)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DetailViewProps {
  entry: ReviewHistoryEntry;
  rejecting: boolean;
  rejectReason: string;
  regenerating: boolean;
  onApprove: () => void;
  onIgnore: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onChangeReason: (v: string) => void;
  onSubmitReject: () => void;
  onPresetReject: (prompt: string, label: string) => void;
}

function DetailView({
  entry,
  rejecting,
  rejectReason,
  regenerating,
  onApprove,
  onIgnore,
  onStartReject,
  onCancelReject,
  onChangeReason,
  onSubmitReject,
  onPresetReject,
}: DetailViewProps) {
  const badge = statusBadge(entry.status);
  const isReviewing = entry.status === 'reviewing' || entry.status === 'draft';
  const isApproved = entry.status === 'approved';
  const isRejected = entry.status === 'rejected';
  const isPublished = entry.status === 'published';

  return (
    <>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Cover */}
        {entry.coverImage ? (
          <div className="rounded-xl overflow-hidden border border-border bg-muted">
            <img
              src={entry.coverImage}
              alt={entry.title}
              className="w-full h-auto max-h-72 object-cover"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 h-32 flex flex-col items-center justify-center text-muted-foreground">
            <ImageIcon size={20} className="mb-1 opacity-50" />
            <span className="text-xs">暂无封面图</span>
          </div>
        )}

        {/* Title */}
        <h2 className="text-xl font-bold text-foreground leading-tight">{entry.title}</h2>

        {/* Tags row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {PLATFORM_LABEL[entry.platform] || entry.platform}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {SOURCE_LABEL[entry.taskSource] || entry.taskSource}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded border ${badge.cls}`}>{badge.text}</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
            <Clock size={12} />
            {formatTime(entry.triggeredAt)}
          </span>
        </div>

        {/* Content */}
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {entry.content || <span className="text-muted-foreground">（无正文）</span>}
          </div>
        </div>

        {/* CTA */}
        {entry.cta && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="text-[11px] font-medium text-primary mb-1">CTA</div>
            <div className="text-sm text-foreground">{entry.cta}</div>
          </div>
        )}

        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag size={12} className="text-muted-foreground" />
            {entry.tags.map((t, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Status-specific extras */}
        {isApproved && (
          <>
            <DistributionCard
              data={{
                contentId: entry.id,
                title: entry.title,
                defaultPlatforms: [entry.platform as Platform],
              }}
            />
            <MetricsTrendChart reviewItemId={entry.id} />
          </>
        )}

        {isRejected && (
          <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 space-y-2">
            <div className="text-xs font-semibold text-red-700">已打回原因</div>
            <div className="text-sm text-foreground">{entry.rejectReason || '（未填写）'}</div>
            <div className="text-xs text-muted-foreground border-t border-red-100 pt-2">
              ✏️ AI 已重新生成，请在「待审核」列表查看新版本
            </div>
          </div>
        )}

        {isPublished && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-sm text-blue-800 font-medium">
              <Send size={14} />
              已发布
            </div>
            {entry.publishedAt && (
              <div className="text-xs text-muted-foreground">
                发布时间：{formatTime(entry.publishedAt)}
              </div>
            )}
            {entry.publishedPlatforms && entry.publishedPlatforms.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground">已发布平台：</span>
                {entry.publishedPlatforms.map(p => (
                  <span
                    key={p}
                    className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200"
                  >
                    {PLATFORM_LABEL[p] || p}
                  </span>
                ))}
              </div>
            )}
            <MetricsTrendChart reviewItemId={entry.id} />
          </div>
        )}
      </div>

      {/* Action footer (reviewing only) */}
      {isReviewing && (
        <div className="border-t border-border bg-card/80 backdrop-blur p-4 space-y-3">
          {!rejecting ? (
            <>
              <div className="flex gap-2">
                <button
                  onClick={onApprove}
                  disabled={regenerating}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  通过
                </button>
                <button
                  onClick={onStartReject}
                  disabled={regenerating}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {regenerating ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                  打回并重写
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={regenerating}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-muted text-muted-foreground border border-border text-sm font-medium hover:bg-muted/70 hover:text-red-500 transition-colors disabled:opacity-50"
                      title="忽略此条"
                    >
                      <Trash2 size={16} />
                      忽略
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认忽略此审核任务？</AlertDialogTitle>
                      <AlertDialogDescription>
                        「{entry.title}」将从数据库中永久删除，此操作无法撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onIgnore}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        确认忽略
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  告诉我哪里需要修改：
                </span>
                <button
                  onClick={onCancelReject}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: '语气更活泼',
                    icon: <Sparkles size={11} />,
                    prompt:
                      '把语气改得更活泼、轻松、有感染力，多用口语化表达和有趣的比喻，让读者读起来有亲切感。',
                  },
                  {
                    label: '语气更专业',
                    icon: <Briefcase size={11} />,
                    prompt:
                      '把语气改得更专业、严谨、权威，使用行业术语和数据支撑观点，去掉过于口语化的表达。',
                  },
                  {
                    label: '更精简',
                    icon: <Scissors size={11} />,
                    prompt:
                      '在保留核心信息和关键卖点的前提下，把内容精简到原文的 60% 长度左右，去除冗余表达。',
                  },
                ].map(p => (
                  <button
                    key={p.label}
                    disabled={regenerating}
                    onClick={() => onPresetReject(p.prompt, p.label)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-muted border border-border text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-50"
                  >
                    {p.icon}
                    {p.label}
                  </button>
                ))}
              </div>

              <textarea
                value={rejectReason}
                onChange={e => onChangeReason(e.target.value)}
                placeholder="例如：语气太严肃了，活泼一点；或者：开头不够吸引人..."
                rows={3}
                className="w-full text-sm text-foreground bg-background border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/50 resize-none"
              />
              <button
                onClick={onSubmitReject}
                disabled={regenerating || !rejectReason.trim()}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {regenerating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RotateCcw size={16} />
                )}
                {regenerating ? '重新生成中...' : '提交并重写'}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
