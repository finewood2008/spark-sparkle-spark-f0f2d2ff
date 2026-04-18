export function SparkAvatar({ size = 32 }: { size?: number }) {
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

export function TypingIndicator() {
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
