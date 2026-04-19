import { FileText } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

interface DraftViewProps {
  onOpenChat: () => void;
}

export default function DraftView({ onOpenChat }: DraftViewProps) {
  const { contents, addMessage } = useAppStore();
  const drafts = contents.filter((c) => c.status === 'draft' || c.status === 'reviewing');

  const handleClick = (draft: typeof drafts[0]) => {
    addMessage({
      id: Date.now().toString(),
      role: 'assistant',
      content: `📄 已加载草稿「${draft.title}」，你可以在下方查看和编辑。`,
      contentItem: draft,
      timestamp: new Date().toISOString(),
    });
    onOpenChat();
  };

  return (
    <div className="h-full overflow-y-auto bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <header className="mb-5">
          <h1 className="text-[18px] font-semibold text-[#333]">草稿箱</h1>
          <p className="text-[12px] text-[#999] mt-1">已生成但还未发布的内容</p>
        </header>

        {drafts.length === 0 ? (
          <div className="text-center py-20 text-[#999] text-[14px] bg-white rounded-2xl border border-[#F0EFED]">
            <FileText size={36} className="mx-auto mb-3 text-[#CCC]" />
            暂无草稿
          </div>
        ) : (
          <div className="space-y-2">
            {drafts.map((d) => (
              <div
                key={d.id}
                onClick={() => handleClick(d)}
                className="bg-white rounded-xl p-4 border border-[#F0EFED] hover:border-spark-orange/30 transition-colors cursor-pointer"
              >
                <h4 className="text-[14px] font-medium text-[#333] truncate">{d.title}</h4>
                <p className="text-[13px] text-[#666] mt-1 line-clamp-2">{d.content}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] text-[#BBB]">
                    {new Date(d.updatedAt).toLocaleString('zh-CN')}
                  </span>
                  <span className="text-[11px] text-spark-orange bg-spark-orange/10 px-2 py-0.5 rounded-full">
                    {d.platform === 'xiaohongshu' ? '小红书' : d.platform === 'wechat' ? '公众号' : '抖音'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
