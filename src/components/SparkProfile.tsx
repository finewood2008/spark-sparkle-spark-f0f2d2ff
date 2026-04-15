import { useState } from 'react';
import { Pencil, Trash2, Plus, X, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { LearningEntry } from '../types/spark';

const categoryEmoji: Record<string, string> = {
  edit: '✏️',
  feedback: '💡',
  performance: '📊',
  preference: '🎯',
  brand: '🏷️',
  tone: '🗣️',
  audience: '👥',
  topic: '📝',
};

function SparkAvatar({ size = 80 }: { size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #FF8C42, #FF6B1A)',
      }}
    >
      <span style={{ fontSize: size * 0.4 }}>✨</span>
    </div>
  );
}

export default function SparkProfile({ onBack }: { onBack: () => void }) {
  const { learnings, setLearnings, brand } = useAppStore();
  const [addingNew, setAddingNew] = useState(false);
  const [newInput, setNewInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const memoryEntries: { emoji: string; text: string; id: string }[] = [];

  // Add brand memories
  if (brand?.initialized) {
    if (brand.name) memoryEntries.push({ emoji: '🏷️', text: `品牌名称：${brand.name}`, id: 'brand-name' });
    if (brand.industry) memoryEntries.push({ emoji: '🏢', text: `行业：${brand.industry}`, id: 'brand-industry' });
    if (brand.targetCustomer) memoryEntries.push({ emoji: '👥', text: `目标客户：${brand.targetCustomer}`, id: 'brand-target' });
    if (brand.toneOfVoice) memoryEntries.push({ emoji: '🗣️', text: `语气风格：${brand.toneOfVoice}`, id: 'brand-tone' });
    if (brand.keywords.length > 0) memoryEntries.push({ emoji: '🔑', text: `关键词：${brand.keywords.join('、')}`, id: 'brand-keywords' });
  }

  // Add learning entries
  learnings.forEach(l => {
    memoryEntries.push({
      emoji: categoryEmoji[l.category] || categoryEmoji[l.type] || '💡',
      text: l.insight,
      id: l.id,
    });
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

  const handleDelete = (id: string) => {
    setLearnings(learnings.filter(l => l.id !== id));
  };

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

  return (
    <div className="h-screen flex flex-col bg-[#FAFAF8]">
      {/* Header */}
      <header className="flex items-center px-5 py-3 border-b border-[#EEEDEB]">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors mr-2"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-[16px] font-semibold text-[#333]">火花档案</span>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-8">
          {/* Avatar + intro */}
          <div className="flex flex-col items-center mb-8">
            <SparkAvatar size={80} />
            <h2 className="text-[20px] font-bold text-[#333] mt-4">火花</h2>
            <p className="text-[14px] text-[#999] mt-2 text-center leading-relaxed">
              我是你的内容创作搭子，以下是我对你的了解 👇
            </p>
          </div>

          {/* Memory cards */}
          <div className="space-y-3">
            {memoryEntries.length === 0 && (
              <div className="text-center py-8 text-[14px] text-[#BBB]">
                还没有记忆条目，点击下方按钮告诉火花更多吧
              </div>
            )}

            {memoryEntries.map(entry => {
              const isLearning = learnings.some(l => l.id === entry.id);
              const isEditing = editingId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#F0EFED] hover:border-spark-orange/20 transition-colors"
                >
                  <span className="text-[20px] shrink-0">{entry.emoji}</span>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="flex-1 text-[14px] text-[#333] border border-[#E5E4E2] rounded-lg px-2 py-1 outline-none focus:border-spark-orange"
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        />
                        <button onClick={handleSaveEdit} className="text-[12px] text-spark-orange font-medium">保存</button>
                        <button onClick={() => setEditingId(null)} className="text-[12px] text-[#999]">取消</button>
                      </div>
                    ) : (
                      <p className="text-[14px] text-[#555] leading-relaxed">{entry.text}</p>
                    )}
                  </div>
                  {isLearning && !isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(entry.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#CCC] hover:text-[#999] hover:bg-[#F5F5F3] transition-colors"
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
            })}
          </div>

          {/* Add new */}
          <div className="mt-6">
            {addingNew ? (
              <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-spark-orange/30">
                <input
                  value={newInput}
                  onChange={(e) => setNewInput(e.target.value)}
                  placeholder="例如：我的受众主要是 25-35 岁女性"
                  className="flex-1 text-[14px] text-[#333] bg-transparent border-none outline-none placeholder:text-[#CCC]"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  autoFocus
                />
                <button onClick={handleAdd} className="text-[13px] text-spark-orange font-medium">添加</button>
                <button onClick={() => { setAddingNew(false); setNewInput(''); }} className="text-[#CCC] hover:text-[#999]">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingNew(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-spark-orange/30 text-[14px] text-spark-orange hover:bg-spark-orange/5 transition-colors"
              >
                <Plus size={16} />
                告诉火花更多
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
