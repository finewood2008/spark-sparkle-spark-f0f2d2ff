import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FileText, User, Brain, ClipboardCheck, Settings as SettingsIcon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '@/integrations/supabase/client';
import SparkChat from './SparkChat';
import DraftDrawer from './DraftDrawer';
import SparkProfile from './SparkProfile';
import SettingsPage from '../pages/SettingsPage';
import ReviewPage from '../pages/ReviewPage';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';

import { useMemorySync } from '../hooks/useMemorySync';

export default function ChatLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewingCount, setReviewingCount] = useState(0);
  const navigate = useNavigate();
  const [pulseKey, setPulseKey] = useState(0);
  const prevCountRef = useRef(0);

  const { getFullContext } = useMemorySync();

  useEffect(() => {
    if (reviewingCount > prevCountRef.current) {
      setPulseKey((k) => k + 1);
    }
    prevCountRef.current = reviewingCount;
  }, [reviewingCount]);

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
          if (!matchUser) return;
          fetchCount();

          // Toast for newly arrived auto-generated items
          if (
            payload.eventType === 'INSERT' &&
            payload.new &&
            (payload.new as Record<string, unknown>).auto_generated === true &&
            (payload.new as Record<string, unknown>).status === 'reviewing'
          ) {
            const newRow = payload.new as Record<string, unknown>;
            const taskName = (newRow.task_name as string) || '定时任务';
            const title = (newRow.title as string) || (newRow.task_topic as string) || '新内容';
            toast.success(`${taskName} 已生成新内容`, {
              description: title.length > 40 ? `${title.slice(0, 40)}…` : title,
              action: {
                label: '去审核',
                onClick: () => setReviewOpen(true),
              },
              duration: 6000,
            });
          }
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
            onClick={() => setReviewOpen(true)}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
            title="审核中心"
          >
            <ClipboardCheck size={18} />
            {reviewingCount > 0 && (
              <>
                <span
                  key={`pulse-${pulseKey}`}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 opacity-60 animate-badge-ping pointer-events-none"
                />
                <span
                  key={`badge-${pulseKey}`}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center animate-badge-pop"
                >
                  {reviewingCount > 9 ? '9+' : reviewingCount}
                </span>
              </>
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
              navigate({ to: isAuthenticated ? '/account' : '/auth' });
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
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full max-w-md p-0 bg-[#FAFAF8] flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-[#EEEDEB]">
            <SheetTitle className="text-sm font-semibold text-[#333] text-left">系统设置</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <SettingsPage />
          </div>
        </SheetContent>
      </Sheet>

      {/* Review center drawer */}
      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl p-0 bg-[#FAFAF8] flex flex-col gap-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>审核中心</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <ReviewPage embedded />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
