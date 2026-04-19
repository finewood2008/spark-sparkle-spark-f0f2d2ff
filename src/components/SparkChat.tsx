import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { streamChat } from '../lib/ai-stream';
import { loadUserPrefs, getUserPrefsContext } from '../lib/user-prefs';
import { saveReviewItem } from '../lib/review-persistence';
import { useAuthStore } from '../store/authStore';
import type { ChatMessage, ContentItem, ChoiceOption, DistributionData, ScheduleCardData, ReviewTaskData } from '../types/spark';

// Extracted sub-components
import { TypingIndicator } from './chat/ChatAtoms';
import { WelcomeState } from './chat/WelcomeState';
import { MessageBubble } from './chat/MessageBubble';
import { ChatInput } from './chat/ChatInput';
import { generateSuggestions, tryDetectScheduleIntent } from './chat/chat-utils';

export default function SparkChat({ getContext }: { getContext?: () => string }) {
  const {
    messages, addMessage, isGenerating, setIsGenerating,
    setContents, setSelectedContentId,
  } = useAppStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasMessages = messages.length > 0;

  // Pick up a pending prompt from the landing page (set in sessionStorage before /auth)
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('spark.pendingPrompt');
      if (pending) {
        sessionStorage.removeItem('spark.pendingPrompt');
        setInput(pending);
        requestAnimationFrame(() => {
          const ta = inputRef.current;
          if (ta) {
            ta.focus();
            ta.setSelectionRange(pending.length, pending.length);
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 128) + 'px';
          }
        });
      }
    } catch {
      /* ignore storage errors */
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const getBrandContext = useCallback(() => {
    // Memory v2: brand identity + preferences come from useMemoryStore via
    // ChatLayout's getContext (chat mode). For generate mode, ai-stream's
    // resolveBrandContext pulls v2 directly when no explicit context is passed.
    // We still always append user prefs (platform/tone/length defaults).
    const parts: string[] = [];
    if (getContext) {
      const ctx = getContext();
      if (ctx) parts.push(ctx);
    }
    parts.push(getUserPrefsContext());
    return parts.join('\n');
  }, [getContext]);

  const submitForReview = useCallback(async () => {
    // Find the most recent draft content item
    const all = useAppStore.getState().contents;
    const draft = all.find(c => c.status === 'draft');
    if (!draft) {
      addMessage({
        id: `${Date.now()}-no-draft`,
        role: 'assistant',
        content: '咦，没有找到待提交的草稿哦～请先生成一篇内容再提交审核。',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    // Update status → reviewing
    const updatedItem: ContentItem = { ...draft, status: 'reviewing', updatedAt: new Date().toISOString() };
    setContents(all.map(c => (c.id === draft.id ? updatedItem : c)));

    // Persist
    const task: ReviewTaskData = {
      source: 'manual',
      taskName: '手动创作',
      triggeredAt: new Date().toISOString(),
    };
    await saveReviewItem(updatedItem, task);

    addMessage({
      id: `${Date.now()}-submitted`,
      role: 'assistant',
      content: '✅ 已提交到审核中心，你可以随时去审核页查看和操作。',
      timestamp: new Date().toISOString(),
      reviewReminder: {
        taskName: '手动创作',
        message: '内容已进入审核中心，待你审核',
        item: { id: updatedItem.id, title: updatedItem.title, content: updatedItem.content, status: 'reviewing' },
      },
    });
  }, [addMessage, setContents]);

  const handleChat = async (text: string) => {
    const currentMessages = useAppStore.getState().messages;
    const history = currentMessages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    let assistantContent = '';
    const assistantId = (Date.now() + 1).toString();

    addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    });

    try {
      await streamChat({
        messages: history,
        mode: 'chat',
        brandContext: getBrandContext(),
        onDelta: (chunk) => {
          assistantContent += chunk;
          const msgs = useAppStore.getState().messages;
          const updated = msgs.map(m =>
            m.id === assistantId ? { ...m, content: assistantContent } : m
          );
          useAppStore.setState({ messages: updated });
        },
        onDone: () => {
          // If nothing came back, treat as failure
          if (!assistantContent.trim()) {
            const msgs = useAppStore.getState().messages;
            const updated = msgs.map(m =>
              m.id === assistantId
                ? {
                    ...m,
                    content: 'AI 没有返回任何内容',
                    error: { message: '可能是网络中断或服务暂时不可用', retryPrompt: text, retryMode: 'chat' as const },
                  }
                : m
            );
            useAppStore.setState({ messages: updated });
          }
          setIsGenerating(false);
        },
        onError: (errMsg) => {
          const msgs = useAppStore.getState().messages;
          const updated = msgs.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  content: '生成回复时出错了',
                  error: { message: errMsg, retryPrompt: text, retryMode: 'chat' as const },
                }
              : m
          );
          useAppStore.setState({ messages: updated });
          setIsGenerating(false);
        },
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : '网络请求失败';
      const msgs = useAppStore.getState().messages;
      const updated = msgs.map(m =>
        m.id === assistantId
          ? {
              ...m,
              content: '连接 AI 服务失败',
              error: { message: errMsg, retryPrompt: text, retryMode: 'chat' as const },
            }
          : m
      );
      useAppStore.setState({ messages: updated });
      setIsGenerating(false);
    }
  };

  const handleGenerate = async (text: string) => {
    const statusId = (Date.now() + 1).toString();
    addMessage({
      id: statusId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    });

    let rawContent = '';
    const userPrefs = loadUserPrefs();
    const platform = userPrefs.defaultPlatform;

    try {
      await streamChat({
        messages: [{ role: 'user', content: `请为"${text}"这个主题生成一篇文章。写作风格：${userPrefs.writingStyle}，语气：${userPrefs.writingTone}` }],
        mode: 'generate',
        platform,
        brandContext: getBrandContext(),
        onDelta: (chunk) => {
          rawContent += chunk;
          // Show progress
          const msgs = useAppStore.getState().messages;
          const updated = msgs.map(m =>
            m.id === statusId ? { ...m, content: '正在为你创作内容...' } : m
          );
          useAppStore.setState({ messages: updated });
        },
        onDone: () => {
          // Empty response → treat as failure with retry
          if (!rawContent.trim()) {
            const msgs = useAppStore.getState().messages;
            const updated = msgs.map(m =>
              m.id === statusId
                ? {
                    ...m,
                    content: '没收到 AI 返回的内容',
                    error: { message: '可能是网络中断或服务暂时不可用', retryPrompt: text, retryMode: 'generate' as const },
                  }
                : m
            );
            useAppStore.setState({ messages: updated });
            setIsGenerating(false);
            return;
          }

          let parsed: { title: string; content: string; cta: string; tags: string[] };
          try {
            let cleaned = rawContent.trim();
            if (cleaned.startsWith('```')) {
              cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
            }
            parsed = JSON.parse(cleaned);
          } catch {
            parsed = { title: text, content: rawContent, cta: '', tags: [] };
          }

          const newItem: ContentItem = {
            id: Date.now().toString(),
            title: parsed.title || text,
            content: parsed.content || rawContent,
            platform,
            status: 'draft',
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
            cta: parsed.cta || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            autoGenerated: true,
          };

          const currentContents = useAppStore.getState().contents;
          setContents([newItem, ...currentContents]);
          setSelectedContentId(newItem.id);

          // Generate context-aware suggestions; prepend a "提交审核" action
          const suggestions: ChoiceOption[] = [
            { id: `submit-review-${newItem.id}`, label: '提交审核', emoji: '✅' },
            ...generateSuggestions(parsed.title, parsed.content, parsed.tags),
          ].slice(0, 4);

          // Update message with content card and suggestions
          const msgs = useAppStore.getState().messages;
          const updated = msgs.map(m =>
            m.id === statusId
              ? { ...m, content: '✅ 已为你创作完成！', contentItem: newItem }
              : m
          );
          useAppStore.setState({ messages: updated });

          // Add a follow-up message with suggestions
          const suggestId = (Date.now() + 2).toString();
          addMessage({
            id: suggestId,
            role: 'assistant',
            content: '📋 你可以直接提交审核，或先让我帮你优化：',
            timestamp: new Date().toISOString(),
            choices: suggestions,
          });

          setIsGenerating(false);
        },
        onError: (errMsg) => {
          const msgs = useAppStore.getState().messages;
          const updated = msgs.map(m =>
            m.id === statusId
              ? {
                  ...m,
                  content: '生成失败了',
                  error: { message: errMsg, retryPrompt: text, retryMode: 'generate' as const },
                }
              : m
          );
          useAppStore.setState({ messages: updated });
          setIsGenerating(false);
        },
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : '网络请求失败';
      const msgs = useAppStore.getState().messages;
      const updated = msgs.map(m =>
        m.id === statusId
          ? {
              ...m,
              content: '连接 AI 服务失败',
              error: { message: errMsg, retryPrompt: text, retryMode: 'generate' as const },
            }
          : m
      );
      useAppStore.setState({ messages: updated });
      setIsGenerating(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isGenerating) return;
    setInput('');

    // Special-case: "提交审核" choice — skip AI, submit current draft
    if (text.trim() === '提交审核') {
      addMessage({
        id: Date.now().toString(),
        role: 'user',
        content: '提交审核',
        timestamp: new Date().toISOString(),
      });
      await submitForReview();
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);

    // Schedule intent: short-circuit to a ScheduleCard instead of generating
    const scheduleCard = tryDetectScheduleIntent(text);
    if (scheduleCard) {
      addMessage({
        id: `${Date.now()}-sched-card`,
        role: 'assistant',
        content: '听起来你想创建一个定时任务，我帮你拟了一份计划，确认一下👇',
        timestamp: new Date().toISOString(),
        scheduleCard,
      });
      return;
    }

    setIsGenerating(true);

    // Determine if this should generate an article or just chat
    const isGenerate = /写|生成|创作|种草|文案|文章|笔记|帖子|推文/.test(text);

    if (isGenerate) {
      await handleGenerate(text.trim());
    } else {
      await handleChat(text.trim());
    }
  };

  const handleRetry = useCallback(async (msg: ChatMessage) => {
    if (!msg.error?.retryPrompt) return;
    // Remove the failed message, then re-run the original handler
    const msgs = useAppStore.getState().messages.filter(m => m.id !== msg.id);
    useAppStore.setState({ messages: msgs });
    setIsGenerating(true);
    if (msg.error.retryMode === 'generate') {
      await handleGenerate(msg.error.retryPrompt);
    } else {
      await handleChat(msg.error.retryPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIsGenerating]);

  const pushDistributionCard = useCallback((item: ContentItem) => {
    const distribution: DistributionData = {
      contentId: item.id,
      title: item.title,
      defaultPlatforms: [item.platform],
    };
    addMessage({
      id: `${Date.now()}-dist`,
      role: 'assistant',
      content: `太好了！「${item.title}」已就绪，请选择要分发的平台：`,
      timestamp: new Date().toISOString(),
      distribution,
    });
  }, [addMessage]);

  const handleCardAction = useCallback((action: string, item?: ContentItem) => {
    // Distribution flow: approve / publish / distribute → push DistributionCard
    if (item && (action === 'approve' || action === 'distribute' || action === 'publish')) {
      pushDistributionCard(item);
      return;
    }
    const actionMap: Record<string, string> = {
      restyle: `请帮我把「${item?.title || '这篇文章'}」换一种风格重新写`,
      write_sequel: `请针对「${(item as any)?.title || '上篇内容'}」写一篇续集`,
      analyze_trend: '请分析一下最近的内容数据趋势，给我一些建议',
    };
    const text = actionMap[action];
    if (text) sendMessage(text);
  }, [pushDistributionCard]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      {!hasMessages ? (
        <WelcomeState onSuggestion={(text) => sendMessage(text)} />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onSend={sendMessage}
                onCardAction={handleCardAction}
                onRetry={handleRetry}
              />
            ))}
            {isGenerating && <TypingIndicator />}
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        input={input}
        setInput={setInput}
        onSend={sendMessage}
        isGenerating={isGenerating}
        inputRef={inputRef}
      />
    </div>
  );
}
