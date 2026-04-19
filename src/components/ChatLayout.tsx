import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { FileText, User, Brain, ClipboardCheck, MessageSquarePlus, Zap, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { supabase } from '@/integrations/supabase/client';
import SparkChat from './SparkChat';

// Lazy chunk loaders — exposed so we can warm them on hover/focus
const loadDraftDrawer = () => import('./DraftDrawer');
const loadMemoryPanel = () => import('./MemoryPanel');
const loadSchedulePage = () => import('../pages/SchedulePage');
const loadReviewPage = () => import('../pages/ReviewPage');

const DraftDrawer = lazy(loadDraftDrawer);
const MemoryPanel = lazy(loadMemoryPanel);
const SchedulePage = lazy(loadSchedulePage);
const ReviewPage = lazy(loadReviewPage);
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

import { useMemoryV2 } from '../hooks/useMemoryV2';
import { useMemoryStore } from '../store/memoryStore';

export default function ChatLayout() {
  const LazyFallback = () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={20} className="animate-spin text-[#CCC]" />
    </div>
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reviewingCount, setReviewingCount] = useState(0);
  const [confirmNewChatOpen, setConfirmNewChatOpen] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const [pulseKey, setPulseKey] = useState(0);
  const prevCountRef = useRef(0);

  // Preload /account chunk on idle so opening "个人中心" feels instant
  useEffect(() => {
    const preload = () => {
      router.preloadRoute({ to: '/account' }).catch(() => { /* ignore */ });
      router.preloadRoute({ to: '/auth' }).catch(() => { /* ignore */ });
    };
    if ('requestIdleCallback' in window) {
      const id = (window as Window & typeof globalThis).requestIdleCallback(preload, { timeout: 2000 });
      return () => (window as Window & typeof globalThis).cancelIdleCallback?.(id);
    }
    const t = setTimeout(preload, 800);
    return () => clearTimeout(t);
  }, [router]);

  const preloadAccount = () => {
    router.preloadRoute({ to: '/account' }).catch(() => { /* ignore */ });
    router.preloadRoute({ to: '/auth' }).catch(() => { /* ignore */ });
  };

  // Lazy-panel chunk warmers — trigger dynamic import on hover/focus
  const preloadDraft = () => { loadDraftDrawer().catch(() => {}); };
  const preloadMemory = () => { loadMemoryPanel().catch(() => {}); };
  const preloadSchedule = () => { loadSchedulePage().catch(() => {}); };
  const preloadReview = () => { loadReviewPage().catch(() => {}); };

  // v2 unified memory system — panel + chat context both read from memoryStore.
  useMemoryV2();
  const getV2Context = useMemoryStore((s) => s.getFullContext);

  const getContextForChat = () => getV2Context('chat');

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

    // Defer initial fetch to avoid blocking first paint
    const fetchTimer = setTimeout(() => fetchCount(), 1000);

    const onFocus = () => fetchCount();
    window.addEventListener('focus', onFocus);

    // Defer realtime subscription
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const realtimeTimer = setTimeout(() => {
      channel = supabase
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
    }, 500);

    return () => {
      clearTimeout(fetchTimer);
      clearTimeout(realtimeTimer);
      window.removeEventListener('focus', onFocus);
      if (channel) supabase.removeChannel(channel);
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const { messages } = useAppStore.getState();
                  if (messages.length === 0) return;
                  setConfirmNewChatOpen(true);
                }}
                aria-label="新对话"
                className="ml-1 w-7 h-7 rounded-md flex items-center justify-center text-[#999] hover:text-[#FF6B1A] hover:bg-[#F0EFED] transition-colors"
              >
                <MessageSquarePlus size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">新对话</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setDrawerOpen(true)}
                onMouseEnter={preloadDraft}
                onFocus={preloadDraft}
                onTouchStart={preloadDraft}
                aria-label="草稿箱"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
              >
                <FileText size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">草稿箱</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setReviewOpen(true)}
                aria-label="审核中心"
                className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
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
            </TooltipTrigger>
            <TooltipContent side="bottom">
              审核中心{reviewingCount > 0 ? ` (${reviewingCount})` : ''}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setScheduleOpen(true)}
                aria-label="自动任务"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
              >
                <Zap size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">自动任务</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setProfileOpen(true)}
                aria-label="火花记忆"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
              >
                <Brain size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">火花记忆</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const { isAuthenticated } = useAuthStore.getState();
                  navigate({ to: isAuthenticated ? '/account' : '/auth' });
                }}
                onMouseEnter={preloadAccount}
                onFocus={preloadAccount}
                onTouchStart={preloadAccount}
                aria-label="个人中心"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
              >
                <User size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">个人中心</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Chat with memory context */}
      <SparkChat getContext={getContextForChat} />

      {/* Draft drawer */}
      {drawerOpen && (
        <Suspense fallback={<LazyFallback />}>
          <DraftDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
        </Suspense>
      )}

      {/* Memory panel (v2) */}
      {profileOpen && (
        <Suspense fallback={<LazyFallback />}>
          <MemoryPanel open={profileOpen} onOpenChange={setProfileOpen} />
        </Suspense>
      )}

      {/* Review center drawer */}
      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl p-0 bg-[#FAFAF8] flex flex-col gap-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>审核中心</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-2 border-b border-[#EEEDEB] flex items-center justify-between">
            <span className="text-sm font-semibold text-[#333]">审核中心</span>
            <p className="text-[11px] text-[#BBB]">按 Esc 关闭</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <Suspense fallback={<LazyFallback />}>
              <ReviewPage embedded />
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>

      {/* Schedule task drawer */}
      <Sheet open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <SheetContent side="right" className="w-full max-w-md p-0 bg-[#FAFAF8] flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>自动任务</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <Suspense fallback={<LazyFallback />}>
              <SchedulePage />
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
