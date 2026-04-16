import { useState } from 'react';
import { Loader2, CheckCircle2, BarChart3, Rocket, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { loadUserPrefs } from '../lib/user-prefs';
import type { Platform, DistributionData } from '../types/spark';
import type { ReportData } from './DataReportCard';
import { toast } from 'sonner';

interface PlatformOption {
  id: Platform;
  label: string;
  emoji: string;
  color: string;
}

const PLATFORM_OPTIONS: PlatformOption[] = [
  { id: 'xiaohongshu', label: '小红书', emoji: '📕', color: 'bg-red-50 border-red-200 text-red-600' },
  { id: 'wechat', label: '微信公众号', emoji: '💬', color: 'bg-green-50 border-green-200 text-green-600' },
  { id: 'douyin', label: '抖音', emoji: '🎵', color: 'bg-gray-50 border-gray-200 text-gray-700' },
];

interface DistributionCardProps {
  data: DistributionData;
}

export default function DistributionCard({ data }: DistributionCardProps) {
  const { contents, setContents, addMessage } = useAppStore();
  const item = contents.find(c => c.id === data.contentId);

  const userPrefs = loadUserPrefs();
  const initialDefaults: Platform[] = data.defaultPlatforms?.length
    ? data.defaultPlatforms
    : item?.platform
    ? [item.platform]
    : [userPrefs.defaultPlatform as Platform];

  const [selected, setSelected] = useState<Platform[]>(initialDefaults);
  const [publishing, setPublishing] = useState(false);
  const [publishedTo, setPublishedTo] = useState<Platform[]>(data.publishedPlatforms || []);

  const isSuccess = publishedTo.length > 0;

  const togglePlatform = (p: Platform) => {
    if (publishing || isSuccess) return;
    setSelected(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handlePublish = async () => {
    if (selected.length === 0) {
      toast.error('请至少选择一个平台');
      return;
    }
    setPublishing(true);

    // Simulate platform API calls (1.2s)
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Update content status to published
    if (item) {
      const updated = contents.map(c =>
        c.id === item.id
          ? { ...c, status: 'published' as const, publishedAt: new Date().toISOString() }
          : c
      );
      setContents(updated);
    }

    setPublishedTo(selected);
    setPublishing(false);

    const platformLabels = selected
      .map(p => PLATFORM_OPTIONS.find(opt => opt.id === p)?.label || p)
      .join('、');

    addMessage({
      id: `${Date.now()}-published`,
      role: 'assistant',
      content: `🎉 「${data.title}」已成功发布至 ${platformLabels}！数据每小时刷新一次，明天早上我会汇总一份数据简报给你。`,
      timestamp: new Date().toISOString(),
    });
    toast.success(`已发布至 ${selected.length} 个平台`);
  };

  const handleViewData = () => {
    // Push a mock data report card after a brief delay
    const mockReport: ReportData = {
      title: data.title,
      platform: publishedTo[0] || 'xiaohongshu',
      metrics: { views: 0, likes: 0, comments: 0, saves: 0 },
      sparkComment: '内容刚刚发布，数据正在统计中...',
      sparkAdvice: '内容刚发布，预计 1 小时后会有初步数据。建议关注首小时的互动率，这通常是判断爆款的关键指标。',
    };
    addMessage({
      id: `${Date.now()}-report`,
      role: 'assistant',
      content: '📊 内容刚发布，初步数据如下（每小时刷新）：',
      timestamp: new Date().toISOString(),
      reportData: mockReport as unknown as Record<string, unknown>,
    });
  };

  return (
    <div
      className={`rounded-xl border overflow-hidden spark-fade-in ${
        isSuccess
          ? 'border-green-300/60 bg-green-50/50'
          : 'border-spark-orange/40 bg-orange-50/40'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 border-b ${
          isSuccess
            ? 'bg-green-100/60 border-green-200/60'
            : 'bg-orange-100/50 border-orange-200/40'
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 size={16} className="text-green-700" />
        ) : (
          <Rocket size={16} className="text-spark-orange" />
        )}
        <div className="flex-1 min-w-0">
          <div
            className={`text-[12px] font-semibold leading-tight ${
              isSuccess ? 'text-green-800' : 'text-spark-orange'
            }`}
          >
            {isSuccess ? '✅ 已成功发布至选中平台' : '内容已就绪，请选择分发平台 🚀'}
          </div>
          <div
            className={`text-[11px] mt-0.5 truncate ${
              isSuccess ? 'text-green-700/70' : 'text-orange-700/70'
            }`}
          >
            {data.title}
          </div>
        </div>
      </div>

      {/* Platform selection */}
      <div className="p-3 bg-white space-y-2">
        {PLATFORM_OPTIONS.map(opt => {
          const checked = isSuccess ? publishedTo.includes(opt.id) : selected.includes(opt.id);
          const wasPublished = publishedTo.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => togglePlatform(opt.id)}
              disabled={publishing || isSuccess}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors text-left ${
                checked
                  ? `${opt.color} border-current`
                  : 'bg-white border-[#E5E4E2] text-[#999] hover:border-[#CCC]'
              } ${publishing || isSuccess ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span className="text-[18px]">{opt.emoji}</span>
              <span className="flex-1 text-[13px] font-medium">{opt.label}</span>
              {wasPublished && isSuccess && (
                <span className="text-[11px] flex items-center gap-0.5 text-green-700">
                  <Check size={12} /> 已发布
                </span>
              )}
              {checked && !isSuccess && (
                <div className="w-4 h-4 rounded-full bg-spark-orange flex items-center justify-center">
                  <Check size={11} className="text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="px-4 pb-3 pt-1 bg-white">
        {!isSuccess ? (
          <button
            onClick={handlePublish}
            disabled={publishing || selected.length === 0}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-spark-orange text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {publishing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                正在分发到 {selected.length} 个平台...
              </>
            ) : (
              <>
                <Rocket size={14} />
                一键发布{selected.length > 0 ? `（${selected.length}个平台）` : ''}
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleViewData}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white border border-green-300 text-green-700 text-[13px] font-medium hover:bg-green-50 transition-colors"
          >
            <BarChart3 size={14} />
            查看数据
          </button>
        )}
      </div>
    </div>
  );
}
