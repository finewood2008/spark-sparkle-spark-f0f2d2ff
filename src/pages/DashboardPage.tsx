import { useState } from 'react';
import {
  BarChart3, Upload, TrendingUp, TrendingDown,
  Eye, Heart, MessageCircle, Share2, Sparkles
} from 'lucide-react';

interface AnalysisResult {
  id: string;
  platform: string;
  metrics: { views: number; likes: number; comments: number; shares: number };
  aiInsight?: string;
  analyzedAt: string;
}

function MetricCard({ icon, label, value, trend }: {
  icon: React.ReactNode; label: string; value: string; trend?: number;
}) {
  return (
    <div className="spark-card p-4">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl bg-spark-warm flex items-center justify-center text-spark-orange">
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${trend >= 0 ? 'text-green-500' : 'text-destructive'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-spark-gray-800">{value}</div>
        <div className="text-xs text-spark-gray-400 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function ScreenshotCard({ result }: { result: AnalysisResult }) {
  return (
    <div className="spark-card p-4">
      <div className="flex gap-4 text-xs text-spark-gray-500">
        <span className="flex items-center gap-1"><Eye size={12} /> {result.metrics.views}</span>
        <span className="flex items-center gap-1"><Heart size={12} /> {result.metrics.likes}</span>
        <span className="flex items-center gap-1"><MessageCircle size={12} /> {result.metrics.comments}</span>
      </div>
      {result.aiInsight && (
        <div className="mt-2 text-xs text-spark-gray-600 bg-spark-warm rounded-lg p-2.5 flex items-start gap-1.5">
          <Sparkles size={12} className="text-spark-orange shrink-0 mt-0.5" />
          {result.aiInsight}
        </div>
      )}
      <div className="mt-2 text-[10px] text-spark-gray-400">
        {new Date(result.analyzedAt).toLocaleDateString('zh-CN')}
      </div>
    </div>
  );
}

// Mock data
const mockReports: AnalysisResult[] = [
  { id: '1', platform: 'xiaohongshu', metrics: { views: 12500, likes: 890, comments: 156, shares: 67 }, aiInsight: '封面图用暖色调效果更好，标题加数字可提升点击率15%', analyzedAt: '2026-04-14T10:00:00Z' },
  { id: '2', platform: 'wechat', metrics: { views: 8300, likes: 420, comments: 89, shares: 234 }, aiInsight: '推送时间建议调整到晚8点，阅读量预计提升20%', analyzedAt: '2026-04-13T10:00:00Z' },
];

export default function DashboardPage() {
  const [reports] = useState<AnalysisResult[]>(mockReports);

  const totalViews = reports.reduce((s, r) => s + r.metrics.views, 0);
  const totalLikes = reports.reduce((s, r) => s + r.metrics.likes, 0);
  const totalComments = reports.reduce((s, r) => s + r.metrics.comments, 0);
  const totalShares = reports.reduce((s, r) => s + r.metrics.shares, 0);

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-xl font-bold text-spark-gray-800 mb-1">数据看板</h1>
      <p className="text-sm text-spark-gray-400 mb-6">追踪内容表现，AI 帮你找出优化方向</p>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard icon={<Eye size={18} />} label="总浏览" value={totalViews.toLocaleString()} trend={12} />
        <MetricCard icon={<Heart size={18} />} label="总点赞" value={totalLikes.toLocaleString()} trend={8} />
        <MetricCard icon={<MessageCircle size={18} />} label="总评论" value={totalComments.toLocaleString()} trend={-3} />
        <MetricCard icon={<Share2 size={18} />} label="总分享" value={totalShares.toLocaleString()} trend={15} />
      </div>

      {/* Upload zone */}
      <div className="spark-card p-6 mb-6 text-center border-dashed cursor-pointer hover:border-spark-orange hover:bg-spark-warm/50 transition-colors">
        <Upload size={28} className="mx-auto text-spark-gray-300 mb-2" />
        <p className="text-sm font-medium text-spark-gray-600">上传数据截图</p>
        <p className="text-xs text-spark-gray-400 mt-1">截图各平台的数据页面，AI 自动识别并分析</p>
      </div>

      {/* Analysis results */}
      <h2 className="font-semibold text-sm text-spark-gray-700 mb-3 flex items-center gap-2">
        <BarChart3 size={16} className="text-spark-orange" />
        分析记录
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {reports.map(r => <ScreenshotCard key={r.id} result={r} />)}
      </div>
    </div>
  );
}
