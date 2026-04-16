import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import type { BrandMemory, LearningEntry } from '../types/spark';
import {
  Brain, Save, Sparkles,
  TrendingUp, Lightbulb,
  Edit3, Tag, X,
} from 'lucide-react';
import ReviewHistoryList from '../components/ReviewHistoryList';

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  edit: { label: '内容编辑', icon: Edit3, color: 'text-blue-500' },
  feedback: { label: '用户反馈', icon: Sparkles, color: 'text-purple-500' },
  performance: { label: '数据反馈', icon: TrendingUp, color: 'text-green-500' },
  preference: { label: '风格偏好', icon: Lightbulb, color: 'text-spark-orange' },
};

const defaultBrand: BrandMemory = {
  name: '', industry: '', mainBusiness: '',
  targetCustomer: '', differentiation: '',
  toneOfVoice: '', keywords: [], tabooWords: [],
  initialized: false, initStep: 0,
};

function BrandInfoForm() {
  const { brand, setBrand } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BrandMemory>(brand || defaultBrand);
  const [keywordInput, setKeywordInput] = useState('');
  const [tabooInput, setTabooInput] = useState('');

  useEffect(() => {
    if (brand) setForm(brand);
  }, [brand]);

  const handleSave = () => {
    setBrand({ ...form, initialized: true, updatedAt: new Date().toISOString() });
    setEditing(false);
  };

  const fields: { key: keyof BrandMemory; label: string; placeholder: string }[] = [
    { key: 'name', label: '品牌名称', placeholder: '如：火花工作室' },
    { key: 'industry', label: '所在行业', placeholder: '如：美妆/餐饮/教育' },
    { key: 'mainBusiness', label: '主营业务', placeholder: '简述你的核心业务' },
    { key: 'targetCustomer', label: '目标客户', placeholder: '你的典型客户画像' },
    { key: 'differentiation', label: '差异化优势', placeholder: '你和竞品的区别' },
    { key: 'toneOfVoice', label: '语气风格', placeholder: '如：专业温暖/活泼幽默/简洁有力' },
  ];

  return (
    <div className="spark-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-spark-gray-800 flex items-center gap-2">
          <Brain size={18} className="text-spark-orange" />
          品牌档案
        </h2>
        {editing ? (
          <button onClick={handleSave} className="spark-btn-primary text-xs">
            <Save size={14} /> 保存
          </button>
        ) : (
          <button onClick={() => setEditing(true)} className="spark-btn-secondary text-xs">编辑</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.key}>
            <label className="text-xs text-spark-gray-500 mb-1 block">{f.label}</label>
            {editing ? (
              <input
                value={(form[f.key] as string) || ''}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="spark-input"
                placeholder={f.placeholder}
              />
            ) : (
              <p className="text-sm text-spark-gray-700 py-2">
                {(form[f.key] as string) || <span className="text-spark-gray-300">未设置</span>}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Keywords */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-spark-gray-500 mb-1 block">关键词</label>
          {editing && (
            <div className="flex gap-1 mb-2">
              <input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} className="spark-input flex-1" placeholder="添加关键词" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (keywordInput.trim()) { setForm({ ...form, keywords: [...form.keywords, keywordInput.trim()] }); setKeywordInput(''); } } }} />
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {form.keywords.map(k => (
              <span key={k} className="inline-flex items-center gap-1 bg-spark-warm text-spark-orange text-xs px-2 py-0.5 rounded-full">
                <Tag size={10} />{k}
                {editing && <button onClick={() => setForm({ ...form, keywords: form.keywords.filter(x => x !== k) })}><X size={10} /></button>}
              </span>
            ))}
            {form.keywords.length === 0 && <span className="text-xs text-spark-gray-300">暂无</span>}
          </div>
        </div>
        <div>
          <label className="text-xs text-spark-gray-500 mb-1 block">禁用词</label>
          {editing && (
            <div className="flex gap-1 mb-2">
              <input value={tabooInput} onChange={(e) => setTabooInput(e.target.value)} className="spark-input flex-1" placeholder="添加禁用词" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (tabooInput.trim()) { setForm({ ...form, tabooWords: [...form.tabooWords, tabooInput.trim()] }); setTabooInput(''); } } }} />
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {form.tabooWords.map(k => (
              <span key={k} className="inline-flex items-center gap-1 bg-destructive/10 text-destructive text-xs px-2 py-0.5 rounded-full">
                {k}
                {editing && <button onClick={() => setForm({ ...form, tabooWords: form.tabooWords.filter(x => x !== k) })}><X size={10} /></button>}
              </span>
            ))}
            {form.tabooWords.length === 0 && <span className="text-xs text-spark-gray-300">暂无</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mock learnings
const mockLearnings: LearningEntry[] = [
  { id: '1', type: 'performance', category: '封面优化', insight: '暖色调封面图的点击率比冷色调高23%', evidence: '基于最近10篇内容的数据分析', confidence: 0.85, timestamp: '2026-04-14T08:00:00Z' },
  { id: '2', type: 'edit', category: '标题风格', insight: '用户偏好疑问句式标题，互动率更高', evidence: '用户多次修改为疑问句标题', confidence: 0.72, timestamp: '2026-04-13T15:00:00Z' },
  { id: '3', type: 'preference', category: '内容长度', insight: '300-500字的图文表现最佳', evidence: '高互动内容的平均长度统计', confidence: 0.9, timestamp: '2026-04-12T10:00:00Z' },
];

export default function MemoryPage() {
  const { learnings, setLearnings } = useAppStore();

  useEffect(() => {
    if (learnings.length === 0) setLearnings(mockLearnings);
  }, []);

  const displayLearnings = learnings.length > 0 ? learnings : mockLearnings;

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-xl font-bold text-spark-gray-800 mb-1">品牌记忆</h1>
      <p className="text-sm text-spark-gray-400 mb-6">AI 持续学习你的风格，内容越来越懂你</p>

      <BrandInfoForm />

      {/* Learning entries */}
      <div className="mt-6">
        <h2 className="font-semibold text-sm text-spark-gray-700 mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-spark-orange" />
          AI 学习记录
          <span className="text-xs text-spark-gray-400 font-normal">({displayLearnings.length}条)</span>
        </h2>
        <div className="space-y-3">
          {displayLearnings.map(entry => {
            const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.edit;
            const Icon = cfg.icon;
            return (
              <div key={entry.id} className="spark-card p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-spark-gray-50 flex items-center justify-center ${cfg.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-spark-gray-500">{cfg.label}</span>
                      <span className="text-[10px] bg-spark-gray-100 text-spark-gray-500 px-1.5 py-0.5 rounded">{entry.category}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ml-auto ${
                        entry.confidence >= 0.8 ? 'bg-green-50 text-green-600' :
                        entry.confidence >= 0.6 ? 'bg-yellow-50 text-yellow-600' :
                        'bg-spark-gray-100 text-spark-gray-500'
                      }`}>
                        {entry.confidence >= 0.8 ? '高置信' : entry.confidence >= 0.6 ? '中置信' : '低置信'}
                      </span>
                    </div>
                    <p className="text-sm text-spark-gray-800 mt-1">{entry.insight}</p>
                    <p className="text-xs text-spark-gray-400 mt-1">{entry.evidence}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ReviewHistoryList />
    </div>
  );
}
