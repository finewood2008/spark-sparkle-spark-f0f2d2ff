import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { streamChat } from '../lib/ai-stream';
import type { ChatMessage, ContentItem } from '../types/spark';
import ContentCard from './ContentCard';
import DataReportCard, { type ReportData } from './DataReportCard';

function SparkAvatar({ size = 32 }: { size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #FF8C42, #FF6B1A)',
      }}
    >
      <span style={{ fontSize: size * 0.45 }}>✨</span>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="relative">
        <SparkAvatar size={32} />
        <span className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full bg-spark-orange animate-pulse" />
      </div>
      <div className="chat-bubble-assistant px-4 py-3 flex items-center gap-1.5">
        <span className="text-[14px] text-[#999]">火花正在撰写中</span>
        <span className="inline-flex gap-0.5">
          {[0, 150, 300].map(d => (
            <span
              key={d}
              className="w-1 h-1 rounded-full bg-[#999] inline-block"
              style={{ animation: `spark-bounce 1.4s infinite ease-in-out both`, animationDelay: `${d}ms` }}
            />
          ))}
        </span>
        <span className="w-[2px] h-4 bg-spark-orange animate-pulse ml-1" />
      </div>
    </div>
  );
}

// Mock data for welcome briefing
const mockReport: ReportData = {
  title: '5个让你皮肤发光的晨间习惯',
  platform: 'xiaohongshu',
  metrics: { views: 12800, likes: 986, comments: 234, saves: 567 },
  sparkComment: '这篇笔记的互动率达到了 13.9%，远超行业平均水平，收藏率尤其突出。',
  topComments: [
    { user: '小美同学', text: '第三个方法真的有用！已经坚持一周了' },
    { user: '护肤达人Lisa', text: '请问用的什么牌子的洁面？求推荐' },
    { user: '早起打卡', text: '收藏了，明天开始试试看' },
  ],
  sparkAdvice: '评论区对产品推荐有强烈需求，建议下一篇可以做一个「晨间护肤好物清单」，趁热度做系列内容。',
};

