import { Send, Paperclip } from 'lucide-react';

export function ChatInput({ input, setInput, onSend, isGenerating, inputRef }: {
  input: string;
  setInput: (value: string) => void;
  onSend: (text: string) => void;
  isGenerating: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(input);
    }
  };

  return (
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
            onClick={() => onSend(input)}
            disabled={!input.trim() || isGenerating}
            className="w-9 h-9 rounded-full bg-spark-orange text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
        {/* Prompt templates - hide when input has content to avoid overwriting */}
        <div className={`flex flex-wrap gap-2 mt-2 px-1 transition-opacity ${input.trim() ? 'hidden' : ''}`}>
          {[
            { label: '小红书种草', prompt: '帮我写一篇小红书种草笔记，主题是：' },
            { label: '公众号长文', prompt: '帮我写一篇公众号长文，主题是：' },
            { label: '抖音脚本', prompt: '帮我写一个抖音短视频脚本，主题是：' },
          ].map(t => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                setInput(t.prompt);
                requestAnimationFrame(() => {
                  const ta = inputRef.current;
                  if (ta) {
                    ta.focus();
                    ta.setSelectionRange(t.prompt.length, t.prompt.length);
                    ta.style.height = 'auto';
                    ta.style.height = Math.min(ta.scrollHeight, 128) + 'px';
                  }
                });
              }}
              className="px-3 py-1 rounded-full border border-[#E5E4E2] bg-white text-[12px] text-[#666] hover:border-spark-orange/40 hover:text-spark-orange transition-colors"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
