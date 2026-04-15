import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Upload } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { ContentItem } from '../types/spark';
import { toast } from 'sonner';

interface ContentCardProps {
  item: ContentItem;
}

export default function ContentCard({ item }: ContentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [editTitle, setEditTitle] = useState(item.title);
  const { contents, setContents } = useAppStore();

  const previewText = item.content.split('\n').slice(0, 3).join('\n');

  const handleSave = () => {
    const updated = contents.map(c =>
      c.id === item.id
        ? { ...c, title: editTitle, content: editContent, updatedAt: new Date().toISOString() }
        : c
    );
    setContents(updated);
    setEditing(false);
    toast.success('内容已保存');
  };

  const handlePublish = () => {
    const updated = contents.map(c =>
      c.id === item.id
        ? { ...c, status: 'published' as const, publishedAt: new Date().toISOString() }
        : c
    );
    setContents(updated);
    toast.success('内容已发布！');
  };

  return (
    <div className="content-card">
      {/* Title */}
      {editing ? (
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full text-[15px] font-semibold text-[#333] border border-[#E5E4E2] rounded-lg px-3 py-1.5 mb-2 outline-none focus:border-spark-orange"
        />
      ) : (
        <h4 className="text-[15px] font-semibold text-[#333] mb-2">{item.title}</h4>
      )}

      {/* Content */}
      {editing ? (
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="w-full text-[14px] text-[#555] leading-[1.6] border border-[#E5E4E2] rounded-lg px-3 py-2 outline-none focus:border-spark-orange resize-none min-h-[120px]"
        />
      ) : (
        <div className="text-[14px] text-[#555] leading-[1.6] whitespace-pre-wrap">
          {expanded ? item.content : previewText}
          {!expanded && item.content.split('\n').length > 3 && '...'}
        </div>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {item.tags.map(tag => (
            <span key={tag} className="text-[11px] text-spark-orange bg-spark-orange/10 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#F0EFED]">
        {!editing ? (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="content-card-btn"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? '收起' : '展开全文'}
            </button>
            <button
              onClick={() => { setEditing(true); setExpanded(true); }}
              className="content-card-btn"
            >
              <Pencil size={13} />
              编辑
            </button>
            <button
              onClick={handlePublish}
              className="content-card-btn text-spark-orange"
            >
              <Upload size={13} />
              发布
            </button>
          </>
        ) : (
          <>
            <button onClick={handleSave} className="content-card-btn text-spark-orange font-medium">
              保存
            </button>
            <button onClick={() => setEditing(false)} className="content-card-btn">
              取消
            </button>
          </>
        )}
      </div>
    </div>
  );
}
