import { useState, useEffect } from 'react';
import { Pencil, Trash2, Plus, X, Cloud, Lock, HardDrive, Monitor, Brain, FileSearch, BarChart3, Download, Check, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { LearningEntry, BrandMemory } from '../types/spark';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './ui/sheet';
import { toast } from 'sonner';

interface SparkProfileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultBrand: BrandMemory = {
  name: '',
  industry: '',
  mainBusiness: '',
  targetCustomer: '',
  differentiation: '',
  toneOfVoice: '',
  keywords: [],
  tabooWords: [],
  initialized: false,
  initStep: 0,
};

function BrandMemoryForm({ brand, onSave }: { brand: BrandMemory; onSave: (b: BrandMemory) => void }) {
  const [form, setForm] = useState(brand);
  const [keywordInput, setKeywordInput] = useState('');
  const [tabooInput, setTabooInput] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setForm(brand); setDirty(false); }, [brand]);

  const update = (patch: Partial<BrandMemory>) => {
    setForm(f => ({ ...f, ...patch }));
    setDirty(true);
  };

  const handleSave = () => {
    onSave({ ...form, initialized: true });
    setDirty(false);
    toast.success('品牌记忆已保存');
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

  const fieldClass = "w-full text-[14px] text-[#333] border border-[#E5E4E2] rounded-xl px-3.5 py-2.5 outline-none focus:border-orange-400 bg-white transition-colors placeholder:text-[#CCC]";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[12px] font-medium text-[#999] mb-1 block">品牌名称</label>
          <input value={form.name} onChange={e => update({ name: e.target.value })} className={fieldClass} placeholder="如：火花工作室" />
        </div>
        <div>
          <label className="text-[12px] font-medium text-[#999] mb-1 block">所属行业</label>
          <input value={form.industry} onChange={e => update({ industry: e.target.value })} className={fieldClass} placeholder="如：美妆护肤" />
        </div>
      </div>

      <div>
        <label className="text-[12px] font-medium text-[#999] mb-1 block">主营业务 / 核心产品</label>
        <textarea value={form.mainBusiness} onChange={e => update({ mainBusiness: e.target.value })} className={`${fieldClass} resize-none h-[72px]`} placeholder="简要描述你的主营业务和核心产品..." />
      </div>

      <div>
        <label className="text-[12px] font-medium text-[#999] mb-1 block">目标客户</label>
        <input value={form.targetCustomer} onChange={e => update({ targetCustomer: e.target.value })} className={fieldClass} placeholder="如：18-35岁城市女性白领" />
      </div>

      <div>
        <label className="text-[12px] font-medium text-[#999] mb-1 block">核心差异化 / 卖点</label>
        <input value={form.differentiation} onChange={e => update({ differentiation: e.target.value })} className={fieldClass} placeholder="你与竞品最大的不同是什么？" />
      </div>

      <div>
        <label className="text-[12px] font-medium text-[#999] mb-1 block">品牌语气风格</label>
        <input value={form.toneOfVoice} onChange={e => update({ toneOfVoice: e.target.value })} className={fieldClass} placeholder="如：亲切、专业、有温度" />
      </div>

      {/* Keywords */}
      <div>
        <label className="text-[12px] font-medium text-[#999] mb-1 block">品牌关键词</label>
        <div className="flex gap-2 mb-2">
          <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())} className={`${fieldClass} flex-1`} placeholder="添加关键词..." />
          <button onClick={addKeyword} className="px-3 py-2 rounded-xl bg-[#F5F5F3] text-[12px] text-[#666] hover:bg-[#EEEDEB] transition-colors shrink-0">添加</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {form.keywords.map(k => (
            <span key={k} className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-[12px] px-2.5 py-0.5 rounded-full">
              {k}
              <button onClick={() => update({ keywords: form.keywords.filter(x => x !== k) })} className="hover:text-red-500 text-[10px]">×</button>
            </span>
          ))}
        </div>
      </div>

      {/* Taboo words */}
      <div>
        <label className="text-[12px] font-medium text-[#999] mb-1 block">禁用词汇</label>
        <div className="flex gap-2 mb-2">
          <input value={tabooInput} onChange={e => setTabooInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTaboo())} className={`${fieldClass} flex-1`} placeholder="不希望出现的词..." />
          <button onClick={addTaboo} className="px-3 py-2 rounded-xl bg-[#F5F5F3] text-[12px] text-[#666] hover:bg-[#EEEDEB] transition-colors shrink-0">添加</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {form.tabooWords.map(t => (
            <span key={t} className="inline-flex items-center gap-1 bg-red-50 text-red-500 text-[12px] px-2.5 py-0.5 rounded-full">
              🚫 {t}
              <button onClick={() => update({ tabooWords: form.tabooWords.filter(x => x !== t) })} className="hover:text-red-700 text-[10px]">×</button>
            </span>
          ))}
        </div>
      </div>

      {dirty && (
        <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 text-white text-[14px] font-medium hover:brightness-105 transition-all">
          <Save size={16} /> 保存品牌记忆
        </button>
      )}
    </div>
  );
}

