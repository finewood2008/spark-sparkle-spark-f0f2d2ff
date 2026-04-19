import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import {
  streamChat,
  streamEdit,
  creativeDialogue,
  suggestAngles,
  type IntentBrief,
  type DialogueTurn,
} from '../lib/ai-stream';
import { loadUserPrefs, getUserPrefsContext } from '../lib/user-prefs';
import { saveReviewItem } from '../lib/review-persistence';
import { useMemoryV2 } from '@/hooks/useMemoryV2';
import type { ChatMessage, ContentItem, ContentVersion, ChoiceOption, DistributionData, ReviewTaskData } from '../types/spark';
import type { MemoryEntry } from '../types/memory';

// Extracted sub-components
import { TypingIndicator } from './chat/ChatAtoms';
import { WelcomeState } from './chat/WelcomeState';
import { MessageBubble } from './chat/MessageBubble';
import { ChatInput } from './chat/ChatInput';
import { tryDetectScheduleIntent } from './chat/chat-utils';

/** Sentinel value sent when user clicks the "直接生成" escape button */
const FORCE_GENERATE_SENTINEL = '__spark_force_generate__';

/** Sentinel prefix for "apply this angle to an existing article" choice clicks.
 *  Format: __angle_revise__::<itemId>::<angle prompt> */
const ANGLE_REVISE_PREFIX = '__angle_revise__::';

/** State of an in-flight pre-creation dialogue */
interface DialogueState {
  originalPrompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  turn: number;
  /** Latest brief, if backend has signaled ready */
  brief?: IntentBrief;
}

