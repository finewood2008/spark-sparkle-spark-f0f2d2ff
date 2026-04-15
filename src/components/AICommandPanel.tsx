import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Flame, AlertCircle, X, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { loadSettings } from '../lib/settings';
import { chatWithAI } from '../functions/chat.functions';
import type { ChatMessage } from '../types/spark';

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`} style={{ animation: 'spark-fade-in 0.25s ease' }}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-spark-gray-200' : 'spark-gradient'}`}>
        {isUser ? <User size={12} className="text-spark-gray-600" /> : <Bot size={12} className="text-primary-foreground" />}
      </div>
      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
        isUser ? 'bg-spark-orange text-primary-foreground rounded-tr-md' : 'bg-spark-gray-100 text-spark-gray-800 rounded-tl-md'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

export default function AICommandPanel() {
  const { messages, addMessage, isGenerating, setIsGenerating } = useAppStore();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        id: 'welcome',
        role: 'assistant',
        content: '嗨，我是火花 🔥\n告诉我你想创作什么，我来帮你生成。\n\n💡 未配置 API Key？去「设置」页面添加。',
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

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
      if (!settings.apiKey) throw new Error('请先在「设置」页面配置 API Key');

      const currentMessages = useAppStore.getState().messages;
      const history = currentMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const draftCtx = getDraftContext();
      const brandCtx = getBrandContext();
      const contextSuffix = draftCtx + brandCtx;

      const aiMessages = history.map((m, i) => {
        if (i === history.length - 1 && m.role === 'user' && contextSuffix) {
          return { ...m, content: m.content + contextSuffix };
        }
        return m;
      });

      let provider = settings.provider;
      let baseUrl = settings.baseUrl;
      if (provider === 'gemini' && baseUrl) {
        provider = 'custom';
        if (!baseUrl.includes('/v1')) baseUrl = baseUrl.replace(/\/+$/, '') + '/v1';
      }

      const result = await chatWithAI({
        data: { messages: aiMessages, provider, apiKey: settings.apiKey, baseUrl, model: settings.model },
      });

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.content,
        timestamp: new Date().toISOString(),
      });
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

  return (
    <div className="w-80 h-screen flex flex-col bg-spark-surface border-r border-spark-gray-200 shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-spark-gray-200 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg spark-gradient flex items-center justify-center">
          <Sparkles size={14} className="text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-spark-gray-800">AI 指挥舱</h2>
          <p className="text-[10px] text-spark-gray-400">告诉火花你想做什么</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
          <AlertCircle size={12} />
          <span className="flex-1 truncate">{error}</span>
          <button onClick={() => setError(null)}><X size={12} /></button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
        {isGenerating && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full spark-gradient flex items-center justify-center shrink-0">
              <Bot size={12} className="text-primary-foreground" />
            </div>
            <div className="bg-spark-gray-100 rounded-2xl rounded-tl-md px-4 py-3 flex gap-1">
              {[0, 150, 300].map(d => (
                <span key={d} className="w-1.5 h-1.5 rounded-full bg-spark-gray-400" style={{ animation: `spark-bounce 1.4s infinite ease-in-out both`, animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-spark-gray-200 p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你想生成的内容..."
            rows={2}
            className="spark-input h-auto min-h-[2.5rem] max-h-24 resize-none py-2 text-[13px]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="spark-btn-primary px-3 py-2 disabled:opacity-40 shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
