import { Sparkles, CheckCircle2 } from 'lucide-react';

export default function AIEngineCard() {
  return (
    <div className="rounded-2xl bg-card shadow-lg border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          AI 引擎
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">由后端统一管理密钥，开箱即用</p>
      </div>
      <div className="px-6 py-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border">
          <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
          <div className="text-sm text-foreground leading-relaxed">
            <div className="font-medium">已接入 Google Gemini</div>
            <div className="text-xs text-muted-foreground mt-1">
              文字模型：Gemini 2.5 Flash · 图像模型：Gemini 2.5 Flash Image
              <br />
              如需更换密钥或额度告罄，请联系管理员在后端密钥管理中更新{' '}
              <code className="px-1 py-0.5 rounded bg-muted text-foreground">
                GOOGLE_GEMINI_API_KEY
              </code>
              。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
