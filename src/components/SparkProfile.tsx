import { useState } from 'react';
import { Pencil, Trash2, Plus, X } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { LearningEntry } from '../types/spark';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

interface SparkProfileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SparkProfile({ open, onOpenChange }: SparkProfileProps) {
  const { learnings, setLearnings, brand } = useAppStore();
  const [addingNew, setAddingNew] = useState(false);
  const [newInput, setNewInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Build categorized entries
  const styleEntries: { emoji: string; text: string; id: string; editable: boolean }[] = [];
  const businessEntries: { emoji: string; text: string; id: string; editable: boolean }[] = [];

  if (brand?.initialized) {
    if (brand.toneOfVoice) styleEntries.push({ emoji: '🗣️', text: `语气风格：${brand.toneOfVoice}`, id: 'brand-tone', editable: false });
    if (brand.keywords.length > 0) styleEntries.push({ emoji: '🔑', text: `常用关键词：${brand.keywords.join('、')}`, id: 'brand-keywords', editable: false });
    if (brand.tabooWords.length > 0) styleEntries.push({ emoji: '🚫', text: `避免使用：${brand.tabooWords.join('、')}`, id: 'brand-taboo', editable: false });
    if (brand.name) businessEntries.push({ emoji: '🏷️', text: `品牌名称：${brand.name}`, id: 'brand-name', editable: false });
    if (brand.industry) businessEntries.push({ emoji: '🏢', text: `行业：${brand.industry}`, id: 'brand-industry', editable: false });
    if (brand.mainBusiness) businessEntries.push({ emoji: '📦', text: `主营业务：${brand.mainBusiness}`, id: 'brand-business', editable: false });
    if (brand.targetCustomer) businessEntries.push({ emoji: '👥', text: `目标客户：${brand.targetCustomer}`, id: 'brand-target', editable: false });
    if (brand.differentiation) businessEntries.push({ emoji: '💎', text: `核心差异：${brand.differentiation}`, id: 'brand-diff', editable: false });
  }

  learnings.forEach(l => {
    const entry = { emoji: '💡', text: l.insight, id: l.id, editable: true };
    if (['preference', 'feedback', 'edit'].includes(l.type) || l.category === 'tone') {
      styleEntries.push(entry);
    } else {
      businessEntries.push(entry);
    }
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

  const renderEntry = (entry: { emoji: string; text: string; id: string; editable: boolean }) => {
    const isEditing = editingId === entry.id;
    return (
      <div
        key={entry.id}
        className="group flex items-center gap-3 rounded-xl px-3.5 py-2.5 hover:bg-[#FAF9F7] transition-colors"
      >
        <span className="text-[16px] shrink-0">{entry.emoji}</span>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="flex-1 text-[14px] text-[#333] border border-[#E5E4E2] rounded-lg px-2 py-1 outline-none focus:border-orange-400"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                autoFocus
              />
              <button onClick={handleSaveEdit} className="text-[12px] text-orange-500 font-medium">保存</button>
              <button onClick={() => setEditingId(null)} className="text-[12px] text-[#999]">取消</button>
            </div>
          ) : (
            <p className="text-[14px] text-[#555] leading-relaxed">{entry.text}</p>
          )}
        </div>
        {entry.editable && !isEditing && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleEdit(entry.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#CCC] hover:text-[#999] hover:bg-[#F0EFED] transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => handleDelete(entry.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#CCC] hover:text-red-400 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto bg-[#FAFAF8] border-orange-100">
        <DialogHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF8C42, #FF6B1A)' }}
            >
              <span className="text-[22px]">✨</span>
            </div>
          </div>
          <DialogTitle className="text-[18px] font-bold text-[#333]">火花的记忆本</DialogTitle>
          <DialogDescription className="text-[13px] text-[#999] mt-1">
            我已经记下了这些关于你的偏好，这让我越来越懂你。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Style section */}
          {styleEntries.length > 0 && (
            <div>
              <h3 className="text-[13px] font-semibold text-[#999] uppercase tracking-wider mb-2 px-1">
                📝 风格与基调
              </h3>
              <div className="space-y-0.5">
                {styleEntries.map(renderEntry)}
              </div>
            </div>
          )}

          {/* Business section */}
          {businessEntries.length > 0 && (
            <div>
              <h3 className="text-[13px] font-semibold text-[#999] uppercase tracking-wider mb-2 px-1">
                🎯 业务与产品
              </h3>
              <div className="space-y-0.5">
                {businessEntries.map(renderEntry)}
              </div>
            </div>
          )}

          {styleEntries.length === 0 && businessEntries.length === 0 && (
            <div className="text-center py-8 text-[14px] text-[#BBB]">
              还没有记忆条目，告诉火花更多吧
            </div>
          )}
        </div>

        {/* Add new */}
        <div className="mt-4 pb-2">
          {addingNew ? (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 border border-dashed border-orange-300 bg-white">
              <input
                value={newInput}
                onChange={(e) => setNewInput(e.target.value)}
                placeholder="例如：我希望文章语气像和朋友聊天"
                className="flex-1 text-[14px] text-[#333] bg-transparent border-none outline-none placeholder:text-[#CCC]"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                autoFocus
              />
              <button onClick={handleAdd} className="text-[13px] text-orange-500 font-medium">添加</button>
              <button onClick={() => { setAddingNew(false); setNewInput(''); }} className="text-[#CCC] hover:text-[#999]">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-orange-200 text-[14px] text-orange-500 hover:bg-orange-50/50 transition-colors"
            >
              <Plus size={16} />
              告诉火花更多
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