export default function SparkProfile({ open, onOpenChange }: SparkProfileProps) {
  const { learnings, setLearnings, brand, setBrand, brandMemoryEnabled, setBrandMemoryEnabled } = useAppStore();
  const [addingNew, setAddingNew] = useState(false);
  const [newInput, setNewInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [activeTab, setActiveTab] = useState<'brand' | 'style'>('brand');

  const currentBrand = brand || defaultBrand;

  // Learning entries for style tab
  const styleEntries: { emoji: string; text: string; id: string; editable: boolean }[] = [];
  learnings.forEach(l => {
    styleEntries.push({ emoji: '💡', text: l.insight, id: l.id, editable: true });
  });

  const handleAdd = () => {
    if (!newInput.trim()) return;
    const entry: LearningEntry = {
      id: Date.now().toString(),
      type: 'preference',
      category: 'preference',
      insight: newInput.trim(),
      evidence: '用户手动添加',
      confidence: 1,
      timestamp: new Date().toISOString(),
    };
    setLearnings([...learnings, entry]);
    setNewInput('');
    setAddingNew(false);
  };

  const handleDelete = (id: string) => setLearnings(learnings.filter(l => l.id !== id));

  const handleEdit = (id: string) => {
    const entry = learnings.find(l => l.id === id);
    if (!entry) return;
    setEditingId(id);
    setEditText(entry.insight);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editText.trim()) return;
    setLearnings(learnings.map(l =>
      l.id === editingId ? { ...l, insight: editText.trim() } : l
    ));
    setEditingId(null);
    setEditText('');
  };

  const handleSaveBrand = (b: BrandMemory) => {
    setBrand(b);
  };

  const handleToggleBrandMemory = () => {
    const next = !brandMemoryEnabled;
    setBrandMemoryEnabled(next);
    if (next && (!brand || !brand.initialized)) {
      toast('请先填写品牌信息，保存后即可生效', { icon: '📝' });
    } else {
      toast.success(next ? '品牌记忆已启用，后续内容将自动关联品牌' : '品牌记忆已关闭');
    }
  };

  const renderEntry = (entry: { emoji: string; text: string; id: string; editable: boolean }) => {
    const isEditing = editingId === entry.id;
    return (
      <div key={entry.id} className="group flex items-center gap-3 rounded-xl px-3.5 py-2.5 hover:bg-[#FAF9F7] transition-colors">
        <span className="text-[16px] shrink-0">{entry.emoji}</span>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input value={editText} onChange={(e) => setEditText(e.target.value)} className="flex-1 text-[14px] text-[#333] border border-[#E5E4E2] rounded-lg px-2 py-1 outline-none focus:border-orange-400" onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()} autoFocus />
              <button onClick={handleSaveEdit} className="text-[12px] text-orange-500 font-medium">保存</button>
              <button onClick={() => setEditingId(null)} className="text-[12px] text-[#999]">取消</button>
            </div>
          ) : (
            <p className="text-[14px] text-[#555] leading-relaxed">{entry.text}</p>
          )}
        </div>
        {entry.editable && !isEditing && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => handleEdit(entry.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#CCC] hover:text-[#999] hover:bg-[#F0EFED] transition-colors"><Pencil size={13} /></button>
            <button onClick={() => handleDelete(entry.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#CCC] hover:text-red-400 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
          </div>
        )}
      </div>
    );
  };

  const lockedFeatures = [
    { icon: FileSearch, label: '本地文件知识库映射' },
    { icon: BarChart3, label: '历史高赞内容自动分析模型' },
    { icon: Brain, label: '深度用户画像学习引擎' },
    { icon: HardDrive, label: '本地素材库智能关联' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 bg-[#FAFAF8] border-l border-orange-100 flex flex-col gap-0"
      >
        {/* Header */}
        <SheetHeader className="text-center pt-6 px-6 pb-3 shrink-0 border-b border-[#EEEDEB]">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF8C42, #FF6B1A)' }}>
              <span className="text-[22px]">✨</span>
            </div>
          </div>
          <SheetTitle className="text-[18px] font-bold text-[#333] text-center">火花的记忆本</SheetTitle>
          <SheetDescription className="text-[13px] text-[#999] mt-1 text-center">
            填写品牌信息并启用后，火花创作的所有内容都会自动关联你的品牌。
          </SheetDescription>
          <p className="text-[11px] text-[#BBB] mt-2 text-center">
            按 <kbd className="px-1.5 py-0.5 rounded bg-[#F0EFED] text-[#999] font-mono text-[10px]">Esc</kbd> 或点击外部区域关闭
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">

        {/* Brand memory toggle */}
        <div className="mx-6 mt-1 mb-3">
          <button
            onClick={handleToggleBrandMemory}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
              brandMemoryEnabled
                ? 'bg-orange-50 border-orange-200'
                : 'bg-[#F5F5F3] border-[#E5E4E2]'
            }`}
          >
            {brandMemoryEnabled
              ? <ToggleRight size={24} className="text-orange-500 shrink-0" />
              : <ToggleLeft size={24} className="text-[#BBB] shrink-0" />
            }
            <div className="flex-1 text-left">
              <p className={`text-[14px] font-medium ${brandMemoryEnabled ? 'text-orange-600' : 'text-[#666]'}`}>
                品牌记忆 {brandMemoryEnabled ? '已启用' : '未启用'}
              </p>
              <p className="text-[11px] text-[#999] mt-0.5">
                {brandMemoryEnabled
                  ? '所有生成的内容将自动融入你的品牌调性和关键信息'
                  : '开启后，火花会在创作中自动关联你的品牌与产品'
                }
              </p>
            </div>
            {brandMemoryEnabled && brand?.initialized && (
              <Check size={16} className="text-orange-500 shrink-0" />
            )}
          </button>
        </div>

        {/* Tab switcher */}
        <div className="mx-6 mb-3 flex gap-1 bg-[#F0EFED] rounded-xl p-1">
          <button
            onClick={() => setActiveTab('brand')}
            className={`flex-1 text-[13px] py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'brand' ? 'bg-white text-[#333] shadow-sm' : 'text-[#999] hover:text-[#666]'
            }`}
          >
            🏷️ 品牌与产品
          </button>
          <button
            onClick={() => setActiveTab('style')}
            className={`flex-1 text-[13px] py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'style' ? 'bg-white text-[#333] shadow-sm' : 'text-[#999] hover:text-[#666]'
            }`}
          >
            📝 风格偏好
          </button>
        </div>

        {/* Tab content */}
        <div className="px-6 pb-2">
          {activeTab === 'brand' ? (
            <BrandMemoryForm brand={currentBrand} onSave={handleSaveBrand} />
          ) : (
            <div className="space-y-3">
              {styleEntries.length > 0 ? (
                <div className="space-y-0.5">
                  {styleEntries.map(renderEntry)}
                </div>
              ) : (
                <div className="text-center py-6 text-[14px] text-[#BBB]">
                  还没有风格偏好，火花会在互动中逐渐学习
                </div>
              )}

              {/* Add new */}
              {addingNew ? (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 border border-dashed border-orange-300 bg-white">
                  <input value={newInput} onChange={(e) => setNewInput(e.target.value)} placeholder="例如：我希望文章语气像和朋友聊天" className="flex-1 text-[14px] text-[#333] bg-transparent border-none outline-none placeholder:text-[#CCC]" onKeyDown={(e) => e.key === 'Enter' && handleAdd()} autoFocus />
                  <button onClick={handleAdd} className="text-[13px] text-orange-500 font-medium">添加</button>
                  <button onClick={() => { setAddingNew(false); setNewInput(''); }} className="text-[#CCC] hover:text-[#999]"><X size={16} /></button>
                </div>
              ) : (
                <button onClick={() => setAddingNew(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-orange-200 text-[14px] text-orange-500 hover:bg-orange-50/50 transition-colors">
                  <Plus size={16} /> 告诉火花更多
                </button>
              )}
            </div>
          )}
        </div>

        {/* Cloud mode banner */}
        <div className="mx-6 mt-2 mb-3 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#F0F4F8] border border-[#E2E8F0]">
          <Cloud size={16} className="text-[#94A3B8] shrink-0" />
          <p className="text-[12px] text-[#64748B] leading-relaxed">
            当前为<span className="font-medium text-[#475569]">轻量记忆模式（云端）</span>。火花仅记录了基础的风格偏好。
          </p>
        </div>

        {/* Deep memory locked section */}
        <style>{`
          @keyframes float-gentle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          @keyframes glow-breathe {
            0%, 100% { box-shadow: 0 0 8px rgba(255,140,66,0.15), 0 0 20px rgba(255,140,66,0.05); }
            50% { box-shadow: 0 0 16px rgba(255,140,66,0.35), 0 0 40px rgba(255,140,66,0.12); }
          }
          @keyframes dot-pulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.4); }
          }
          .float-icon-1 { animation: float-gentle 3s ease-in-out infinite; }
          .float-icon-2 { animation: float-gentle 3s ease-in-out 0.4s infinite; }
          .float-icon-3 { animation: float-gentle 3s ease-in-out 0.8s infinite; }
          .glow-btn { animation: glow-breathe 2.5s ease-in-out infinite; }
          .dot-anim-1 { animation: dot-pulse 2s ease-in-out 0.2s infinite; }
          .dot-anim-2 { animation: dot-pulse 2s ease-in-out 0.6s infinite; }
        `}</style>
        <div className="mt-2 mx-6 mb-6 relative rounded-2xl overflow-hidden border border-[#E2E8F0]">
          <div className="px-5 pt-5 pb-16 space-y-3 select-none" style={{ filter: 'blur(2px)', opacity: 0.45 }}>
            {lockedFeatures.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 bg-white">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center"><Icon size={16} className="text-orange-400" /></div>
                <div className="flex-1">
                  <p className="text-[14px] text-[#555] font-medium">{label}</p>
                  <p className="text-[11px] text-[#BBB]">桌面版专属功能</p>
                </div>
                <Lock size={14} className="text-[#CCC]" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent via-[#FAFAF8]/80 to-[#FAFAF8]/95 px-6">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="float-icon-1 w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><Monitor size={20} className="text-orange-500" /></div>
              <div className="dot-anim-1 w-1.5 h-1.5 rounded-full bg-orange-300" />
              <div className="float-icon-2 w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><Brain size={20} className="text-orange-500" /></div>
              <div className="dot-anim-2 w-1.5 h-1.5 rounded-full bg-orange-300" />
              <div className="float-icon-3 w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><HardDrive size={20} className="text-orange-500" /></div>
            </div>
            <p className="text-[13px] text-[#666] text-center leading-relaxed mb-4 max-w-[280px]">
              开启<span className="font-semibold text-[#333]">深层本地记忆系统</span>，火花将通过你的本地硬盘资料完成终极进化。
            </p>
            <button className="glow-btn flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 text-white text-[14px] font-medium hover:brightness-105 transition-all">
              <Download size={16} /> 下载桌面版开启
            </button>
          </div>
        </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
