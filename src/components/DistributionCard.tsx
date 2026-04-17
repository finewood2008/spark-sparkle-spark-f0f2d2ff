import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, BarChart3, Rocket, Check, Eye } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { loadUserPrefs } from '../lib/user-prefs';
import { supabase } from '@/integrations/supabase/client';
import type { Platform, DistributionData } from '../types/spark';
import type { ReportData } from './DataReportCard';
import PlatformPreview from './PlatformPreview';
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
  const [fetchingTest, setFetchingTest] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<Platform | null>(initialDefaults[0] ?? null);

  // Keep preview tab in sync with selection (auto-pick first selected if current is unselected)
  useEffect(() => {
    if (publishedTo.length > 0) {
      if (!previewPlatform || !publishedTo.includes(previewPlatform)) {
        setPreviewPlatform(publishedTo[0]);
      }
      return;
    }
    if (selected.length === 0) {
      setPreviewPlatform(null);
    } else if (!previewPlatform || !selected.includes(previewPlatform)) {
      setPreviewPlatform(selected[0]);
    }
  }, [selected, publishedTo, previewPlatform]);

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
    if (!item) {
      toast.error('内容不存在，无法发布');
      return;
    }
    setPublishing(true);

    // 1. 拼接剪贴板文本：标题 + 正文 + 标签 + CTA
    const tagLine = item.tags?.length ? item.tags.map(t => `#${t}`).join(' ') : '';
    const clipboardText = [
      item.title,
      '',
      item.content,
      '',
      tagLine,
      '',
      item.cta || '',
    ]
      .filter((line, idx, arr) => {
        // 去掉末尾连续空行，但保留中间空行
        if (line !== '') return true;
        return idx < arr.length - 1 && arr[idx + 1] !== '';
      })
      .join('\n')
      .trimEnd();

    // 2. 复制到剪贴板
    let copied = false;
    try {
      await navigator.clipboard.writeText(clipboardText);
      copied = true;
    } catch (err) {
      console.error('[distribution] clipboard write failed:', err);
    }

    // 3. 平台元信息（发布页 URL + 中文名）
    const PLATFORM_META: Record<Platform, { name: string; url: string | null }> = {
      xiaohongshu: { name: '小红书', url: 'https://creator.xiaohongshu.com/publish/publish' },
      douyin: { name: '抖音', url: 'https://creator.douyin.com/creator-micro/content/upload' },
      wechat: { name: '微信公众号', url: 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit' },
      tiktok: { name: 'TikTok', url: 'https://www.tiktok.com/creator#/upload' },
      instagram: { name: 'Instagram', url: null }, // 移动端 only
    };

    // 4. 为每个选中的平台打开发布页
    const blockedLinks: { name: string; url: string }[] = [];
    const hasInstagram = selected.includes('instagram' as Platform);

    for (const platform of selected) {
      const meta = PLATFORM_META[platform];
      if (!meta || !meta.url) continue;
      const win = window.open(meta.url, '_blank', 'noopener,noreferrer');
      if (!win) {
        blockedLinks.push({ name: meta.name, url: meta.url });
      }
    }

    // 5. 持久化到 Supabase
    const publishedAt = new Date().toISOString();
    const updated = contents.map(c =>
      c.id === item.id
        ? { ...c, status: 'published' as const, publishedAt }
        : c
    );
    setContents(updated);

    try {
      await supabase
        .from('review_items')
        .update({
          status: 'published',
          published_at: publishedAt,
          published_platforms: selected,
        })
        .eq('id', data.contentId);
    } catch (err) {
      console.error('[distribution] failed to persist published_at:', err);
    }

    setPublishedTo(selected);
    setPublishing(false);

    const platformLabels = selected
      .map(p => PLATFORM_META[p]?.name || p)
      .join('、');

    addMessage({
      id: `${Date.now()}-published`,
      role: 'assistant',
      content: `🎉 「${data.title}」已成功发布至 ${platformLabels}！我会在 24 小时后自动拉取各平台的真实互动数据并推送给你 📊`,
      timestamp: new Date().toISOString(),
    });

    // 6. Toast 反馈
    if (blockedLinks.length > 0) {
      // 浏览器阻止了弹窗 — 在 toast 里给出可点击链接
      toast.warning(
        `浏览器阻止了 ${blockedLinks.length} 个弹窗，请手动打开：\n` +
          blockedLinks.map(l => `${l.name}: ${l.url}`).join('\n'),
        { duration: 12000 },
      );
    } else if (copied) {
      toast.success('✅ 内容已复制到剪贴板，平台发布页已打开，粘贴即可发布！');
    } else {
      toast.success('✅ 平台发布页已打开（剪贴板复制失败，请手动复制内容）');
    }

    if (hasInstagram) {
      toast.info('📱 Instagram 需要在手机 App 中发布', { duration: 8000 });
    }
  };

  const handleTestFetchNow = async () => {
    setFetchingTest(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('fetch-metrics', {
        body: { force: true, contentId: data.contentId },
      });
      if (error) throw error;
      const processed = (result as { processed?: number })?.processed ?? 0;
      if (processed > 0) {
        toast.success(`✨ 已拉取 ${processed} 条内容数据，请稍候查看对话流`);
      } else {
        toast.info('暂无可拉取的已发布内容');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '拉取失败';
      toast.error(`拉取失败：${msg}`);
    } finally {
      setFetchingTest(false);
    }
  };

  const handleViewData = async () => {
    if (loadingReport) return;
    setLoadingReport(true);
    try {
      // Pull real metrics from content_metrics (aggregate "all" row preferred)
      const { data: rows, error } = await supabase
        .from('content_metrics')
        .select('*')
        .eq('review_item_id', data.contentId)
        .order('fetched_at', { ascending: false })
        .limit(10);
      if (error) throw error;

      const aggregate = rows?.find(r => r.platform === 'all') || rows?.[0];

      if (!aggregate) {
        toast.info('暂无数据，请点「立即拉取」获取最新指标');
        return;
      }

      // In parallel: ask analyze-metrics for 7-day growth + AI insight
      const analysisPromise = supabase.functions
        .invoke('analyze-metrics', {
          body: { contentId: data.contentId, title: data.title },
        })
        .catch(err => {
          console.error('[distribution] analyze-metrics failed:', err);
          return { data: null, error: err };
        });

      const { data: analysis } = await analysisPromise;
      const analysisData = (analysis ?? null) as {
        hasData?: boolean;
        sampleCount?: number;
        growth?: { views: number; likes: number; comments: number; saves: number };
        insight?: string;
      } | null;

      const report: ReportData = {
        title: data.title,
        platform: (aggregate.platform === 'all'
          ? publishedTo[0] || 'xiaohongshu'
          : aggregate.platform) as Platform,
        metrics: {
          views: aggregate.views ?? 0,
          likes: aggregate.likes ?? 0,
          comments: aggregate.comments ?? 0,
          saves: aggregate.saves ?? 0,
        },
        sparkComment: aggregate.ai_insight || '数据已就绪',
        sparkAdvice: aggregate.ai_insight || undefined,
        growth: analysisData?.growth,
        growthSampleCount: analysisData?.sampleCount,
        aiInsight: analysisData?.insight,
      };

      const fetchedLabel = new Date(aggregate.fetched_at).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      const hasTrend = !!analysisData?.growth && (analysisData.sampleCount ?? 0) >= 2;
      const headerText = hasTrend
        ? `📊 「${data.title}」近 7 天数据 & 增长趋势（最新更新于 ${fetchedLabel}）：`
        : `📊 「${data.title}」最新数据（更新于 ${fetchedLabel}）：`;

      addMessage({
        id: `${Date.now()}-report`,
        role: 'assistant',
        content: headerText,
        timestamp: new Date().toISOString(),
        reportData: report as unknown as Record<string, unknown>,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败';
      toast.error(`加载数据失败：${msg}`);
    } finally {
      setLoadingReport(false);
    }
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

      {/* Platform-specific preview */}
      {item && previewPlatform && (selected.length > 0 || isSuccess) && (
        <div className="px-3 pb-3 bg-white border-t border-gray-100 pt-2.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Eye size={12} className="text-[#999]" />
              <span className="text-[11px] text-[#666] font-medium">发布前预览</span>
            </div>
            {(isSuccess ? publishedTo : selected).length > 1 && (
              <div className="flex gap-1 p-0.5 rounded-md bg-gray-100">
                {(isSuccess ? publishedTo : selected).map((p) => {
                  const opt = PLATFORM_OPTIONS.find((o) => o.id === p);
                  if (!opt) return null;
                  const active = previewPlatform === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPreviewPlatform(p)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        active ? 'bg-white text-[#333] shadow-sm' : 'text-[#999] hover:text-[#666]'
                      }`}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <PlatformPreview item={item} platform={previewPlatform} />
        </div>
      )}

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
          <div className="flex gap-2">
            <button
              onClick={handleViewData}
              disabled={loadingReport}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white border border-green-300 text-green-700 text-[13px] font-medium hover:bg-green-50 transition-colors disabled:opacity-60"
            >
              {loadingReport ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
              查看数据
            </button>
            <button
              onClick={handleTestFetchNow}
              disabled={fetchingTest}
              title="立即触发数据回流（开发测试用，正式环境会在 24 小时后自动触发）"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[12px] font-medium hover:bg-blue-100 transition-colors disabled:opacity-60"
            >
              {fetchingTest ? <Loader2 size={12} className="animate-spin" /> : '⚡'}
              立即拉取
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
