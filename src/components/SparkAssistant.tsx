import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, User, Bot, Flame } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { ChatMessage } from '../types/spark';

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`} style={{ animation: 'spark-fade-in 0.3s ease' }}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-spark-gray-200' : 'spark-gradient'}`}>
        {isUser ? <User size={14} className="text-spark-gray-600" /> : <Bot size={14} className="text-primary-foreground" />}
      </div>
      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        id: 'welcome',
        role: 'assistant',
        content: '嗨，我是火花 🔥 有什么想做的，直接说。',
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

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isGenerating) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput('');
    setIsGenerating(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        '好的，我来帮你生成一篇内容草稿 ✨',
        '收到！让我想想怎么写更吸引人...',
        '这个方向不错，我来优化一下文案 🔥',
        '已经为你准备好了，看看满不满意？',
        '建议可以加一些互动话题，提升评论率 📈',
      ];
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date().toISOString(),
      };
      addMessage(botMsg);
      setIsGenerating(false);
    }, 1000 + Math.random() * 1500);
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
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-primary-foreground/20 rounded-lg transition-colors">
              <X size={16} className="text-primary-foreground" />
            </button>
          </div>

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
