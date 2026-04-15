import { useState } from 'react';
import { FileText, Settings } from 'lucide-react';
import SparkChat from './SparkChat';
import DraftDrawer from './DraftDrawer';
import { useAppStore } from '../store/appStore';

export default function ChatLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { setActiveTab } = useAppStore();

  return (
    <div className="h-screen flex flex-col bg-[#FAFAF8]">
      {/* Top nav */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#EEEDEB]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #FF8C42, #FF6B1A)' }}
          >
            <span className="text-[14px]">✨</span>
          </div>
          <span className="text-[16px] font-semibold text-[#333]">火花</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
            title="草稿箱"
          >
            <FileText size={18} />
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
            title="设置"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Chat */}
      <SparkChat />

      {/* Draft drawer */}
      <DraftDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
