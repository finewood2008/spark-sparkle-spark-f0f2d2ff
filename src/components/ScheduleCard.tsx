import { useState } from 'react';
import { CalendarClock, Loader2, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { ScheduleCardData, ScheduleConfig } from '../types/spark';
import { toast } from 'sonner';

const STORAGE_KEY = 'spark-auto-schedule';

const FREQUENCY_OPTIONS = [
  { id: 'daily' as const, label: '每天' },
  { id: 'weekly' as const, label: '每周' },
];

const TIME_OPTIONS = ['08:00', '09:00', '12:00', '18:00', '20:00'];

interface ScheduleCardProps {
  data: ScheduleCardData;
}

function loadSchedule(): ScheduleConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {
    enabled: false,
    frequency: 'daily',
    daysOfWeek: [1, 3, 5],
    platforms: ['xiaohongshu'],
    topics: [],
    style: '',
    postsPerDay: 1,
    scheduledTimes: ['09:00'],
  };
}

function saveSchedule(c: ScheduleConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

export default function ScheduleCard({ data }: ScheduleCardProps) {
  const { addMessage } = useAppStore();
  const [topic, setTopic] = useState(data.suggestedTopic || '');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>(data.suggestedFrequency || 'daily');
  const [time, setTime] = useState('09:00');
  const [confirmed, setConfirmed] = useState(!!data.confirmed);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!topic.trim()) {
      toast.error('请输入主题');
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));

    const current = loadSchedule();
    const next: ScheduleConfig = {
      ...current,
      enabled: true,
      frequency,
      topics: Array.from(new Set([...current.topics, topic.trim()])),
      scheduledTimes: [time],
      daysOfWeek: frequency === 'weekly' ? [1] : current.daysOfWeek,
    };
    saveSchedule(next);
    useAppStore.getState().setSchedule(next);

    setConfirmed(true);
    setSaving(false);

    addMessage({
      id: `${Date.now()}-schedule-confirmed`,
      role: 'assistant',
      content: `✅ 计划已创建：${frequency === 'daily' ? '每天' : '每周'} ${time} 自动生成「${topic.trim()}」相关内容，生成后会以待审核卡片形式推送给你。`,
      timestamp: new Date().toISOString(),
    });
    toast.success('定时任务已创建');
  };

  return (
    <div
      className={`rounded-xl border overflow-hidden spark-fade-in ${
        confirmed
          ? 'border-green-300/60 bg-green-50/50'
          : 'border-blue-300/60 bg-blue-50/40'
      }`}
    >
      <div
        className={`flex items-center gap-2 px-4 py-2.5 border-b ${
          confirmed
            ? 'bg-green-100/60 border-green-200/60'
            : 'bg-blue-100/50 border-blue-200/50'
        }`}
      >
        {confirmed ? (
          <CheckCircle2 size={16} className="text-green-700" />
        ) : (
          <CalendarClock size={16} className="text-blue-700" />
        )}
        <div className="flex-1 min-w-0">
          <div
            className={`text-[12px] font-semibold leading-tight ${
              confirmed ? 'text-green-800' : 'text-blue-800'
            }`}
          >
            {confirmed ? '✅ 定时任务已创建' : '🗓️ 创建定时任务'}
          </div>
          <div
            className={`text-[11px] mt-0.5 ${
              confirmed ? 'text-green-700/70' : 'text-blue-700/70'
            }`}
          >
            {confirmed ? '我会按计划自动生成并推送审核卡片' : '确认后我会按计划自动生成内容'}
          </div>
        </div>
      </div>

      <div className="p-4 bg-white space-y-3">
        {/* Frequency */}
        <div>
          <label className="text-[11px] text-[#999] mb-1.5 block">发布频率</label>
          <div className="flex gap-1.5">
            {FREQUENCY_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => !confirmed && setFrequency(opt.id)}
                disabled={confirmed}
                className={`flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                  frequency === opt.id
                    ? 'bg-spark-orange text-white'
                    : 'bg-[#F5F5F3] text-[#666] hover:bg-[#EEEDEB]'
                } ${confirmed ? 'cursor-default opacity-70' : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time */}
        <div>
          <label className="text-[11px] text-[#999] mb-1.5 block">生成时间</label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={confirmed}
            className="w-full text-[13px] text-[#333] bg-white border border-[#E5E4E2] rounded-lg px-3 py-1.5 outline-none focus:border-spark-orange disabled:opacity-70"
          >
            {TIME_OPTIONS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Topic */}
        <div>
          <label className="text-[11px] text-[#999] mb-1.5 block">内容主题</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={confirmed}
            placeholder="例如：晨间护肤推荐"
            className="w-full text-[13px] text-[#333] bg-white border border-[#E5E4E2] rounded-lg px-3 py-1.5 outline-none focus:border-spark-orange disabled:opacity-70"
          />
        </div>

        {!confirmed && (
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-spark-orange text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <CalendarClock size={14} />
                确认创建
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
