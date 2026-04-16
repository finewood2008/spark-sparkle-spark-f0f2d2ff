import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { generateArticle } from '../lib/ai-stream';
import { saveReviewItem } from '../lib/review-persistence';
import {
  loadScheduleConfig,
  saveScheduleConfig,
  loadScheduleLogs,
  insertScheduleLog,
  updateScheduleLog,
  clearScheduleLogs,
  subscribeScheduleChanges,
  type ScheduleLogEntry,
} from '../lib/schedule-persistence';
import type { ScheduleConfig, Platform, ContentItem } from '../types/spark';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Zap,
  Sparkles,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Repeat,
  Target,
  Cloud,
  Trash2,
} from 'lucide-react';

const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  wechat: '公众号',
  douyin: '抖音',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const DEFAULT_CONFIG: ScheduleConfig = {
  enabled: false,
  frequency: 'daily',
  daysOfWeek: [1, 3, 5],
  platforms: ['xiaohongshu'],
  topics: [],
  style: '',
  postsPerDay: 1,
  scheduledTimes: ['09:00'],
};

// Skip the very first save effect to avoid overwriting cloud config with defaults during initial load
function useSkipFirst<T>(value: T, fn: (v: T) => void) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    fn(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}

// --- Schedule Config Form ---
function ScheduleConfigForm({
  config,
  onChange,
}: {
  config: ScheduleConfig;
  onChange: (c: ScheduleConfig) => void;
}) {
  const [topicInput, setTopicInput] = useState('');

  const toggleDay = (day: number) => {
    const days = config.daysOfWeek.includes(day)
      ? config.daysOfWeek.filter(d => d !== day)
      : [...config.daysOfWeek, day].sort();
    onChange({ ...config, daysOfWeek: days });
  };

  const togglePlatform = (p: Platform) => {
    const platforms = config.platforms.includes(p)
      ? config.platforms.filter(x => x !== p)
      : [...config.platforms, p];
    if (platforms.length > 0) onChange({ ...config, platforms });
  };

  const addTopic = () => {
    const t = topicInput.trim();
    if (t && !config.topics.includes(t)) {
      onChange({ ...config, topics: [...config.topics, t] });
    }
    setTopicInput('');
  };

  return (
    <div className="space-y-5">
      {/* Frequency */}
      <div>
        <label className="text-xs font-medium text-spark-gray-500 mb-2 block flex items-center gap-1.5">
          <Repeat size={13} /> 发布频率
        </label>
        <div className="flex gap-2">
          {(['daily', 'weekly', 'custom'] as const).map(f => (
            <button
              key={f}
              onClick={() => onChange({ ...config, frequency: f })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                config.frequency === f
                  ? 'bg-spark-orange text-primary-foreground'
                  : 'bg-spark-gray-100 text-spark-gray-600 hover:bg-spark-gray-200'
              }`}
            >
              {f === 'daily' ? '每天' : f === 'weekly' ? '每周' : '自定义'}
            </button>
          ))}
        </div>
      </div>

      {/* Days of Week (for weekly/custom) */}
      {config.frequency !== 'daily' && (
        <div>
          <label className="text-xs font-medium text-spark-gray-500 mb-2 block flex items-center gap-1.5">
            <CalendarDays size={13} /> 发布日
          </label>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, idx) => (
              <button
                key={idx}
                onClick={() => toggleDay(idx)}
                className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
                  config.daysOfWeek.includes(idx)
                    ? 'bg-spark-orange text-primary-foreground'
                    : 'bg-spark-gray-100 text-spark-gray-500 hover:bg-spark-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Posts per day */}
      <div>
        <label className="text-xs font-medium text-spark-gray-500 mb-2 block flex items-center gap-1.5">
          <Target size={13} /> 每日生成数量
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={5}
            value={config.postsPerDay}
            onChange={(e) => onChange({ ...config, postsPerDay: parseInt(e.target.value) })}
            className="flex-1 accent-spark-orange"
          />
          <span className="text-sm font-bold text-spark-orange w-6 text-center">{config.postsPerDay}</span>
          <span className="text-xs text-spark-gray-400">篇/天</span>
        </div>
      </div>

      {/* Platforms */}
      <div>
        <label className="text-xs font-medium text-spark-gray-500 mb-2 block">目标平台</label>
        <div className="flex gap-2">
          {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([p, label]) => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                config.platforms.includes(p)
                  ? 'bg-spark-warm text-spark-orange border border-spark-orange/30'
                  : 'bg-spark-gray-100 text-spark-gray-500 hover:bg-spark-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Topics */}
      <div>
        <label className="text-xs font-medium text-spark-gray-500 mb-2 block flex items-center gap-1.5">
          <Sparkles size={13} /> 内容主题池
        </label>
        <div className="flex gap-2 mb-2">
          <input
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTopic();
              }
            }}
            className="spark-input flex-1"
            placeholder="添加主题，如：护肤心得、好物推荐..."
          />
          <button onClick={addTopic} className="spark-btn-secondary text-xs">
            <Plus size={14} /> 添加
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {config.topics.map(t => (
            <span key={t} className="inline-flex items-center gap-1 bg-spark-warm text-spark-orange text-xs px-2.5 py-1 rounded-full">
              {t}
              <button
                onClick={() => onChange({ ...config, topics: config.topics.filter(x => x !== t) })}
                className="hover:text-destructive"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {config.topics.length === 0 && (
            <span className="text-xs text-spark-gray-300">添加主题后，AI 将自动轮换生成内容</span>
          )}
        </div>
      </div>

      {/* Style */}
      <div>
        <label className="text-xs font-medium text-spark-gray-500 mb-1 block">写作风格</label>
        <input
          value={config.style}
          onChange={(e) => onChange({ ...config, style: e.target.value })}
          className="spark-input"
          placeholder="如：专业严谨、轻松幽默、清新文艺..."
        />
      </div>

      {/* Scheduled Times */}
      <div>
        <label className="text-xs font-medium text-spark-gray-500 mb-2 block flex items-center gap-1.5">
          <Clock size={13} /> 定时发布时间
        </label>
        <div className="space-y-2">
          {(config.scheduledTimes || ['09:00']).map((time, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="time"
                value={time}
                onChange={(e) => {
                  const times = [...(config.scheduledTimes || ['09:00'])];
                  times[idx] = e.target.value;
                  onChange({ ...config, scheduledTimes: times });
                }}
                className="spark-input w-auto"
              />
              {(config.scheduledTimes || []).length > 1 && (
                <button
                  onClick={() => onChange({ ...config, scheduledTimes: (config.scheduledTimes || []).filter((_, i) => i !== idx) })}
                  className="text-spark-gray-400 hover:text-destructive"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {(config.scheduledTimes || []).length < 5 && (
            <button
              onClick={() => onChange({ ...config, scheduledTimes: [...(config.scheduledTimes || ['09:00']), '12:00'] })}
              className="text-xs text-spark-orange hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> 添加时间点
            </button>
          )}
        </div>
        <p className="text-[10px] text-spark-gray-300 mt-1">页面需保持打开，定时器才会触发自动生成</p>
      </div>
    </div>
  );
}

// --- Schedule Timeline ---
function ScheduleTimeline({ config }: { config: ScheduleConfig }) {
  const getUpcomingDates = () => {
    const dates: { date: Date; platform: Platform; topic: string }[] = [];
    const now = new Date();
    let topicIdx = 0;

    for (let dayOffset = 0; dayOffset < 14 && dates.length < 10; dayOffset++) {
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      const dow = date.getDay();

      const shouldPost = config.frequency === 'daily' || config.daysOfWeek.includes(dow);
      if (!shouldPost) continue;

      for (let i = 0; i < config.postsPerDay; i++) {
        for (const platform of config.platforms) {
          const topic = config.topics.length > 0
            ? config.topics[topicIdx % config.topics.length]
            : '待定主题';
          topicIdx++;
          const times = config.scheduledTimes || ['09:00'];
          const timeStr = times[i % times.length] || '09:00';
          const [h, m] = timeStr.split(':').map(Number);
          const postDate = new Date(date);
          postDate.setHours(h, m, 0, 0);
          dates.push({ date: postDate, platform, topic });
        }
      }
    }
    return dates.slice(0, 10);
  };

  const upcoming = getUpcomingDates();

  if (!config.enabled || upcoming.length === 0) {
    return (
      <div className="text-center py-8 text-spark-gray-400">
        <Calendar size={32} className="mx-auto mb-2 text-spark-gray-300" />
        <p className="text-sm">启用计划后，这里会显示即将发布的内容</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {upcoming.map((item, idx) => {
        const isToday = item.date.toDateString() === new Date().toDateString();
        const isTomorrow = item.date.toDateString() === new Date(Date.now() + 86400000).toDateString();
        const dateLabel = isToday ? '今天' : isTomorrow ? '明天' : `${item.date.getMonth() + 1}/${item.date.getDate()}`;
        const timeLabel = `${item.date.getHours().toString().padStart(2, '0')}:00`;

        return (
          <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-spark-gray-50 border border-spark-gray-100">
            <div className="text-center w-12 shrink-0">
              <div className={`text-xs font-bold ${isToday ? 'text-spark-orange' : 'text-spark-gray-600'}`}>{dateLabel}</div>
              <div className="text-[10px] text-spark-gray-400">{timeLabel}</div>
            </div>
            <div className="w-px h-8 bg-spark-gray-200" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-spark-gray-700 truncate">{item.topic}</div>
              <div className="text-[10px] text-spark-gray-400">{PLATFORM_LABELS[item.platform]}</div>
            </div>
            <div className={`w-2 h-2 rounded-full ${isToday ? 'bg-spark-orange' : 'bg-spark-gray-300'}`} />
          </div>
        );
      })}
    </div>
  );
}

// --- Execution Log ---
function ExecutionLog({ logs, onClear }: { logs: ScheduleLogEntry[]; onClear: () => void }) {
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const filtered = logs.filter(l => filter === 'all' || l.status === filter);

  return (
    <div>
      {/* Filter + Clear */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 bg-spark-gray-100 rounded-md p-0.5">
          {([
            { id: 'all' as const, label: `全部 (${logs.length})` },
            { id: 'success' as const, label: `成功 (${logs.filter(l => l.status === 'success').length})` },
            { id: 'error' as const, label: `失败 (${logs.filter(l => l.status === 'error').length})` },
          ]).map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === opt.id ? 'bg-spark-surface text-spark-orange shadow-sm' : 'text-spark-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {logs.length > 0 && (
          <button
            onClick={() => {
              if (confirm('确定清空所有执行记录？此操作不可恢复')) onClear();
            }}
            className="flex items-center gap-1 text-[11px] text-spark-gray-400 hover:text-destructive transition-colors"
          >
            <Trash2 size={11} /> 清空
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-6 text-spark-gray-400 text-xs">
          {logs.length === 0 ? '暂无执行记录' : '当前筛选条件下无记录'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => (
            <div key={log.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-spark-gray-100">
              {log.status === 'success' && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
              {log.status === 'error' && <AlertCircle size={14} className="text-destructive shrink-0" />}
              {log.status === 'pending' && <Loader2 size={14} className="text-spark-orange shrink-0 animate-spin" />}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-spark-gray-700 truncate">
                  {log.topic} · {PLATFORM_LABELS[log.platform] || log.platform}
                </div>
                {log.error && <div className="text-[10px] text-destructive mt-0.5">{log.error}</div>}
              </div>
              <div className="text-[10px] text-spark-gray-400 shrink-0">
                {new Date(log.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export default function SchedulePage() {
  const { contents, setContents, setSelectedContentId, brand, addMessage } = useAppStore();
  const [config, setConfig] = useState<ScheduleConfig>(DEFAULT_CONFIG);
  const [logs, setLogs] = useState<ScheduleLogEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [activeSection, setActiveSection] = useState<'config' | 'timeline' | 'log'>('config');

  // Initial load from Supabase + realtime subscription
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [cfg, lgs] = await Promise.all([loadScheduleConfig(), loadScheduleLogs()]);
      if (!mounted) return;
      setConfig(cfg);
      setLogs(lgs);
      setLoaded(true);
    })();
    const unsubscribe = subscribeScheduleChanges(
      (cfg) => setConfig(cfg),
      async () => {
        const lgs = await loadScheduleLogs();
        setLogs(lgs);
      },
    );
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Persist config changes (skip until first cloud load completes)
  useSkipFirst(config, (cfg) => {
    if (loaded) saveScheduleConfig(cfg);
  });

  const toggleEnabled = () => {
    setConfig(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  const getBrandContext = useCallback(() => {
    if (!brand || !brand.initialized) return '';
    return `\n品牌名: ${brand.name}\n行业: ${brand.industry}\n主营: ${brand.mainBusiness}\n语气: ${brand.toneOfVoice}\n关键词: ${brand.keywords.join(', ')}\n禁用词: ${brand.tabooWords.join(', ')}`;
  }, [brand]);

  const handleRunOnce = useCallback(async () => {
    if (generating) return;
    if (config.topics.length === 0) {
      alert('请先添加至少一个主题');
      return;
    }

    setGenerating(true);

    const brandCtx = getBrandContext();
    const newLogs: ScheduleLogEntry[] = [];
    const newContents: ContentItem[] = [];

    // Generate one post per platform for a random topic
    for (const platform of config.platforms) {
      const topic = config.topics[Math.floor(Math.random() * config.topics.length)];
      const logEntry: ScheduleLogEntry = {
        id: Date.now().toString() + platform,
        topic,
        platform,
        status: 'pending',
        timestamp: new Date().toISOString(),
      };
      newLogs.push(logEntry);
    }

    setLogs(prev => [...newLogs, ...prev]);
    // Insert pending log rows to cloud
    for (const l of newLogs) {
      insertScheduleLog(l);
    }

    for (let i = 0; i < newLogs.length; i++) {
      const log = newLogs[i];
      try {
        const result = await generateArticle({
          platform: log.platform,
          topic: log.topic,
          style: config.style,
          brandContext: brandCtx || undefined,
        });

        const contentItem: ContentItem = {
          id: Date.now().toString() + i,
          title: result.title,
          content: result.content,
          platform: log.platform,
          status: 'reviewing',
          tags: result.tags,
          cta: result.cta,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          autoGenerated: true,
        };

        newContents.push(contentItem);
        log.status = 'success';
        log.contentId = contentItem.id;

        // Push a Human-in-the-loop review message into chat
        const reviewTask = {
          source: 'schedule' as const,
          taskName: `「${log.topic}」 · ${log.platform}`,
          triggeredAt: new Date().toISOString(),
          topic: log.topic,
        };
        addMessage({
          id: `${Date.now()}-review-${i}`,
          role: 'assistant',
          content: `🟡 定时任务生成了一篇新内容，请审核：`,
          timestamp: new Date().toISOString(),
          contentItem,
          reviewTask,
        });
        // Persist to Supabase
        saveReviewItem(contentItem, reviewTask);
      } catch (err: unknown) {
        log.status = 'error';
        log.error = err instanceof Error ? err.message : '生成失败';
      }

      setLogs(prev => prev.map(l => l.id === log.id ? { ...log } : l));
      // Sync log status to cloud
      updateScheduleLog(log);
    }

    // Add generated contents to store
    if (newContents.length > 0) {
      setContents([...newContents, ...contents]);
      setSelectedContentId(newContents[0].id);
    }

    setGenerating(false);
  }, [generating, config, getBrandContext, contents, setContents, setSelectedContentId, addMessage]);

  // --- Auto-trigger timer ---
  const lastTriggeredRef = useRef<string>('');

  useEffect(() => {
    if (!config.enabled || config.topics.length === 0) return;

    const checkTimer = () => {
      const now = new Date();
      const dow = now.getDay();
      const shouldRunToday = config.frequency === 'daily' || config.daysOfWeek.includes(dow);
      if (!shouldRunToday) return;

      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      for (const scheduledTime of (config.scheduledTimes || ['09:00'])) {
        const triggerKey = `${now.toDateString()}-${scheduledTime}`;
        if (currentTime === scheduledTime && lastTriggeredRef.current !== triggerKey) {
          lastTriggeredRef.current = triggerKey;
          handleRunOnce();
          break;
        }
      }
    };

    const interval = setInterval(checkTimer, 30_000);
    checkTimer();
    return () => clearInterval(interval);
  }, [config.enabled, config.frequency, config.daysOfWeek, config.topics.length, config.scheduledTimes, handleRunOnce]);

  const totalGenerated = logs.filter(l => l.status === 'success').length;

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-spark-gray-800 mb-1 flex items-center gap-2">
            <Calendar size={20} className="text-spark-orange" />
            自动发布计划
          </h1>
          <p className="text-sm text-spark-gray-400 flex items-center gap-2">
            设定规则，AI 自动生成并排期内容
            <span className="inline-flex items-center gap-1 text-[10px] text-green-600 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded-full">
              <Cloud size={10} /> 多端同步{loaded ? '已就绪' : '加载中…'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Run Once */}
          <button
            onClick={handleRunOnce}
            disabled={generating || config.topics.length === 0}
            className="spark-btn-primary text-sm disabled:opacity-40"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {generating ? '生成中...' : '立即生成'}
          </button>
          {/* Toggle */}
          <button
            onClick={toggleEnabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              config.enabled
                ? 'bg-green-50 text-green-600 border border-green-200'
                : 'bg-spark-gray-100 text-spark-gray-500 border border-spark-gray-200'
            }`}
          >
            {config.enabled ? <Play size={14} /> : <Pause size={14} />}
            {config.enabled ? '计划已启用' : '计划已暂停'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="spark-card p-4">
          <div className="text-2xl font-bold text-spark-gray-800">{config.topics.length}</div>
          <div className="text-xs text-spark-gray-400 mt-0.5">主题数</div>
        </div>
        <div className="spark-card p-4">
          <div className="text-2xl font-bold text-spark-gray-800">{config.platforms.length * config.postsPerDay}</div>
          <div className="text-xs text-spark-gray-400 mt-0.5">每日内容数</div>
        </div>
        <div className="spark-card p-4">
          <div className="text-2xl font-bold text-spark-orange">{totalGenerated}</div>
          <div className="text-xs text-spark-gray-400 mt-0.5">已生成总数</div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 mb-4 bg-spark-gray-100 rounded-lg p-1 w-fit">
        {([
          { id: 'config' as const, label: '计划设置', icon: <Clock size={13} /> },
          { id: 'timeline' as const, label: '排期预览', icon: <CalendarDays size={13} /> },
          { id: 'log' as const, label: '执行记录', icon: <CheckCircle2 size={13} /> },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSection === tab.id
                ? 'bg-spark-surface text-spark-orange shadow-sm'
                : 'text-spark-gray-500 hover:text-spark-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="spark-card p-5">
        {activeSection === 'config' && (
          <ScheduleConfigForm config={config} onChange={setConfig} />
        )}
        {activeSection === 'timeline' && (
          <ScheduleTimeline config={config} />
        )}
        {activeSection === 'log' && (
          <ExecutionLog logs={logs} />
        )}
      </div>
    </div>
  );
}
