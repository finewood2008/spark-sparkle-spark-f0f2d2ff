import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, User, Bot, Flame, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { loadSettings } from '../lib/settings';
import { chatWithAI } from '../functions/chat.functions';
import type { ChatMessage } from '../types/spark';

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`} style={{ animation: 'spark-fade-in 0.3s ease' }}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-spark-gray-200' : 'spark-gradient'}`}>
        {isUser ? <User size={14} className="text-spark-gray-600" /> : <Bot size={14} className="text-primary-foreground" />}
      </div>
      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser ? 'bg-spark-orange text-primary-foreground rounded-tr-md' : 'bg-spark-gray-100 text-spark-gray-800 rounded-tl-md'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

export default function SparkAssistant() {
  const { messages, addMessage, isGenerating, setIsGenerating } = useAppStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        id: 'welcome',
        role: 'assistant',
        content: '嗨，我是火花 🔥 有什么想做的，直接说。\n\n💡 如果还没配置 API Key，请先去「设置」页面填写。',
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const getDraftContext = useCallback(() => {
    const store = useAppStore.getState();
    const id = store.selectedContentId;
    if (!id) return '';
    const item = store.contents.find(c => c.id === id);
    if (!item) return '';
    return `\n\n[当前草稿上下文]\n标题: ${item.title || '(空)'}\n正文: ${item.content || '(空)'}\n平台: ${item.platform}\nCTA: ${item.cta || '(空)'}\n标签: ${(item.tags || []).join(', ') || '(空)'}`;
  }, []);

  const getBrandContext = useCallback(() => {
    const store = useAppStore.getState();
    if (!store.brand || !store.brand.initialized) return '';
    const b = store.brand;
    return `\n\n[品牌信息]\n品牌名: ${b.name}\n行业: ${b.industry}\n主营: ${b.mainBusiness}\n目标客户: ${b.targetCustomer}\n差异化: ${b.differentiation}\n语气: ${b.toneOfVoice}\n关键词: ${b.keywords.join(', ')}\n禁用词: ${b.tabooWords.join(', ')}`;
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isGenerating) return;

    setError(null);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput('');
    setIsGenerating(true);

    try {
      const settings = loadSettings();

      if (!settings.apiKey) {
        throw new Error('请先在「设置」页面配置 API Key');
      }

      // Build message history for AI
      const currentMessages = useAppStore.getState().messages;
      const history = currentMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      // Add context to the last user message
      const draftCtx = getDraftContext();
      const brandCtx = getBrandContext();
      const contextSuffix = draftCtx + brandCtx;

      const aiMessages = history.map((m, i) => {
        if (i === history.length - 1 && m.role === 'user' && contextSuffix) {
          return { ...m, content: m.content + contextSuffix };
        }
        return m;
      });

      // Determine actual API URL - if user set a proxy baseUrl for gemini, use it
      let provider = settings.provider;
      let baseUrl = settings.baseUrl;

      if (provider === 'gemini' && baseUrl) {
        // User has a CF Worker proxy, use it as custom endpoint
        provider = 'custom';
        // Ensure the baseUrl ends with compatible path
        if (!baseUrl.includes('/v1')) {
          baseUrl = baseUrl.replace(/\/+$/, '') + '/v1';
        }
      }

      const result = await chatWithAI({
        data: {
          messages: aiMessages,
          provider,
          apiKey: settings.apiKey,
          baseUrl,
          model: settings.model,
        },
      });

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.content,
        timestamp: new Date().toISOString(),
      };
      addMessage(botMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '发生未知错误';
      setError(message);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ ${message}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const [lastSeenCount, setLastSeenCount] = useState(0);
  const unread = open ? 0 : Math.max(0, messages.filter(m => m.role === 'assistant').length - lastSeenCount);

  useEffect(() => {
    if (open) {
      setLastSeenCount(messages.filter(m => m.role === 'assistant').length);
    }
  }, [open, messages]);

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full spark-gradient shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center spark-shadow"
        >
          <MessageCircle size={22} className="text-primary-foreground" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] h-[520px] rounded-2xl bg-spark-surface shadow-2xl border border-spark-gray-200 flex flex-col overflow-hidden" style={{ animation: 'spark-slide-up 0.3s ease' }}>
          {/* Header */}
          <div className="spark-gradient px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-primary-foreground" />
              <span className="font-semibold text-primary-foreground text-sm">火花助理</span>
              <span className="text-[10px] text-primary-foreground/70">AI 驱动</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-primary-foreground/20 rounded-lg transition-colors">
              <X size={16} className="text-primary-foreground" />
            </button>
          </div>

          {/* Error banner */}
          {error && (
            <div className="px-3 py-2 bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
              <AlertCircle size={12} />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-destructive/60 hover:text-destructive">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
            {isGenerating && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full spark-gradient flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-primary-foreground" />
                </div>
                <div className="bg-spark-gray-100 rounded-2xl rounded-tl-md px-4 py-3 flex gap-1">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-2 h-2 rounded-full bg-spark-gray-400" style={{ animation: `spark-bounce 1.4s infinite ease-in-out both`, animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-spark-gray-200 p-3 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              className="spark-input flex-1"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              className="spark-btn-primary px-3 disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