function WelcomeState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const suggestions = [
    '好的，帮我写一篇护肤好物清单',
    '换个方向，分析一下最近的爆款选题',
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {/* Spark greeting */}
        <div className="flex items-start gap-3">
          <SparkAvatar size={32} />
          <div className="chat-bubble-assistant px-4 py-3 max-w-[80%]">
            <p className="text-[14px] leading-[1.6] text-[#333]">
              早上好 ☀️ 昨天发的内容表现还不错，我整理了一份简报给你看看。
            </p>
          </div>
        </div>

        {/* Data report card */}
        <div className="flex items-start gap-3">
          <SparkAvatar size={32} />
          <div className="flex-1 min-w-0 max-w-[85%]">
            <DataReportCard data={mockReport} />
          </div>
        </div>

        {/* Spark suggestion */}
        <div className="flex items-start gap-3">
          <SparkAvatar size={32} />
          <div className="chat-bubble-assistant px-4 py-3 max-w-[80%]">
            <p className="text-[14px] leading-[1.6] text-[#333]">
              根据最近的数据趋势，我建议今天可以写一篇关于「晨间护肤好物推荐」的内容，趁着上篇笔记的热度做系列。要不要我来？
            </p>
          </div>
        </div>

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2 pl-11">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => onSuggestion(s)}
              className="px-4 py-2 rounded-full border border-spark-orange/40 text-[13px] text-spark-orange hover:bg-spark-orange/5 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';

  // Content card message
  if (!isUser && msg.contentItem) {
    return (
      <div className="flex items-start gap-3">
        <SparkAvatar size={32} />
        <div className="flex-1 min-w-0">
          {msg.content && (
            <div className="chat-bubble-assistant px-4 py-3 mb-2">
              <p className="text-[14px] leading-[1.6] text-[#333] whitespace-pre-wrap">{msg.content}</p>
            </div>
          )}
          <ContentCard item={msg.contentItem} />
        </div>
      </div>
    );
  }

  // Data report message
  if (!isUser && msg.reportData) {
    return (
      <div className="flex items-start gap-3">
        <SparkAvatar size={32} />
        <div className="flex-1 min-w-0 max-w-[85%]">
          {msg.content && (
            <div className="chat-bubble-assistant px-4 py-3 mb-2">
              <p className="text-[14px] leading-[1.6] text-[#333] whitespace-pre-wrap">{msg.content}</p>
            </div>
          )}
          <DataReportCard data={msg.reportData as ReportData} />
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="chat-bubble-user px-4 py-3 max-w-[80%]">
          <p className="text-[14px] leading-[1.6] text-[#333] whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <SparkAvatar size={32} />
      <div className="chat-bubble-assistant px-4 py-3 max-w-[80%]">
        <p className="text-[14px] leading-[1.6] text-[#333] whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  );
}

export default function SparkChat() {
  const {
    messages, addMessage, isGenerating, setIsGenerating,
    setContents, setSelectedContentId,
  } = useAppStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const getBrandContext = useCallback(() => {
    const store = useAppStore.getState();
    if (!store.brand || !store.brand.initialized) return '';
    const b = store.brand;
    return `\n品牌名: ${b.name}\n行业: ${b.industry}\n主营: ${b.mainBusiness}\n目标客户: ${b.targetCustomer}\n语气: ${b.toneOfVoice}\n关键词: ${b.keywords.join(', ')}`;
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isGenerating) return;
    setInput('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setIsGenerating(true);

    // Determine if this should generate an article or just chat
    const isGenerate = /写|生成|创作|种草|文案|文章|笔记|帖子|推文/.test(text);

    if (isGenerate) {
      await handleGenerate(text.trim());
    } else {
      await handleChat(text.trim());
    }
  };

  const handleChat = async (_text: string) => {
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
        const msgs = useAppStore.getState().messages;
        const updated = msgs.map(m =>
          m.id === assistantId ? { ...m, content: assistantContent } : m
        );
        useAppStore.setState({ messages: updated });
      },
      onDone: () => setIsGenerating(false),
      onError: (errMsg) => {
        const msgs = useAppStore.getState().messages;
        const updated = msgs.map(m =>
          m.id === assistantId ? { ...m, content: `⚠️ ${errMsg}` } : m
        );
        useAppStore.setState({ messages: updated });
        setIsGenerating(false);
      },
    });
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

    await streamChat({
      messages: [{ role: 'user', content: `请为"${text}"这个主题生成一篇文章。` }],
      mode: 'generate',
      platform: 'xiaohongshu',
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
          platform: 'xiaohongshu',
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

        // Update message with content card
        const msgs = useAppStore.getState().messages;
        const updated = msgs.map(m =>
          m.id === statusId
            ? { ...m, content: '✅ 已为你创作完成！', contentItem: newItem }
            : m
        );
        useAppStore.setState({ messages: updated });
        setIsGenerating(false);
      },
      onError: (errMsg) => {
        const msgs = useAppStore.getState().messages;
        const updated = msgs.map(m =>
          m.id === statusId ? { ...m, content: `⚠️ 生成失败：${errMsg}` } : m
        );
        useAppStore.setState({ messages: updated });
        setIsGenerating(false);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      {!hasMessages ? (
        <WelcomeState onSuggestion={(text) => sendMessage(text)} />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            {isGenerating && <TypingIndicator />}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-[#EEEDEB] bg-[#FAFAF8]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2 bg-white rounded-[24px] border border-[#E5E4E2] px-4 py-2 shadow-sm">
            <button className="text-[#999] hover:text-[#666] transition-colors pb-1.5">
              <Paperclip size={18} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="告诉火花你想做什么..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none text-[15px] text-[#333] placeholder:text-[#BBB] py-1.5 max-h-32 leading-[1.5]"
              style={{ minHeight: '24px' }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isGenerating}
              className="w-9 h-9 rounded-full bg-spark-orange text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