export default function SparkChat({ getContext }: { getContext?: () => string }) {
  const {
    messages, addMessage, isGenerating, setIsGenerating,
    setContents, setSelectedContentId,
  } = useAppStore();
  const { persistEntry } = useMemoryV2();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Multi-turn pre-creation dialogue state
  const dialogueRef = useRef<DialogueState | null>(null);

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

  // Step 3: real generation, optionally with intent brief from analyze-intent
  const runGenerate = async (
    text: string,
    brief?: IntentBrief,
    chosenAngle?: string,
    dialogue?: { history: Array<{ role: 'user' | 'assistant'; content: string }>; turns: number },
  ) => {
    const statusId = (Date.now() + 1).toString();
    addMessage({
      id: statusId,
      role: 'assistant',
      content: brief && (brief.matchedAssets.length > 0 || chosenAngle)
        ? '✨ 好，按照这个方向开始创作...'
        : '',
      timestamp: new Date().toISOString(),
    });

    let rawContent = '';
    const userPrefs = loadUserPrefs();
    const platform = userPrefs.defaultPlatform;

    const intentPayload = brief
      ? {
          matchedAssets: brief.matchedAssets,
          matchedRules: brief.matchedRules,
          risks: brief.risks,
          chosenAngle,
        }
      : undefined;

    try {
      await streamChat({
        messages: [{ role: 'user', content: `请为"${text}"这个主题生成一篇文章。写作风格：${userPrefs.writingStyle}，语气：${userPrefs.writingTone}` }],
        mode: 'generate',
        platform,
        brandContext: getBrandContext(),
        intent: intentPayload,
        onDelta: (chunk) => {
          rawContent += chunk;
          const msgs = useAppStore.getState().messages;
          const updated = msgs.map(m =>
            m.id === statusId ? { ...m, content: '正在为你创作内容...' } : m
          );
          useAppStore.setState({ messages: updated });
        },
        onDone: () => {
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

          let parsed: { title: string; content: string; cta: string; tags: string[]; reasoning?: string[] };
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
            reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 4) : undefined,
            dialogueHistory: dialogue?.history,
            dialogueTurns: dialogue?.turns,
          };

          const currentContents = useAppStore.getState().contents;
          setContents([newItem, ...currentContents]);
          setSelectedContentId(newItem.id);

          // Initial choices: only "提交审核" — angle suggestions load async below
          const initialChoices: ChoiceOption[] = [
            { id: `submit-review-${newItem.id}`, label: '提交审核', emoji: '✅' },
          ];

          const msgs = useAppStore.getState().messages;
          const updated = msgs.map(m =>
            m.id === statusId
              ? { ...m, content: '✅ 已为你创作完成！', contentItem: newItem }
              : m
          );
          useAppStore.setState({ messages: updated });

          const suggestId = (Date.now() + 2).toString();
          addMessage({
            id: suggestId,
            role: 'assistant',
            content: '📋 你可以直接提交审核，我也在想几个新方向…',
            timestamp: new Date().toISOString(),
            choices: initialChoices,
            loadingChoices: true,
          });

          setIsGenerating(false);

          // Async: fetch content-aware angle suggestions and merge them in.
          // Each angle is a directional, content-specific prompt — NOT a
          // duplicate of card-level actions (润色/配图/换风格 etc).
          suggestAngles({
            title: parsed.title || text,
            content: parsed.content || rawContent,
            cta: parsed.cta,
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
            platform,
          }).then((angles) => {
            if (!angles.length) {
              const cur = useAppStore.getState().messages;
              const next = cur.map(m =>
                m.id === suggestId
                  ? {
                      ...m,
                      content: '📋 你可以直接提交审核，或继续告诉我想怎么改：',
                      loadingChoices: false,
                    }
                  : m
              );
              useAppStore.setState({ messages: next });
              return;
            }
            const angleChoices: ChoiceOption[] = angles.map(a => ({
              id: a.id,
              label: a.label,
              emoji: a.emoji,
              anglePrompt: a.anglePrompt,
            }));
            const cur = useAppStore.getState().messages;
            const next = cur.map(m =>
              m.id === suggestId
                ? {
                    ...m,
                    content: '💡 基于这篇文章，我想到几个可以试试的新方向：',
                    choices: [...initialChoices, ...angleChoices].slice(0, 5),
                    loadingChoices: false,
                  }
                : m
            );
            useAppStore.setState({ messages: next });
          });

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

  /**
   * Run one round of pre-creation dialogue. If `userReply` is provided, append
   * it to the running history. If the backend replies ready=true, jump straight
   * to runGenerate using the brief.
   */
  const runDialogueRound = async (userReply?: string, forceReady = false) => {
    const state = dialogueRef.current;
    if (!state) return;

    const history = userReply
      ? [...state.history, { role: 'user' as const, content: userReply }]
      : state.history;

    // Show typing indicator via shared isGenerating spinner
    setIsGenerating(true);

    const turn: DialogueTurn | null = await creativeDialogue({
      originalPrompt: state.originalPrompt,
      history,
      forceReady,
    });

    setIsGenerating(false);

    if (!turn) {
      // Hard failure → fall back to direct generation with what we have
      addMessage({
        id: `${Date.now()}-dlg-err`,
        role: 'assistant',
        content: '对话出了点问题，我直接开始为你创作。',
        timestamp: new Date().toISOString(),
      });
      const fallbackBrief: IntentBrief = {
        intentType: 'other',
        matchedAssets: [],
        matchedRules: [],
        risks: [],
        clarifyQuestion: null,
        skipClarify: true,
      };
      dialogueRef.current = null;
      setIsGenerating(true);
      await runGenerate(state.originalPrompt, fallbackBrief, userReply);
      return;
    }

    // Append latest exchange into running history
    const nextHistory = [
      ...history,
      { role: 'assistant' as const, content: turn.reply },
    ];
    state.history = nextHistory;
    state.turn = state.turn + 1;

    if (turn.ready && turn.brief) {
      // Render closing reply (no escape button — we're already moving on)
      addMessage({
        id: `${Date.now()}-dlg-ready`,
        role: 'assistant',
        content: turn.reply,
        timestamp: new Date().toISOString(),
      });
      const finalBrief: IntentBrief = {
        intentType: 'other',
        matchedAssets: turn.brief.matchedAssets,
        matchedRules: turn.brief.matchedRules,
        risks: turn.brief.risks,
        clarifyQuestion: null,
        skipClarify: true,
      };
      // Snapshot dialogue (excluding the very first user prompt — it's the
      // article topic itself, already shown as the article title context)
      const transcript = nextHistory.slice(1);
      const turns = state.turn;

      // 🧠 Memory: persist this session's brief into the context layer with
      // a 7-day expiry, so next time we discuss a similar topic, spark can
      // surface the angle/assets we already aligned on instead of starting
      // from zero. Fire-and-forget — never block generation on this.
      try {
        const nowIso = new Date().toISOString();
        const expIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const summaryParts: string[] = [
          `主题"${state.originalPrompt}"`,
          `角度"${turn.brief.chosenAngle}"`,
        ];
        if (turn.brief.matchedAssets.length > 0) {
          summaryParts.push(`用到 ${turn.brief.matchedAssets.join('、')}`);
        }
        const sessionEntry: MemoryEntry = {
          id:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          layer: 'context',
          category: 'session_summary',
          content: {
            topic: state.originalPrompt,
            chosenAngle: turn.brief.chosenAngle,
            matchedAssets: turn.brief.matchedAssets,
            matchedRules: turn.brief.matchedRules,
            risks: turn.brief.risks,
            turns,
            summary: summaryParts.join(' → '),
          },
          source: 'chat_extract',
          confidence: 0.9,
          expiresAt: expIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        // Don't await — generation must not wait on memory write
        void persistEntry(sessionEntry);
      } catch (err) {
        console.warn('[SparkChat] failed to persist session_summary:', err);
      }

      dialogueRef.current = null;
      setIsGenerating(true);
      await runGenerate(state.originalPrompt, finalBrief, turn.brief.chosenAngle, {
        history: transcript,
        turns,
      });
      return;
    }

    // Still gathering — render reply + suggestion cards + escape button
    const choices: ChoiceOption[] = turn.suggestions.map((s, i) => ({
      id: s.id || `dlg-${Date.now()}-${i}`,
      label: s.label,
      emoji: s.emoji,
      description: s.description,
      variant: 'card',
      // Reuse anglePrompt to carry the click-value (sent verbatim on tap)
      anglePrompt: s.value,
    }));
    // Always offer an escape route as a quick action
    addMessage({
      id: `${Date.now()}-dlg-${state.turn}`,
      role: 'assistant',
      content: turn.reply,
      timestamp: new Date().toISOString(),
      choices,
      actions: [
        {
          label: '直接生成',
          value: FORCE_GENERATE_SENTINEL,
          icon: '⚡',
          variant: 'outline',
        },
      ],
    });
  };

  /** Entry point when user asks to generate — kicks off the dialogue */
  const handleGenerate = async (text: string) => {
    dialogueRef.current = {
      originalPrompt: text,
      history: [{ role: 'user', content: text }],
      turn: 0,
    };
    await runDialogueRound();
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

    // Multi-turn dialogue handling: if we're in the middle of a pre-creation
    // dialogue, route this user reply (whether typed or via card click) back
    // into the dialogue loop instead of starting a new chat/generate cycle.
    if (dialogueRef.current) {
      const trimmed = text.trim();
      const isForce = trimmed === FORCE_GENERATE_SENTINEL;
      // Echo the user's reply (skip the sentinel — show a friendly label instead)
      addMessage({
        id: Date.now().toString(),
        role: 'user',
        content: isForce ? '直接生成' : trimmed,
        timestamp: new Date().toISOString(),
      });
      await runDialogueRound(isForce ? undefined : trimmed, isForce);
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
