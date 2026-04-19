import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Loader2, MessageSquarePlus, Menu } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { supabase } from '@/integrations/supabase/client';
import SparkChat from './SparkChat';
import ConversationSidebar, { type WorkspaceView } from './ConversationSidebar';
import { useConversations } from '@/hooks/useConversations';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useMemoryV2 } from '../hooks/useMemoryV2';
import { useMemoryStore } from '../store/memoryStore';

// Lazy panels rendered in the main area
const loadDraftView = () => import('./views/DraftView');
const loadMemoryView = () => import('./views/MemoryView');
const loadScheduleView = () => import('./views/ScheduleView');
const loadReviewView = () => import('./views/ReviewView');
const DraftView = lazy(loadDraftView);
const MemoryView = lazy(loadMemoryView);
const ScheduleView = lazy(loadScheduleView);
const ReviewView = lazy(loadReviewView);

const SIDEBAR_PREF_KEY = 'spark.sidebarCollapsed';

function LazyFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={20} className="animate-spin text-[#CCC]" />
    </div>
  );
}

export default function ChatLayout() {
  const [view, setView] = useState<WorkspaceView>('chat');
  const [reviewingCount, setReviewingCount] = useState(0);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_PREF_KEY) === '1';
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const prevCountRef = useRef(0);

  // Initialize multi-conversation system
  const { newConversation } = useConversations();

  // v2 unified memory system
  useMemoryV2();
  const getV2Context = useMemoryStore((s) => s.getFullContext);
  const getContextForChat = () => getV2Context('chat');

  // Persist collapse preference
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_PREF_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Pulse on review count increase
  useEffect(() => {
    prevCountRef.current = reviewingCount;
  }, [reviewingCount]);

  // Reviewing count + realtime
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

    const fetchTimer = setTimeout(() => fetchCount(), 1000);
    const onFocus = () => fetchCount();
    window.addEventListener('focus', onFocus);

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
                  onClick: () => setView('review'),
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

  const handleNewChatHeader = async () => {
    setView('chat');
    const { messages } = useAppStore.getState();
    if (messages.length === 0) return; // already empty
    await newConversation();
  };

  const sidebarProps = {
    activeView: view,
    onChangeView: (v: WorkspaceView) => {
      setView(v);
      setMobileSidebarOpen(false);
    },
    reviewingCount,
    collapsed,
    onToggleCollapsed: () => setCollapsed((c) => !c),
  };

  return (
    <div className="h-screen flex bg-[#FAFAF8]">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <ConversationSidebar {...sidebarProps} />
      </div>

      {/* Mobile sidebar (sheet) */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[280px] bg-[#F7F6F3]">
          <SheetHeader className="sr-only">
            <SheetTitle>侧栏菜单</SheetTitle>
          </SheetHeader>
          <ConversationSidebar
            {...sidebarProps}
            collapsed={false}
            onToggleCollapsed={() => setMobileSidebarOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile only or chat header) */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-[#EEEDEB] bg-[#FAFAF8] md:hidden">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="w-9 h-9 rounded-md flex items-center justify-center text-[#666] hover:bg-[#F0EFED]"
            aria-label="打开菜单"
          >
            <Menu size={18} />
          </button>
          <span className="text-[14px] font-semibold text-[#333]">
            {view === 'chat' ? '火花' : viewLabel(view)}
          </span>
          {view === 'chat' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleNewChatHeader}
                  className="w-9 h-9 rounded-md flex items-center justify-center text-[#999] hover:text-[#FF6B1A] hover:bg-[#F0EFED]"
                  aria-label="新对话"
                >
                  <MessageSquarePlus size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">新对话</TooltipContent>
            </Tooltip>
          ) : (
            <span className="w-9" />
          )}
        </header>

        {/* View content */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {view === 'chat' && <SparkChat getContext={getContextForChat} />}
          {view === 'drafts' && (
            <Suspense fallback={<LazyFallback />}>
              <DraftView onOpenChat={() => setView('chat')} />
            </Suspense>
          )}
          {view === 'review' && (
            <Suspense fallback={<LazyFallback />}>
              <ReviewView />
            </Suspense>
          )}
          {view === 'schedule' && (
            <Suspense fallback={<LazyFallback />}>
              <ScheduleView />
            </Suspense>
          )}
          {view === 'memory' && (
            <Suspense fallback={<LazyFallback />}>
              <MemoryView />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  );
}

function viewLabel(v: WorkspaceView): string {
  switch (v) {
    case 'drafts':
      return '草稿箱';
    case 'review':
      return '审核中心';
    case 'schedule':
      return '自动任务';
    case 'memory':
      return '火花记忆';
    default:
      return '火花';
  }
}
