import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { streamChat } from '../lib/ai-stream';
import type { ChatMessage, ContentItem } from '../types/spark';
import ContentCard from './ContentCard';

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

function WelcomeState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const suggestions = [
    '帮我写一篇小红书种草文',
    '分析一下最近的爆款选题',
    '优化我上次的文案',
  ];
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <SparkAvatar size={64} />
      <p className="mt-5 text-[16px] text-[#333] text-center leading-relaxed">
        嗨，我是火花 ✨<br />你的内容创作搭子。告诉我你想写什么，我来搞定。
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-6">
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
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';

  // Check if this is a content card message
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
