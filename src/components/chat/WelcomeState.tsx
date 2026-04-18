import { useState, useEffect } from 'react';
import { SparkAvatar } from './ChatAtoms';
import DataReportCard, { type ReportData } from '../DataReportCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '../../store/authStore';
import type { Platform } from '../../types/spark';

export function WelcomeState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadLatestReport = async () => {
      const { user, isAuthenticated } = useAuthStore.getState();
      // Find the most recent published item
      let itemsQuery = supabase
        .from('review_items')
        .select('id, title, platform, published_platforms, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1);
      itemsQuery = isAuthenticated && user?.id
        ? itemsQuery.eq('user_id', user.id)
        : itemsQuery.is('user_id', null).eq('device_id', 'default');

      const { data: items } = await itemsQuery;
      if (cancelled) return;
      const latest = items?.[0];
      if (!latest) {
        setLoading(false);
        return;
      }

      // Fetch aggregated metrics for that item
      const { data: metricsRows } = await supabase
        .from('content_metrics')
        .select('*')
        .eq('review_item_id', latest.id)
        .eq('platform', 'all')
        .order('fetched_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      const m = metricsRows?.[0];
      if (!m) {
        setLoading(false);
        return;
      }

      // Fetch 7-day growth + AI insight (best-effort, non-blocking on failure)
      const { data: analysis } = await supabase.functions
        .invoke('analyze-metrics', {
          body: { contentId: latest.id, title: latest.title },
        })
        .catch(err => {
          console.error('[welcome] analyze-metrics failed:', err);
          return { data: null };
        });
      if (cancelled) return;
      const a = (analysis ?? null) as {
        hasData?: boolean;
        sampleCount?: number;
        growth?: { views: number; likes: number; comments: number; saves: number };
        insight?: string;
      } | null;

      setReport({
        title: latest.title || '(无标题)',
        platform: (latest.platform as Platform) || 'xiaohongshu',
        metrics: {
          views: m.views || 0,
          likes: m.likes || 0,
          comments: m.comments || 0,
          saves: m.saves || 0,
        },
        sparkComment: '',
        sparkAdvice: m.ai_insight || '',
        growth: a?.growth,
        growthSampleCount: a?.sampleCount,
        aiInsight: a?.insight,
      });
      setLoading(false);
    };
    loadLatestReport();
    return () => { cancelled = true; };
  }, []);

  const suggestions = report
    ? [
        '帮我写一篇类似风格的新内容',
        '分析一下这条内容为什么表现好',
      ]
    : [
        '帮我写一篇小红书种草笔记',
        '推荐几个最近热门的选题方向',
      ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {/* Spark greeting */}
        <div className="flex items-start gap-3">
          <SparkAvatar size={32} />
          <div className="chat-bubble-assistant px-4 py-3 max-w-[80%]">
            <p className="text-[14px] leading-[1.6] text-[#333]">
              {loading
                ? '早上好 ☀️ 我正在拉取最近的发布数据……'
                : report
                  ? '早上好 ☀️ 这是你最近一条发布内容的真实数据回流：'
                  : '早上好 ☀️ 我是火花，你的内容创作搭子。还没有发布过内容，告诉我你想做什么吧～'}
            </p>
          </div>
        </div>

        {/* Real data report card (only if real data exists) */}
        {report && (
          <div className="flex items-start gap-3">
            <SparkAvatar size={32} />
            <div className="flex-1 min-w-0 max-w-[85%]">
              <DataReportCard data={report} />
            </div>
          </div>
        )}

        {/* Spark suggestion */}
        {!loading && (
          <div className="flex items-start gap-3">
            <SparkAvatar size={32} />
            <div className="chat-bubble-assistant px-4 py-3 max-w-[80%]">
              <p className="text-[14px] leading-[1.6] text-[#333]">
                {report
                  ? '基于这条内容的表现，要不要我帮你顺势再写一篇？告诉我你想做什么吧～'
                  : '我可以帮你写小红书 / 公众号 / 抖音脚本，做选题分析，还能定时自动生成内容。告诉我你想做什么吧～'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
