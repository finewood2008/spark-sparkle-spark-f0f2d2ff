import { useMemo, useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  MessageSquare,
  Pencil,
  Trash2,
  FileText,
  ClipboardCheck,
  Zap,
  Brain,
  User,
  Settings,
  MoreHorizontal,
  Pin,
  PinOff,
} from 'lucide-react';
import { useConversations } from '@/hooks/useConversations';
import { useConversationStore } from '@/store/conversationStore';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useAuthStore } from '@/store/authStore';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type WorkspaceView = 'chat' | 'drafts' | 'review' | 'schedule' | 'memory';

interface ConversationSidebarProps {
  activeView: WorkspaceView;
  onChangeView: (v: WorkspaceView) => void;
  reviewingCount: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const PANEL_ITEMS: Array<{
  key: WorkspaceView;
  label: string;
  icon: typeof FileText;
}> = [
  { key: 'drafts', label: '草稿箱', icon: FileText },
  { key: 'review', label: '审核中心', icon: ClipboardCheck },
  { key: 'schedule', label: '自动任务', icon: Zap },
  { key: 'memory', label: '火花记忆', icon: Brain },
];

export default function ConversationSidebar({
  activeView,
  onChangeView,
  reviewingCount,
  collapsed,
  onToggleCollapsed,
}: ConversationSidebarProps) {
  const {
    conversations,
    activeId,
    openConversation,
    newConversation,
    renameConversation,
    deleteConversation,
    togglePinConversation,
  } = useConversations();
  const loading = useConversationStore((s) => s.loading);
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const router = useRouter();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const pinnedConversations = useMemo(
    () => conversations.filter((c) => c.pinned),
    [conversations],
  );
  const regularConversations = useMemo(
    () => conversations.filter((c) => !c.pinned),
    [conversations],
  );

  const handleNew = async () => {
    onChangeView('chat');
    await newConversation();
  };

  const handleSelect = async (id: string) => {
    onChangeView('chat');
    if (id !== activeId) await openConversation(id);
  };

  const startRename = (id: string, current: string) => {
    setMenuOpenId(null);
    setRenamingId(id);
    setRenameValue(current);
  };

  const commitRename = async () => {
    if (renamingId && renameValue.trim()) {
      await renameConversation(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const confirmDelete = async () => {
    if (deletingId) {
      await deleteConversation(deletingId);
      setDeletingId(null);
    }
  };

  const preloadAccount = () => {
    router.preloadRoute({ to: '/account' }).catch(() => {});
    router.preloadRoute({ to: '/auth' }).catch(() => {});
  };

  // ---------------- Collapsed (icon-only) sidebar ----------------
  if (collapsed) {
    return (
      <aside className="h-full w-14 border-r border-[#EEEDEB] bg-[#F7F6F3] flex flex-col items-center py-2 gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleCollapsed}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#333] hover:bg-[#EEEDEB]"
              aria-label="展开侧栏"
            >
              <PanelLeftOpen size={18} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">展开侧栏</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleNew}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#FF6B1A] hover:bg-[#EEEDEB]"
              aria-label="新建对话"
            >
              <Plus size={18} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">新建对话</TooltipContent>
        </Tooltip>
        <div className="my-1 w-7 border-t border-[#E5E4E2]" />
        {PANEL_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.key;
          return (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onChangeView(item.key)}
                  className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    active
                      ? 'bg-white text-[#FF6B1A] shadow-sm'
                      : 'text-[#999] hover:text-[#333] hover:bg-[#EEEDEB]'
                  }`}
                  aria-label={item.label}
                >
                  <Icon size={18} />
                  {item.key === 'review' && reviewingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                      {reviewingCount > 9 ? '9+' : reviewingCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
        <div className="mt-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() =>
                  navigate({ to: isAuthenticated ? '/account' : '/auth' })
                }
                onMouseEnter={preloadAccount}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999] hover:text-[#333] hover:bg-[#EEEDEB]"
                aria-label="个人中心"
              >
                <User size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">个人中心</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    );
  }

  // ---------------- Expanded sidebar ----------------
  return (
    <>
      <aside className="h-full w-[260px] border-r border-[#EEEDEB] bg-[#F7F6F3] flex flex-col shrink-0">
        {/* Header */}
        <div className="px-3 py-2.5 flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #FF8C42, #FF6B1A)' }}
          >
            <span className="text-[12px]">✨</span>
          </div>
          <span className="text-[14px] font-semibold text-[#333] flex-1">火花</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapsed}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#999] hover:text-[#666] hover:bg-[#EEEDEB]"
                aria-label="折叠侧栏"
              >
                <PanelLeftClose size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">折叠侧栏</TooltipContent>
          </Tooltip>
        </div>

        {/* New chat */}
        <div className="px-3 pb-2">
          <button
            onClick={handleNew}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5E4E2] bg-white text-[13px] text-[#333] hover:border-[#FF6B1A]/40 hover:text-[#FF6B1A] transition-colors"
          >
            <Plus size={15} />
            <span>新建对话</span>
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {!isAuthenticated ? (
            <div className="px-3 py-6 text-center text-[12px] text-[#999] leading-relaxed">
              登录后可保存对话历史
              <button
                onClick={() => navigate({ to: '/auth' })}
                className="block mx-auto mt-2 text-[#FF6B1A] hover:underline"
              >
                去登录 →
              </button>
            </div>
          ) : loading && conversations.length === 0 ? (
            <div className="px-3 py-4 text-[12px] text-[#999]">加载中…</div>
          ) : conversations.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-[#BBB]">
              还没有对话，点上面「新建对话」开始吧～
            </div>
          ) : (
            (() => {
              const renderItem = (c: typeof conversations[number]) => {
                const active = activeView === 'chat' && c.id === activeId;
                const isRenaming = renamingId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`group relative rounded-lg flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors ${
                      active
                        ? 'bg-white shadow-sm'
                        : 'hover:bg-[#EEEDEB]'
                    }`}
                    onClick={() => !isRenaming && handleSelect(c.id)}
                  >
                    {c.pinned ? (
                      <Pin
                        size={12}
                        className={
                          active
                            ? 'text-[#FF6B1A] fill-[#FF6B1A]'
                            : 'text-[#FF6B1A]/70 fill-[#FF6B1A]/70'
                        }
                      />
                    ) : (
                      <MessageSquare
                        size={14}
                        className={active ? 'text-[#FF6B1A]' : 'text-[#999]'}
                      />
                    )}
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-white border border-[#FF6B1A]/40 rounded px-1.5 py-0.5 text-[13px] outline-none"
                      />
                    ) : (
                      <span
                        className={`flex-1 truncate text-[13px] ${
                          active ? 'text-[#333] font-medium' : 'text-[#666]'
                        }`}
                      >
                        {c.title}
                      </span>
                    )}
                    {!isRenaming && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === c.id ? null : c.id);
                        }}
                        className={`shrink-0 w-6 h-6 rounded flex items-center justify-center text-[#999] hover:text-[#333] hover:bg-[#EEEDEB] transition-opacity ${
                          active || menuOpenId === c.id
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    )}
                    {menuOpenId === c.id && (
                      <div
                        className="absolute right-1 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-[#E5E4E2] py-1 w-32"
                        onMouseLeave={() => setMenuOpenId(null)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(null);
                            void togglePinConversation(c.id);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#666] hover:bg-[#F7F6F3]"
                        >
                          {c.pinned ? (
                            <>
                              <PinOff size={13} /> 取消置顶
                            </>
                          ) : (
                            <>
                              <Pin size={13} /> 置顶
                            </>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(c.id, c.title);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#666] hover:bg-[#F7F6F3]"
                        >
                          <Pencil size={13} /> 重命名
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(null);
                            setDeletingId(c.id);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={13} /> 删除
                        </button>
                      </div>
                    )}
                  </div>
                );
              };
              return (
                <>
                  {pinnedConversations.length > 0 && (
                    <div className="mb-2">
                      <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-wider text-[#BBB] font-medium flex items-center gap-1">
                        <Pin size={10} className="fill-[#BBB]" />
                        置顶
                      </div>
                      <div className="space-y-0.5">
                        {pinnedConversations.map(renderItem)}
                      </div>
                    </div>
                  )}
                  {regularConversations.length > 0 && (
                    <div>
                      {pinnedConversations.length > 0 && (
                        <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-wider text-[#BBB] font-medium">
                          最近
                        </div>
                      )}
                      <div className="space-y-0.5">
                        {regularConversations.map(renderItem)}
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>

        {/* Bottom panel switcher */}
        <div className="border-t border-[#E5E4E2] px-2 py-2 space-y-0.5">
          {PANEL_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onChangeView(item.key)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] transition-colors ${
                  active
                    ? 'bg-white text-[#FF6B1A] shadow-sm font-medium'
                    : 'text-[#666] hover:bg-[#EEEDEB] hover:text-[#333]'
                }`}
              >
                <Icon size={15} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.key === 'review' && reviewingCount > 0 && (
                  <span className="text-[10px] bg-red-500 text-white rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-semibold">
                    {reviewingCount > 9 ? '9+' : reviewingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User footer */}
        <div className="border-t border-[#E5E4E2] px-2 py-2">
          <button
            onClick={() => navigate({ to: isAuthenticated ? '/account' : '/auth' })}
            onMouseEnter={preloadAccount}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-[#666] hover:bg-[#EEEDEB] hover:text-[#333] transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#FF8C42] to-[#FF6B1A] flex items-center justify-center text-white text-[11px] font-medium">
              {isAuthenticated && user?.email ? user.email[0].toUpperCase() : <User size={13} />}
            </div>
            <span className="flex-1 text-left truncate">
              {isAuthenticated ? user?.email || '个人中心' : '登录 / 注册'}
            </span>
          </button>
        </div>
      </aside>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个对话？</AlertDialogTitle>
            <AlertDialogDescription>
              这条会话以及里面的所有消息会被永久删除，无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
