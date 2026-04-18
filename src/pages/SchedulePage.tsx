import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  loadScheduleConfig,
  saveScheduleConfig,
  loadScheduleLogs,
  executeScheduledTask,
  clearScheduleLogs,
} from '../lib/schedule-persistence';
import type { ScheduleConfig, Platform } from '../types/spark';

interface ScheduleLogEntry {
  id: string;
  topic: string;
  platform: Platform;
  status: 'success' | 'error' | 'pending';
  contentId?: string;
  error?: string;
  timestamp: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  wechat: '公众号',
  weibo: '微博',
  shipin: '视频号',
};

const FREQ_LABELS: Record<string, string> = {
  daily: '每天',
  weekdays: '工作日',
  custom: '自定义',
};

interface SchedulePageProps {
  embedded?: boolean;
}

export default function SchedulePage({ embedded = false }: SchedulePageProps = {}) {
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [logs, setLogs] = useState<ScheduleLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [topicInput, setTopicInput] = useState('');
  const [editTopics, setEditTopics] = useState<string[]>([]);
  const [editPlatforms, setEditPlatforms] = useState<Platform[]>(['xiaohongshu']);
  const [editFrequency, setEditFrequency] = useState<ScheduleConfig['frequency']>('daily');
  const [editTimes, setEditTimes] = useState<string[]>(['09:00']);
  const [editStyle, setEditStyle] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [cfg, lgArr] = await Promise.all([loadScheduleConfig(), loadScheduleLogs(20)]);
    setConfig(cfg);
    setLogs(lgArr);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async () => {
    if (!config) return;
    const next = { ...config, enabled: !config.enabled };
    setConfig(next);
    await saveScheduleConfig(next);
    toast.success(next.enabled ? '自动任务已开启' : '自动任务已暂停');
  };

  const handleRunNow = async () => {
    if (!config || config.topics.length === 0) {
      toast.error('请先设置话题');
      return;
    }
    setRunning(true);
    const topic = config.topics[Math.floor(Math.random() * config.topics.length)];
    const platform = config.platforms[Math.floor(Math.random() * config.platforms.length)];
    toast.info(`正在生成：${topic}（${PLATFORM_LABELS[platform] || platform}）`);

    const result = await executeScheduledTask({
      topic,
      platform,
      style: config.style,
      taskName: `手动执行·${topic}`,
    });

    if (result.success) {
      toast.success('内容已生成，请到审核中心查看');
    } else {
      toast.error(`生成失败：${result.error}`);
    }

    setRunning(false);
    load();
  };

  const handleClearLogs = async () => {
    await clearScheduleLogs();
    setLogs([]);
    toast.success('执行记录已清空');
  };

  const startEdit = () => {
    if (!config) return;
    setEditTopics([...config.topics]);
    setEditPlatforms([...config.platforms]);
    setEditFrequency(config.frequency);
    setEditTimes([...config.scheduledTimes]);
    setEditStyle(config.style || '');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!config) return;
    if (editTopics.length === 0) {
      toast.error('至少添加一个话题');
      return;
    }
    const next: ScheduleConfig = {
      ...config,
      topics: editTopics,
      platforms: editPlatforms,
      frequency: editFrequency,
      scheduledTimes: editTimes,
      style: editStyle,
    };
    setConfig(next);
    await saveScheduleConfig(next);
    setEditing(false);
    toast.success('任务配置已保存');
  };

  const addTopic = () => {
    const t = topicInput.trim();
    if (t && !editTopics.includes(t)) {
      setEditTopics((prev) => [...prev, t]);
    }
    setTopicInput('');
  };

  if (loading || !config) {
    return (
      <div className={embedded ? 'py-8 flex items-center justify-center' : 'h-full flex items-center justify-center'}>
        <Loader2 size={24} className="animate-spin text-orange-400" />
      </div>
    );
  }

  const successCount = logs.filter((l) => l.status === 'success').length;
  const errorCount = logs.filter((l) => l.status === 'error').length;

  return (
    <div className={embedded ? 'p-5 max-w-2xl mx-auto' : 'h-full overflow-y-auto p-6 max-w-2xl mx-auto'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#333]">自动任务</h1>
            <p className="text-[12px] text-[#999]">
              服务端定时执行，关闭浏览器也不影响
            </p>
          </div>
        </div>

        {/* Master toggle */}
        <button
          onClick={handleToggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
            config.enabled
              ? 'bg-green-50 text-green-600 border border-green-200'
              : 'bg-[#F0EFED] text-[#999] border border-[#E5E4E2]'
          }`}
        >
          {config.enabled ? <Play size={14} /> : <Pause size={14} />}
          {config.enabled ? '运行中' : '已暂停'}
        </button>
      </div>

      {/* Task Summary Card */}
      <div className="border border-[#E5E4E2] rounded-2xl p-5 mb-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[14px] font-medium text-[#333]">任务配置</span>
          {!editing && (
            <button
              onClick={startEdit}
              className="text-[12px] text-orange-500 hover:text-orange-600 transition-colors"
            >
              编辑
            </button>
          )}
        </div>

        {editing ? (
          /* ── Edit Mode ── */
          <div className="space-y-4">
            {/* Topics */}
            <div>
              <label className="text-[12px] text-[#999] mb-1.5 block">话题方向</label>
              <div className="flex gap-2 mb-2">
                <input
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTopic()}
                  placeholder="输入话题后回车"
                  className="flex-1 text-[13px] border border-[#E5E4E2] rounded-lg px-3 py-2 outline-none focus:border-orange-400"
                />
                <button
                  onClick={addTopic}
                  className="px-3 py-2 text-[12px] text-[#666] border border-[#E5E4E2] rounded-lg hover:bg-[#F0EFED]"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {editTopics.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-600 text-[12px] rounded-full"
                  >
                    {t}
                    <X
                      size={12}
                      className="cursor-pointer hover:text-red-500"
                      onClick={() => setEditTopics((prev) => prev.filter((x) => x !== t))}
                    />
                  </span>
                ))}
                {editTopics.length === 0 && (
                  <span className="text-[12px] text-[#CCC]">还没有话题</span>
                )}
              </div>
            </div>

            {/* Platforms */}
            <div>
              <label className="text-[12px] text-[#999] mb-1.5 block">发布平台</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() =>
                      setEditPlatforms((prev) =>
                        prev.includes(key as Platform)
                          ? prev.filter((p) => p !== key)
                          : [...prev, key as Platform],
                      )
                    }
                    className={`px-3 py-1.5 text-[12px] rounded-lg border transition-colors ${
                      editPlatforms.includes(key as Platform)
                        ? 'bg-orange-50 text-orange-600 border-orange-200'
                        : 'text-[#999] border-[#E5E4E2] hover:border-orange-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency + Time */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[12px] text-[#999] mb-1.5 block">频率</label>
                <select
                  value={editFrequency}
                  onChange={(e) =>
                    setEditFrequency(e.target.value as ScheduleConfig['frequency'])
                  }
                  className="w-full text-[13px] border border-[#E5E4E2] rounded-lg px-3 py-2 outline-none focus:border-orange-400"
                >
                  <option value="daily">每天</option>
                  <option value="weekdays">工作日</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[12px] text-[#999] mb-1.5 block">执行时间</label>
                <input
                  type="time"
                  value={editTimes[0] || '09:00'}
                  onChange={(e) => setEditTimes([e.target.value])}
                  className="w-full text-[13px] border border-[#E5E4E2] rounded-lg px-3 py-2 outline-none focus:border-orange-400"
                />
              </div>
            </div>

            {/* Style */}
            <div>
              <label className="text-[12px] text-[#999] mb-1.5 block">写作风格（可选）</label>
              <input
                value={editStyle}
                onChange={(e) => setEditStyle(e.target.value)}
                placeholder="如：专业严谨、轻松活泼、故事化叙事..."
                className="w-full text-[13px] border border-[#E5E4E2] rounded-lg px-3 py-2 outline-none focus:border-orange-400"
              />
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={saveEdit}
                className="flex-1 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-lg text-[13px] font-medium hover:opacity-90"
              >
                保存
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-[13px] text-[#999] border border-[#E5E4E2] rounded-lg hover:bg-[#F0EFED]"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          /* ── Read Mode ── */
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Calendar size={14} className="text-[#999] mt-0.5 shrink-0" />
              <div className="text-[13px] text-[#666]">
                <span className="text-[#999]">话题：</span>
                {config.topics.length > 0 ? config.topics.join('、') : '未设置'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[#999] shrink-0" />
              <span className="text-[13px] text-[#666]">
                <span className="text-[#999]">频率：</span>
                {FREQ_LABELS[config.frequency] || config.frequency}
                {' · '}
                {config.scheduledTimes.join(', ')}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 ml-[22px]">
              {config.platforms.map((p) => (
                <span
                  key={p}
                  className="px-2 py-0.5 bg-[#F0EFED] text-[12px] text-[#666] rounded-md"
                >
                  {PLATFORM_LABELS[p] || p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={handleRunNow}
          disabled={running || config.topics.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-xl text-[13px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {running ? (
            <>
              <Loader2 size={14} className="animate-spin" /> 生成中...
            </>
          ) : (
            <>
              <Play size={14} /> 立即执行一次
            </>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="border border-[#E5E4E2] rounded-xl p-3 text-center bg-white">
          <div className="text-xl font-bold text-[#333]">{logs.length}</div>
          <div className="text-[11px] text-[#999]">总执行</div>
        </div>
        <div className="border border-green-100 rounded-xl p-3 text-center bg-green-50/50">
          <div className="text-xl font-bold text-green-600">{successCount}</div>
          <div className="text-[11px] text-green-600/70">成功</div>
        </div>
        <div className="border border-red-100 rounded-xl p-3 text-center bg-red-50/50">
          <div className="text-xl font-bold text-red-500">{errorCount}</div>
          <div className="text-[11px] text-red-500/70">失败</div>
        </div>
      </div>

      {/* Execution History */}
      <div className="border border-[#E5E4E2] rounded-2xl bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EFED]">
          <span className="text-[14px] font-medium text-[#333]">执行记录</span>
          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              className="text-[11px] text-[#CCC] hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <RotateCcw size={10} /> 清空
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[#CCC]">
            还没有执行记录
          </div>
        ) : (
          <div className="divide-y divide-[#F5F4F0]">
            {logs.slice(0, 15).map((log, i) => (
              <div key={`${log.timestamp}-${i}`} className="px-4 py-3 flex items-center gap-3">
                {log.status === 'success' ? (
                  <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                ) : log.status === 'error' ? (
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                ) : (
                  <Loader2 size={16} className="text-orange-400 animate-spin shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[#333] truncate">{log.topic}</div>
                  <div className="text-[11px] text-[#CCC]">
                    {PLATFORM_LABELS[log.platform] || log.platform}
                    {' · '}
                    {new Date(log.timestamp).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {log.error && (
                    <div className="text-[11px] text-red-400 mt-0.5 truncate">{log.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
