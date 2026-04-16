import { Settings, CheckCircle2, Sparkles } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-spark-gray-800 mb-1 flex items-center gap-2">
        <Settings size={20} className="text-spark-orange" />
        系统设置
      </h1>
      <p className="text-sm text-spark-gray-400 mb-6">AI 引擎已由系统统一管理</p>

      <div className="spark-card p-5 mb-4">
        <h2 className="font-semibold text-sm text-spark-gray-700 mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-spark-orange" />
          AI 引擎
        </h2>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-spark-gray-50 border border-spark-gray-100">
          <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
          <div className="text-sm text-spark-gray-700 leading-relaxed">
            <div className="font-medium">已接入 Google Gemini</div>
            <div className="text-xs text-spark-gray-500 mt-1">
              文字模型：Gemini 2.5 Flash · 图像模型：Imagen 3<br />
              密钥由后端统一管理，无需配置即可使用所有 AI 能力。
            </div>
          </div>
        </div>
      </div>

      <div className="spark-card p-5 text-xs text-spark-gray-500 leading-relaxed">
        如需更换密钥或额度告罄，请联系管理员在后端密钥管理中更新 <code className="px-1 py-0.5 rounded bg-spark-gray-100 text-spark-gray-700">GOOGLE_GEMINI_API_KEY</code>。
      </div>
    </div>
  );
}
