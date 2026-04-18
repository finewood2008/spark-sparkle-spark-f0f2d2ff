import { useState, useEffect } from 'react';
import { Plus, X, Loader2, Sparkles, Globe, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { useMemoryStore } from '@/store/memoryStore';
import { useMemoryV2 } from '@/hooks/useMemoryV2';
import type { BrandProfile, AnalysisResult } from '@/types/memory';
import { toast } from 'sonner';

const emptyProfile: BrandProfile = {
  brandName: '',
  industry: '',
  mainBusiness: '',
  targetCustomer: '',
  differentiation: '',
  toneOfVoice: '',
  keywords: [],
  tabooWords: [],
  brandStory: '',
  sourceUrls: [],
  initialized: false,
};

const fieldClass =
  'w-full text-[13px] text-[#333] border border-[#E5E4E2] rounded-lg px-3 py-2 outline-none focus:border-orange-400 bg-white transition-colors placeholder:text-[#CCC]';

export function BrandProfileTab() {
  const brandProfile = useMemoryStore((s) => s.brandProfile);
  const sourceUrls = useMemoryStore((s) => s.sourceUrls);
  const isAnalyzing = useMemoryStore((s) => s.isAnalyzing);
  const addSourceUrl = useMemoryStore((s) => s.addSourceUrl);
  const removeSourceUrl = useMemoryStore((s) => s.removeSourceUrl);
  const { analyzeUrls, saveAnalysisResult } = useMemoryV2();

  const [urlInput, setUrlInput] = useState('');
  const [form, setForm] = useState<BrandProfile>(brandProfile ?? emptyProfile);
  const [keywordInput, setKeywordInput] = useState('');
  const [tabooInput, setTabooInput] = useState('');
  const [dirty, setDirty] = useState(false);
  const [analysisPreview, setAnalysisPreview] = useState<AnalysisResult | null>(null);

  // sync when profile loads
  useEffect(() => {
    if (brandProfile) {
      setForm(brandProfile);
      setDirty(false);
    }
  }, [brandProfile]);

  const update = (patch: Partial<BrandProfile>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  const addKeyword = () => {
    const k = keywordInput.trim();
    if (k && !form.keywords.includes(k)) update({ keywords: [...form.keywords, k] });
    setKeywordInput('');
  };

  const addTaboo = () => {
    const t = tabooInput.trim();
    if (t && !form.tabooWords.includes(t)) update({ tabooWords: [...form.tabooWords, t] });
    setTabooInput('');
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
    // If user typed a URL but didn't click "添加", add it automatically
    const normalized = normalizeUrl(urlInput);
    if (normalized && !sourceUrls.some((s) => s.url === normalized)) {
      addSourceUrl({ url: normalized, status: 'pending' });
      setUrlInput('');
    }

    // Re-read store after potential auto-add (use setTimeout to let state settle)
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

  const handleSaveAnalysis = async () => {
    if (!analysisPreview) return;
    await saveAnalysisResult(analysisPreview);
    setAnalysisPreview(null);
    toast.success('品牌档案已保存');
  };

  const handleManualSave = async () => {
    // Build an AnalysisResult-shape from form and save
    const result: AnalysisResult = {
      brandName: form.brandName,
      industry: form.industry,
      mainBusiness: form.mainBusiness,
      targetCustomer: form.targetCustomer,
      differentiation: form.differentiation,
      toneOfVoice: form.toneOfVoice,
      keywords: form.keywords,
      tabooWords: form.tabooWords,
      brandStory: form.brandStory ?? '',
      writingPatterns: [],
    };
    await saveAnalysisResult(result);
    setDirty(false);
    toast.success('品牌档案已手动保存');
  };

  return (
    <div className="space-y-6">
      {/* ============= Firecrawl URL 分析区 ============= */}
      <section className="border border-[#E5E4E2] rounded-2xl p-4 bg-gradient-to-br from-orange-50/50 to-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-orange-500" />
          <h3 className="text-[15px] font-medium text-[#333]">从网页自动分析品牌</h3>
        </div>
        <p className="text-[12px] text-[#999] mb-3">
          输入你的官网、小红书/抖音主页或公众号文章链接，AI 会抓取并提炼品牌档案与写作偏好
        </p>

        <div className="flex gap-2 mb-3">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
            placeholder="www.example.com 或 https://..."
            className={fieldClass}
          />
          <button
            onClick={handleAddUrl}
            className="px-4 py-2 bg-white border border-[#E5E4E2] rounded-xl text-[13px] text-[#666] hover:bg-[#F0EFED] transition-colors whitespace-nowrap"
          >
            <Plus size={14} className="inline mr-1" />
            添加
          </button>
        </div>

        {/* URL 列表 */}
        {sourceUrls.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {sourceUrls.map((s) => (
              <div
                key={s.url}
                className="flex items-center gap-2 text-[12px] bg-white rounded-lg px-3 py-1.5 border border-[#F0EFED]"
              >
                {s.status === 'fetching' && (
                  <Loader2 size={12} className="text-orange-500 animate-spin" />
                )}
                {s.status === 'done' && <CheckCircle2 size={12} className="text-green-500" />}
                {s.status === 'error' && <AlertCircle size={12} className="text-red-500" />}
                {s.status === 'pending' && <Globe size={12} className="text-[#999]" />}
                <span className="flex-1 truncate text-[#666]" title={s.url}>
                  {s.url}
                </span>
                {s.error && <span className="text-red-500 text-[11px]">{s.error}</span>}
                <button
                  onClick={() => removeSourceUrl(s.url)}
                  className="text-[#CCC] hover:text-red-500 transition-colors"
                  aria-label="移除"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || (sourceUrls.length === 0 && !/^https?:\/\//i.test(urlInput.trim()))}
          className="w-full py-2.5 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-xl text-[13px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
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

        {/* 分析结果预览 */}
        {analysisPreview && (
          <div className="mt-4 border border-orange-200 rounded-xl p-3 bg-orange-50/50">
            <div className="text-[13px] font-medium text-[#333] mb-2">分析结果预览</div>
            <div className="text-[12px] text-[#666] space-y-1">
              <div>
                <span className="text-[#999]">品牌：</span>
                {analysisPreview.brandName}
              </div>
              <div>
                <span className="text-[#999]">行业：</span>
                {analysisPreview.industry}
              </div>
              <div>
                <span className="text-[#999]">语气：</span>
                {analysisPreview.toneOfVoice}
              </div>
              <div>
                <span className="text-[#999]">写作模式：</span>
                {analysisPreview.writingPatterns.length} 条
              </div>
            </div>
            <div className="flex gap-2 mt-3">
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

      {/* ============= 手动编辑区 ============= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-medium text-[#333]">手动编辑品牌档案</h3>
          {dirty && (
            <button
              onClick={handleManualSave}
              className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-[12px] flex items-center gap-1 hover:bg-orange-600 transition-colors"
            >
              <Save size={12} /> 保存
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[12px] font-medium text-[#999] mb-1 block">品牌名称</label>
            <input
              value={form.brandName}
              onChange={(e) => update({ brandName: e.target.value })}
              className={fieldClass}
              placeholder="如：火花工作室"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-[#999] mb-1 block">所属行业</label>
            <input
              value={form.industry}
              onChange={(e) => update({ industry: e.target.value })}
              className={fieldClass}
              placeholder="如：美妆护肤"
            />
          </div>
        </div>

        <div>
          <label className="text-[12px] font-medium text-[#999] mb-1 block">
            主营业务 / 核心产品
          </label>
          <textarea
            value={form.mainBusiness}
            onChange={(e) => update({ mainBusiness: e.target.value })}
            className={`${fieldClass} resize-none h-[72px]`}
            placeholder="简要描述你的主营业务和核心产品..."
          />
        </div>

        <div>
          <label className="text-[12px] font-medium text-[#999] mb-1 block">目标客户</label>
          <textarea
            value={form.targetCustomer}
            onChange={(e) => update({ targetCustomer: e.target.value })}
            className={`${fieldClass} resize-none h-[64px]`}
            placeholder="如：25-35岁都市白领女性..."
          />
        </div>

        <div>
          <label className="text-[12px] font-medium text-[#999] mb-1 block">差异化价值</label>
          <textarea
            value={form.differentiation}
            onChange={(e) => update({ differentiation: e.target.value })}
            className={`${fieldClass} resize-none h-[64px]`}
            placeholder="为什么客户选你而不是竞品？"
          />
        </div>

        <div>
          <label className="text-[12px] font-medium text-[#999] mb-1 block">语气风格</label>
          <input
            value={form.toneOfVoice}
            onChange={(e) => update({ toneOfVoice: e.target.value })}
            className={fieldClass}
            placeholder="如：亲切、专业、略带幽默"
          />
        </div>

        {/* 关键词 */}
        <div>
          <label className="text-[12px] font-medium text-[#999] mb-1 block">品牌关键词</label>
          <div className="flex gap-2 mb-2">
            <input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
              className={fieldClass}
              placeholder="输入后按回车添加"
            />
            <button
              onClick={addKeyword}
              className="px-3 py-2 bg-white border border-[#E5E4E2] rounded-xl text-[13px] text-[#666] hover:bg-[#F0EFED] transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {form.keywords.map((k) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg text-[12px]"
              >
                {k}
                <button
                  onClick={() => update({ keywords: form.keywords.filter((x) => x !== k) })}
                  className="text-orange-400 hover:text-orange-700"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* 禁用词 */}
        <div>
          <label className="text-[12px] font-medium text-[#999] mb-1 block">禁用词</label>
          <div className="flex gap-2 mb-2">
            <input
              value={tabooInput}
              onChange={(e) => setTabooInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTaboo())}
              className={fieldClass}
              placeholder="写作中要避免的词"
            />
            <button
              onClick={addTaboo}
              className="px-3 py-2 bg-white border border-[#E5E4E2] rounded-xl text-[13px] text-[#666] hover:bg-[#F0EFED] transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {form.tabooWords.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-[12px]"
              >
                {t}
                <button
                  onClick={() => update({ tabooWords: form.tabooWords.filter((x) => x !== t) })}
                  className="text-red-400 hover:text-red-700"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[12px] font-medium text-[#999] mb-1 block">品牌故事（可选）</label>
          <textarea
            value={form.brandStory ?? ''}
            onChange={(e) => update({ brandStory: e.target.value })}
            className={`${fieldClass} resize-none h-[96px]`}
            placeholder="品牌的由来、愿景、价值观..."
          />
        </div>
      </section>
    </div>
  );
}

export default BrandProfileTab;
