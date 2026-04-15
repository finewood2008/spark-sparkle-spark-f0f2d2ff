import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Sparkles, AlertCircle, X, FileText, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { streamChat } from '../lib/ai-stream';
import { getUserPrefsContext, loadUserPrefs } from '../lib/user-prefs';
import { toast } from 'sonner';
import type { ChatMessage, ContentItem, Platform } from '../types/spark';

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
  const {
    messages, addMessage, isGenerating, setIsGenerating,
    contents, setContents, setSelectedContentId, setActiveTab,
  } = useAppStore();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [genPlatform, setGenPlatform] = useState<Platform>('xiaohongshu');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        id: 'welcome',
        role: 'assistant',
        content: '嗨，我是火花 🔥\n\n我可以帮你：\n• 讨论选题和内容方向\n• 生成完整文章 → 直接进入草稿\n• 提供品牌和策略建议\n\n告诉我你想聊什么，或点击下方「生成文章」按钮开始创作！',
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const getBrandContext = useCallback(() => {
    const store = useAppStore.getState();
    const parts: string[] = [];
    if (store.brand?.initialized) {
      const b = store.brand;
      parts.push(`\n品牌名: ${b.name}\n行业: ${b.industry}\n主营: ${b.mainBusiness}\n目标客户: ${b.targetCustomer}\n语气: ${b.toneOfVoice}\n关键词: ${b.keywords.join(', ')}`);
    }
    parts.push(getUserPrefsContext());
    return parts.join('\n');
  }, []);

  // Chat mode - discussion only
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

    await streamChat({
      messages: history,
      mode: 'chat',
      brandContext: getBrandContext(),
      onDelta: (chunk) => {
        assistantContent += chunk;
        // Update last assistant message
        const msgs = useAppStore.getState().messages;
        const updated = msgs.map(m =>
          m.id === assistantId ? { ...m, content: assistantContent } : m
        );
        useAppStore.setState({ messages: updated });
      },
      onDone: () => {
        setIsGenerating(false);
      },
      onError: (errMsg) => {
        setError(errMsg);
        const msgs = useAppStore.getState().messages;
        const updated = msgs.map(m =>
          m.id === assistantId ? { ...m, content: `⚠️ ${errMsg}` } : m
        );
        useAppStore.setState({ messages: updated });
        setIsGenerating(false);
      },
    });
  };

  // Generate article - creates a draft
  const handleGenerateArticle = async () => {
    const topic = input.trim();
    if (!topic) {
      toast.error('请先输入文章主题或描述');
      return;
    }
    if (isGeneratingArticle || isGenerating) return;

    setIsGeneratingArticle(true);
    setInput('');

    // Add user message for context
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: `📝 生成${genPlatform === 'xiaohongshu' ? '小红书' : genPlatform === 'wechat' ? '公众号' : '抖音'}文章：${topic}`,
      timestamp: new Date().toISOString(),
    });

    const statusId = (Date.now() + 1).toString();
    addMessage({
      id: statusId,
      role: 'assistant',
      content: '🔄 正在生成文章...',
      timestamp: new Date().toISOString(),
    });

    let rawContent = '';

    await streamChat({
      messages: [{ role: 'user', content: `请为"${topic}"这个主题生成一篇文章。` }],
      mode: 'generate',
      platform: genPlatform,
      brandContext: getBrandContext(),
      onDelta: (chunk) => {
        rawContent += chunk;
      },
      onDone: () => {
        // Parse generated content
        let parsed: { title: string; content: string; cta: string; tags: string[] };
        try {
          let cleaned = rawContent.trim();
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
          }
          parsed = JSON.parse(cleaned);
        } catch {
          parsed = { title: topic, content: rawContent, cta: '', tags: [] };
        }

        // Create draft
        const newItem: ContentItem = {
          id: Date.now().toString(),
          title: parsed.title || topic,
          content: parsed.content || rawContent,
          platform: genPlatform,
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
        setActiveTab('studio');

        // Update status message
        const msgs = useAppStore.getState().messages;
        const updated = msgs.map(m =>
          m.id === statusId
            ? { ...m, content: `✅ 文章已生成并保存到草稿！\n📄 标题：${newItem.title}\n\n你可以在右侧编辑画布中查看和修改内容。` }
            : m
        );
        useAppStore.setState({ messages: updated });

        toast.success('文章已生成，进入草稿编辑');
        setIsGeneratingArticle(false);
      },
      onError: (errMsg) => {
        const msgs = useAppStore.getState().messages;
        const updated = msgs.map(m =>
          m.id === statusId ? { ...m, content: `⚠️ 生成失败：${errMsg}` } : m
        );
        useAppStore.setState({ messages: updated });
        toast.error(errMsg);
        setIsGeneratingArticle(false);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const busy = isGenerating || isGeneratingArticle;

  return (
    <div className="w-80 h-screen flex flex-col bg-spark-surface border-r border-spark-gray-200 shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-spark-gray-200 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg spark-gradient flex items-center justify-center">
          <Sparkles size={14} className="text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-spark-gray-800">AI 指挥舱</h2>
          <p className="text-[10px] text-spark-gray-400">讨论方向 · 生成文章 · 策略建议</p>
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
        {isGenerating && !isGeneratingArticle && (
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

      {/* Generate Article Section */}
      <div className="border-t border-spark-gray-200 px-3 py-2 bg-spark-gray-50">
        <div className="flex items-center gap-2 mb-2">
          <select
            value={genPlatform}
            onChange={(e) => setGenPlatform(e.target.value as Platform)}
            className="spark-input h-7 w-auto text-[11px] py-0"
          >
            <option value="xiaohongshu">小红书</option>
            <option value="wechat">公众号</option>
            <option value="douyin">抖音</option>
          </select>
          <button
            onClick={handleGenerateArticle}
            disabled={!input.trim() || busy}
            className="flex-1 spark-btn-primary text-[11px] py-1.5 disabled:opacity-40"
          >
            {isGeneratingArticle ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            {isGeneratingArticle ? '生成中...' : '生成文章 → 草稿'}
          </button>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-spark-gray-200 p-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入主题生成文章，或直接聊天讨论..."
            rows={2}
            className="spark-input h-auto min-h-[2.5rem] max-h-24 resize-none py-2 text-[13px]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || busy}
            className="spark-btn-secondary px-3 py-2 disabled:opacity-40 shrink-0"
            title="发送讨论消息"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[10px] text-spark-gray-300 mt-1">Enter 发送讨论 · 点击上方按钮生成文章</p>
      </div>
    </div>
  );
}
