import { useState, useEffect } from 'react';
import { FileText, User, Brain, ClipboardCheck, Settings as SettingsIcon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '@/integrations/supabase/client';
import SparkChat from './SparkChat';
import DraftDrawer from './DraftDrawer';
import SparkProfile from './SparkProfile';
import SettingsPage from '../pages/SettingsPage';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

import { useMemorySync } from '../hooks/useMemorySync';

export default function ChatLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewingCount, setReviewingCount] = useState(0);

  const { getFullContext } = useMemorySync();

  useEffect(() => {
    const fetchCount = async () => {
      const { user, isAuthenticated } = useAuthStore.getState();
      let query = supabase
        .from('review_items')
        .select('id', { count: 'exact', head: true })
        .in('status', ['reviewing', 'draft']);
      query = isAuthenticated && user?.id
        ? query.eq('user_id', user.id)
        : query.is('user_id', null).eq('device_id', 'default');
      const { count, error } = await query;
      if (!error && typeof count === 'number') setReviewingCount(count);
    };
    fetchCount();
    // Refresh on tab focus so badge updates after returning from /review
    const onFocus = () => fetchCount();
    window.addEventListener('focus', onFocus);

    // Realtime: badge auto-updates when scheduled tasks insert new review_items
    const channel = supabase
      .channel('review-items-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'review_items' },
        (payload) => {
          const row = (payload.new || payload.old) as Record<string, unknown> | undefined;
          if (!row) return;
          const { user, isAuthenticated } = useAuthStore.getState();
          const matchUser = isAuthenticated && user?.id
            ? row.user_id === user.id
            : row.user_id === null && row.device_id === 'default';
          if (matchUser) fetchCount();
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener('focus', onFocus);
      supabase.removeChannel(channel);
    };
  }, []);

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
            onClick={() => { window.location.href = '/review'; }}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
            title="审核中心"
          >
            <ClipboardCheck size={18} />
            {reviewingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                {reviewingCount > 9 ? '9+' : reviewingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setProfileOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
            title="火花记忆"
          >
            <Brain size={18} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
            title="系统设置"
          >
            <SettingsIcon size={18} />
          </button>
          <button
            onClick={() => {
              const { isAuthenticated } = useAuthStore.getState();
              window.location.href = isAuthenticated ? '/account' : '/auth';
            }}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
            title="个人中心"
          >
            <User size={18} />
          </button>
        </div>
      </header>

      {/* Chat with memory context */}
      <SparkChat getContext={getFullContext} />

      {/* Draft drawer */}
      <DraftDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {/* Memory profile modal */}
      <SparkProfile open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Settings drawer */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/30 backdrop-blur-sm"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="w-full max-w-md bg-[#FAFAF8] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#EEEDEB]">
              <span className="text-sm font-semibold text-[#333]">系统设置</span>
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED]"
                title="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SettingsPage />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
