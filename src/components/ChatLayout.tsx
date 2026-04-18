import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FileText, User, Brain, Inbox, Settings as SettingsIcon, MessageSquarePlus, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { supabase } from '@/integrations/supabase/client';
import SparkChat from './SparkChat';
import DraftDrawer from './DraftDrawer';
import MemoryPanel from './MemoryPanel';
import SettingsPage from '../pages/SettingsPage';
import SchedulePage from '../pages/SchedulePage';
import ReviewPage from '../pages/ReviewPage';
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Unified "Content Center": top = auto-tasks, bottom = review list
  const [centerOpen, setCenterOpen] = useState(false);
  const [scheduleCollapsed, setScheduleCollapsed] = useState(false);
  const [reviewingCount, setReviewingCount] = useState(0);
  const [confirmNewChatOpen, setConfirmNewChatOpen] = useState(false);
  const navigate = useNavigate();
  const [pulseKey, setPulseKey] = useState(0);
  const prevCountRef = useRef(0);

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
                label: '去查看',
                onClick: () => setCenterOpen(true),
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
                onClick={() => setCenterOpen(true)}
                aria-label="内容中心"
                className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
              >
                <Inbox size={18} />
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
              内容中心{reviewingCount > 0 ? ` (${reviewingCount} 待审)` : ''}
            </TooltipContent>
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
                onClick={() => setSettingsOpen(true)}
                aria-label="系统设置"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#F0EFED] transition-colors"
              >
                <SettingsIcon size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">系统设置</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const { isAuthenticated } = useAuthStore.getState();
                  navigate({ to: isAuthenticated ? '/account' : '/auth' });
                }}
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
      <DraftDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {/* Memory panel (v2) */}
      <MemoryPanel open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Settings drawer */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full max-w-md p-0 bg-[#FAFAF8] flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-[#EEEDEB]">
            <SheetTitle className="text-sm font-semibold text-[#333] text-left">系统设置</SheetTitle>
            <p className="text-[11px] text-[#BBB] text-left">按 Esc 关闭</p>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <SettingsPage />
          </div>
        </SheetContent>
      </Sheet>

      {/* Content Center drawer — auto-tasks (top) + review queue (bottom) */}
      <Sheet open={centerOpen} onOpenChange={setCenterOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl p-0 bg-[#FAFAF8] flex flex-col gap-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>内容中心</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-2 border-b border-[#EEEDEB] flex items-center justify-between shrink-0">
            <span className="text-sm font-semibold text-[#333]">
              内容中心
              {reviewingCount > 0 && (
                <span className="ml-2 text-[11px] text-orange-500 font-medium">
                  {reviewingCount} 条待审
                </span>
              )}
            </span>
            <p className="text-[11px] text-[#BBB]">按 Esc 关闭</p>
          </div>

          {/* Top: auto-task config (collapsible to save vertical space) */}
          <div className="border-b border-[#EEEDEB] shrink-0 max-h-[55vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-orange-500" />
                <span className="text-[13px] font-semibold text-[#333]">自动任务</span>
              </div>
              <button
                onClick={() => setScheduleCollapsed((v) => !v)}
                className="text-[11px] text-[#999] hover:text-[#666] flex items-center gap-1 px-2 py-1 rounded hover:bg-[#F0EFED] transition-colors"
              >
                {scheduleCollapsed ? (
                  <>展开 <ChevronDown size={12} /></>
                ) : (
                  <>收起 <ChevronUp size={12} /></>
                )}
              </button>
            </div>
            {!scheduleCollapsed && <SchedulePage embedded />}
          </div>

          {/* Bottom: review queue (takes remaining height) */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ReviewPage embedded />
          </div>
        </SheetContent>
      </Sheet>

      {/* New conversation confirm dialog */}
      <AlertDialog open={confirmNewChatOpen} onOpenChange={setConfirmNewChatOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>开始新对话？</AlertDialogTitle>
            <AlertDialogDescription>
              当前对话历史将被清空，确认开始新对话吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                useAppStore.getState().clearMessages();
                setConfirmNewChatOpen(false);
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
