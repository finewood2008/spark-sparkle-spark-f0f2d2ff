import { FileText } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';

interface DraftDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DraftDrawer({ open, onOpenChange }: DraftDrawerProps) {
  const { contents, addMessage } = useAppStore();
  const drafts = contents.filter(c => c.status === 'draft' || c.status === 'reviewing');

  const handleClick = (draft: typeof drafts[0]) => {
    addMessage({
      id: Date.now().toString(),
      role: 'assistant',
      content: `📄 已加载草稿「${draft.title}」，你可以在下方查看和编辑。`,
      contentItem: draft,
      timestamp: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:w-96 bg-[#FAFAF8] border-l border-[#EEEDEB]">
        <SheetHeader>
          <SheetTitle className="text-[16px] font-semibold text-[#333]">草稿箱</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto">
          {drafts.length === 0 ? (
            <div className="text-center py-12 text-[#999] text-[14px]">
              <FileText size={32} className="mx-auto mb-3 text-[#CCC]" />
              暂无草稿
            </div>
          ) : (
            drafts.map(d => (
              <div
                key={d.id}
                onClick={() => handleClick(d)}
                className="bg-white rounded-xl p-3 border border-[#F0EFED] hover:border-spark-orange/30 transition-colors cursor-pointer"
              >
                <h4 className="text-[14px] font-medium text-[#333] truncate">{d.title}</h4>
                <p className="text-[12px] text-[#999] mt-1 line-clamp-2">{d.content}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-[#BBB]">
                    {new Date(d.updatedAt).toLocaleDateString('zh-CN')}
                  </span>
                  <span className="text-[11px] text-spark-orange bg-spark-orange/10 px-2 py-0.5 rounded-full">
                    {d.platform === 'xiaohongshu' ? '小红书' : d.platform === 'wechat' ? '公众号' : '抖音'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
