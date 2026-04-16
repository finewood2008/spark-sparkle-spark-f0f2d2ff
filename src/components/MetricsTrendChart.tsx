import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Loader2, TrendingUp, Inbox } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MetricsTrendChartProps {
  reviewItemId: string;
}

interface MetricRow {
  fetched_at: string;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
}

interface ChartPoint {
  time: string;
  fullTime: string;
  views: number;
  likes: number;
  comments: number;
  saves: number;
}

const METRIC_COLORS = {
  views: 'oklch(0.65 0.18 50)', // orange
  likes: 'oklch(0.6 0.22 25)', // red
  comments: 'oklch(0.6 0.18 250)', // blue
  saves: 'oklch(0.6 0.18 150)', // green
} as const;

const METRIC_LABELS = {
  views: '浏览',
  likes: '点赞',
  comments: '评论',
  saves: '收藏',
} as const;

function formatTick(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}-${day} ${hh}:${mm}`;
}

function formatFull(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN');
}

export default function MetricsTrendChart({ reviewItemId }: MetricsTrendChartProps) {
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('content_metrics')
        .select('fetched_at, views, likes, comments, saves, shares')
        .eq('review_item_id', reviewItemId)
        .eq('platform', 'all')
        .order('fetched_at', { ascending: true })
        .limit(200);

      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as MetricRow[];
      setPoints(
        rows.map(r => ({
          time: formatTick(r.fetched_at),
          fullTime: formatFull(r.fetched_at),
          views: r.views,
          likes: r.likes,
          comments: r.comments,
          saves: r.saves,
        })),
      );
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reviewItemId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background/40 p-4 flex items-center justify-center h-48 text-muted-foreground text-sm">
        <Loader2 size={16} className="animate-spin mr-2" />
        加载趋势数据...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-700">
        加载失败：{error}
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 flex flex-col items-center justify-center h-32 text-muted-foreground">
        <Inbox size={20} className="mb-1.5 opacity-50" />
        <span className="text-xs">暂无指标数据 — 桌面客户端拉取后会自动出现</span>
      </div>
    );
  }

  const latest = points[points.length - 1];
  const first = points[0];
  const viewsDelta = latest.views - first.views;
  const showSingle = points.length === 1;

  return (
    <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <TrendingUp size={14} className="text-primary" />
          数据趋势
          <span className="text-xs text-muted-foreground font-normal ml-1">
            （{points.length} 次采样）
          </span>
        </div>
        {!showSingle && viewsDelta > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
            浏览 +{viewsDelta.toLocaleString()}
          </span>
        )}
      </div>

      {showSingle ? (
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(METRIC_LABELS) as (keyof typeof METRIC_LABELS)[]).map(k => (
            <div key={k} className="rounded-lg bg-muted/50 px-2 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">{METRIC_LABELS[k]}</div>
              <div
                className="text-base font-semibold mt-0.5"
                style={{ color: METRIC_COLORS[k] }}
              >
                {latest[k].toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-48 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0 0)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }}
                tickLine={false}
                axisLine={{ stroke: 'oklch(0.9 0 0)' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }}
                tickLine={false}
                axisLine={{ stroke: 'oklch(0.9 0 0)' }}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid oklch(0.9 0 0)',
                  fontSize: 12,
                }}
                labelFormatter={(_label, payload) => {
                  const p = payload?.[0]?.payload as ChartPoint | undefined;
                  return p?.fullTime ?? '';
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                iconType="circle"
                iconSize={8}
              />
              {(Object.keys(METRIC_LABELS) as (keyof typeof METRIC_LABELS)[]).map(k => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  name={METRIC_LABELS[k]}
                  stroke={METRIC_COLORS[k]}
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground text-right">
        最近采样：{latest.fullTime}
      </div>
    </div>
  );
}
