import { useState, useEffect } from 'react';
import { Plus, X, Loader2, Sparkles, Globe, CheckCircle2, AlertCircle, Save, ImageOff, Check, Trash2, FilePlus2 } from 'lucide-react';
import { useMemoryStore } from '@/store/memoryStore';
import { useMemoryV2 } from '@/hooks/useMemoryV2';
import type { BrandProfile, AnalysisResult, VisualIdentity } from '@/types/memory';
import { toast } from 'sonner';

const emptyProfile: BrandProfile = {
  brandDoc: '',
  visualIdentity: {},
  sourceUrls: [],
  initialized: false,
};

const EMPTY_DOC_TEMPLATE = `# 品牌名称

## 一句话定位 / Positioning


## 主营业务 / Main Business


## 目标客户 / Target Customer


## 差异化价值 / Differentiation


## 语气风格 / Tone of Voice


## 品牌关键词 / Keywords
- 

## 禁用词 / Words to Avoid
- 无

## 品牌故事 / Brand Story

`;

const inputClass =
  'w-full text-[13px] text-[#333] border border-[#E5E4E2] rounded-lg px-3 py-2 outline-none focus:border-orange-400 bg-white transition-colors placeholder:text-[#CCC]';

function VisualAssetGrid({ visual }: { visual: VisualIdentity }) {
  const hasAnything =
    visual.logo ||
    visual.favicon ||
    visual.ogImage ||
    visual.colors ||
    visual.fonts?.length;

  if (!hasAnything) return null;

  const colorEntries = visual.colors
    ? Object.entries(visual.colors).filter(([, v]) => typeof v === 'string' && v)
    : [];

  return (
    <section className="border border-[#E5E4E2] rounded-2xl p-3 bg-white space-y-3">
      <div className="text-[12px] font-medium text-[#666]">视觉资产 / Visual Identity</div>

      {/* Images row */}
      {(visual.logo || visual.favicon || visual.ogImage) && (
        <div className="grid grid-cols-3 gap-2">
          {(['logo', 'favicon', 'ogImage'] as const).map((key) => {
            const url = visual[key];
            return (
              <div key={key} className="space-y-1">
                <div className="text-[10px] text-[#999] uppercase tracking-wide">{key}</div>
                <div className="aspect-square border border-[#F0EFED] rounded-lg flex items-center justify-center bg-[#FAFAF8] overflow-hidden">
                  {url ? (
                    <img
                      src={url}
                      alt={key}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <ImageOff size={16} className="text-[#CCC]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Colors */}
      {colorEntries.length > 0 && (
        <div>
          <div className="text-[10px] text-[#999] uppercase tracking-wide mb-1">Colors</div>
          <div className="flex flex-wrap gap-1.5">
            {colorEntries.map(([name, hex]) => (
              <div
                key={name}
                className="flex items-center gap-1.5 border border-[#F0EFED] rounded-md px-1.5 py-1"
                title={`${name}: ${hex}`}
              >
                <div
                  className="w-4 h-4 rounded border border-[#E5E4E2]"
                  style={{ background: hex as string }}
                />
                <span className="text-[10px] text-[#666] font-mono">{hex as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fonts */}
      {visual.fonts && visual.fonts.length > 0 && (
        <div>
          <div className="text-[10px] text-[#999] uppercase tracking-wide mb-1">Fonts</div>
          <div className="flex flex-wrap gap-1">
            {visual.fonts.map((f) => (
              <span
                key={f}
                className="text-[11px] px-2 py-0.5 bg-[#F0EFED] text-[#666] rounded"
                style={{ fontFamily: f }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function BrandProfileTab() {
  const brandProfile = useMemoryStore((s) => s.brandProfile);
  const brandProfiles = useMemoryStore((s) => s.brandProfiles);
  const sourceUrls = useMemoryStore((s) => s.sourceUrls);
  const isAnalyzing = useMemoryStore((s) => s.isAnalyzing);
  const addSourceUrl = useMemoryStore((s) => s.addSourceUrl);
  const removeSourceUrl = useMemoryStore((s) => s.removeSourceUrl);
  const setSourceUrls = useMemoryStore((s) => s.setSourceUrls);
  const { analyzeUrls, saveAnalysisResult, activateBrandProfile, deleteBrandProfile } = useMemoryV2();

  const [urlInput, setUrlInput] = useState('');
  const [form, setForm] = useState<BrandProfile>(brandProfile ?? emptyProfile);
  const [dirty, setDirty] = useState(false);
  const [analysisPreview, setAnalysisPreview] = useState<AnalysisResult | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (brandProfile) {
      setForm(brandProfile);
      setDirty(false);
    } else {
      setForm(emptyProfile);
      setDirty(false);
    }
  }, [brandProfile]);

  const update = (patch: Partial<BrandProfile>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  const normalizeUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const handleAddUrl = () => {
    const url = normalizeUrl(urlInput);
    if (!url) return;
    if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(url)) {
      toast.error('请输入有效的网址');
      return;
    }
    if (sourceUrls.some((s) => s.url === url)) {
      toast.error('该 URL 已在列表中');
      return;
    }
    addSourceUrl({ url, status: 'pending' });
    setUrlInput('');
  };

  const handleAnalyze = async () => {
    const normalized = normalizeUrl(urlInput);
    if (normalized && !sourceUrls.some((s) => s.url === normalized)) {
      addSourceUrl({ url: normalized, status: 'pending' });
      setUrlInput('');
    }

    await new Promise((r) => setTimeout(r, 0));
    const currentUrls = useMemoryStore.getState().sourceUrls;
    const pending = currentUrls.filter((s) => s.status === 'pending' || s.status === 'error');
    const urls = pending.length > 0 ? pending.map((s) => s.url) : currentUrls.map((s) => s.url);
    if (urls.length === 0) {
      toast.error('请先添加至少一个 URL');
      return;
    }
    toast.info(`开始分析 ${urls.length} 个 URL...`);
    const result = await analyzeUrls(urls);
    if (result) {
      setAnalysisPreview(result);
      toast.success('分析完成，请在下方预览并保存');
    } else {
      toast.error('分析失败，请检查控制台');
    }
  };

  // Saving an analysis ALWAYS creates a new brand profile (and auto-activates it).
  const handleSaveAnalysis = async () => {
    if (!analysisPreview) return;
    await saveAnalysisResult(analysisPreview, { mode: 'create' });
    setAnalysisPreview(null);
    toast.success('已新建品牌档案并设为激活');
  };

  // Manual edit on Markdown body updates the CURRENTLY ACTIVE profile in place.
  const handleManualSave = async () => {
    const result: AnalysisResult = {
      brandDoc: form.brandDoc,
      visualIdentity: form.visualIdentity,
      writingPatterns: [],
    };
    await saveAnalysisResult(result, { mode: 'update', profileId: form.id });
    setDirty(false);
    toast.success('已更新当前品牌档案');
  };

  const handleActivate = async (id: string) => {
    if (!id) return;
    await activateBrandProfile(id);
    toast.success('已切换激活档案');
  };

  const handleDelete = async (id: string) => {
    await deleteBrandProfile(id);
    setConfirmDeleteId(null);
    toast.success('档案已删除');
  };

  // Reset URL list and analysis preview to start a fresh capture.
  const handleStartNew = () => {
    setSourceUrls([]);
    setAnalysisPreview(null);
    setUrlInput('');
    toast.info('请输入新品牌的 URL 开始分析');
  };

  const docValue = form.brandDoc || '';
  const showTemplate = !docValue && !brandProfile?.initialized;

  return (
    <div className="space-y-4">
      {/* ============= Firecrawl URL 分析区 ============= */}
      <section className="border border-[#E5E4E2] rounded-2xl p-4 bg-gradient-to-br from-orange-50/50 to-white">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-orange-500" />
          <h3 className="text-[14px] font-medium text-[#333]">从网页自动生成品牌档案</h3>
        </div>
        <p className="text-[11px] text-[#999] mb-3">
          输入官网或主页链接，AI 会抓取内容、LOGO、品牌色，生成可编辑的 Markdown 档案
        </p>

        <div className="flex gap-2 mb-2">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
            placeholder="www.example.com"
            className={inputClass}
          />
          <button
            onClick={handleAddUrl}
            className="px-3 py-2 bg-white border border-[#E5E4E2] rounded-xl text-[12px] text-[#666] hover:bg-[#F0EFED] transition-colors whitespace-nowrap"
          >
            <Plus size={12} className="inline mr-0.5" />
            添加
          </button>
        </div>

        {sourceUrls.length > 0 && (
          <div className="space-y-1 mb-2">
            {sourceUrls.map((s) => (
              <div
                key={s.url}
                className="flex items-center gap-2 text-[11px] bg-white rounded-lg px-2.5 py-1 border border-[#F0EFED]"
              >
                {s.status === 'fetching' && <Loader2 size={11} className="text-orange-500 animate-spin" />}
                {s.status === 'done' && <CheckCircle2 size={11} className="text-green-500" />}
                {s.status === 'error' && <AlertCircle size={11} className="text-red-500" />}
                {s.status === 'pending' && <Globe size={11} className="text-[#999]" />}
                <span className="flex-1 truncate text-[#666]" title={s.url}>
                  {s.url}
                </span>
                {s.error && <span className="text-red-500 text-[10px]">{s.error}</span>}
                <button
                  onClick={() => removeSourceUrl(s.url)}
                  className="text-[#CCC] hover:text-red-500 transition-colors"
                  aria-label="移除"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || (sourceUrls.length === 0 && !/^https?:\/\//i.test(normalizeUrl(urlInput)))}
          className="w-full py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-xl text-[13px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 size={14} className="animate-spin" /> 分析中...
            </>
          ) : (
            <>
              <Sparkles size={14} /> 开始分析
            </>
          )}
        </button>

        {analysisPreview && (
          <div className="mt-3 border border-orange-200 rounded-xl p-3 bg-orange-50/50 space-y-2">
            <div className="text-[12px] font-medium text-[#333]">分析结果预览</div>
            <div className="text-[11px] text-[#666] max-h-32 overflow-auto whitespace-pre-wrap font-mono leading-relaxed">
              {analysisPreview.brandDoc.slice(0, 600)}
              {analysisPreview.brandDoc.length > 600 ? '...' : ''}
            </div>
            <div className="text-[11px] text-[#999]">
              视觉资产：
              {analysisPreview.visualIdentity.logo ? '✓ LOGO ' : ''}
              {analysisPreview.visualIdentity.favicon ? '✓ Favicon ' : ''}
              {analysisPreview.visualIdentity.colors ? '✓ 品牌色 ' : ''}
              {analysisPreview.visualIdentity.fonts?.length ? '✓ 字体 ' : ''}
              · 写作偏好 {analysisPreview.writingPatterns.length} 条
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveAnalysis}
                className="flex-1 py-1.5 bg-orange-500 text-white rounded-lg text-[12px] hover:bg-orange-600 transition-colors"
              >
                保存并应用
              </button>
              <button
                onClick={() => setAnalysisPreview(null)}
                className="px-3 py-1.5 bg-white border border-[#E5E4E2] rounded-lg text-[12px] text-[#666] hover:bg-[#F0EFED] transition-colors"
              >
                丢弃
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ============= 视觉资产预览 ============= */}
      <VisualAssetGrid visual={form.visualIdentity} />

      {/* ============= 品牌档案 Markdown 编辑器 ============= */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-[#333]">品牌档案（Markdown）</h3>
          {dirty && (
            <button
              onClick={handleManualSave}
              className="px-2.5 py-1 bg-orange-500 text-white rounded-md text-[11px] flex items-center gap-1 hover:bg-orange-600 transition-colors"
            >
              <Save size={11} /> 保存
            </button>
          )}
        </div>
        <p className="text-[11px] text-[#999]">
          AI 抓取后会自动填入。也可以手动编辑——这段文本会作为品牌上下文注入到所有生成中。
        </p>
        <textarea
          value={docValue}
          onChange={(e) => update({ brandDoc: e.target.value })}
          placeholder={showTemplate ? EMPTY_DOC_TEMPLATE : '点击「开始分析」自动生成，或手动输入品牌信息...'}
          className={`${inputClass} font-mono text-[12px] leading-relaxed min-h-[400px] resize-y`}
          spellCheck={false}
        />
        <div className="text-[10px] text-[#CCC] text-right">
          {docValue.length} 字符
        </div>
      </section>
    </div>
  );
}

export default BrandProfileTab;
