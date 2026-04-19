import { AlertCircle, RotateCcw } from 'lucide-react';
import { SparkAvatar } from './ChatAtoms';
import ContentCard from '../ContentCard';
import DataReportCard, { type ReportData } from '../DataReportCard';
import ReviewReminderCard from '../ReviewReminderCard';
import DistributionCard from '../DistributionCard';
import ScheduleCard from '../ScheduleCard';
import MetricsCard from '../MetricsCard';
import type { ChatMessage, ContentItem } from '../../types/spark';

export function MessageBubble({ msg, onSend, onCardAction, onRetry }: {
  msg: ChatMessage;
  onSend: (text: string) => void;
  onCardAction: (action: string, item?: ContentItem) => void;
  onRetry: (msg: ChatMessage) => void;
}) {
  const isUser = msg.role === 'user';

  // Error bubble — friendly message + retry button
  if (!isUser && msg.error) {
    return (
      <div className="flex items-start gap-3">
        <SparkAvatar size={32} />
        <div className="flex-1 min-w-0 max-w-[85%]">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] leading-[1.6] text-[#333]">
                  {msg.content || '生成失败了，要不再试一次？'}
                </p>
                <p className="text-[12px] leading-[1.5] text-[#888] mt-1 break-words">
                  {msg.error.message}
                </p>
                {msg.error.retryPrompt && (
                  <button
                    onClick={() => onRetry(msg)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-spark-orange text-white text-[13px] hover:opacity-90 transition-opacity"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    重试
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Metrics card — 24h post-publish data report
  if (!isUser && msg.metricsCard) {
    return (
      <div className="flex items-start gap-3">
        <SparkAvatar size={32} />
        <div className="flex-1 min-w-0 max-w-[85%]">
          {msg.content && (
            <div className="chat-bubble-assistant px-4 py-3 mb-2">
              <p className="text-[14px] leading-[1.6] text-[#333] whitespace-pre-wrap">{msg.content}</p>
            </div>
          )}
          <MetricsCard data={msg.metricsCard} />
        </div>
      </div>
    );
  }

  // Distribution card — content approved, choose platforms to publish
  if (!isUser && msg.distribution) {
    return (
      <div className="flex items-start gap-3">
        <SparkAvatar size={32} />
        <div className="flex-1 min-w-0 max-w-[85%]">
          {msg.content && (
            <div className="chat-bubble-assistant px-4 py-3 mb-2">
              <p className="text-[14px] leading-[1.6] text-[#333] whitespace-pre-wrap">{msg.content}</p>
            </div>
          )}
          <DistributionCard data={msg.distribution} />
        </div>
      </div>
    );
  }

  // Schedule card — natural-language triggered task creation
  if (!isUser && msg.scheduleCard) {
    return (
      <div className="flex items-start gap-3">
        <SparkAvatar size={32} />
        <div className="flex-1 min-w-0 max-w-[85%]">
          {msg.content && (
            <div className="chat-bubble-assistant px-4 py-3 mb-2">
              <p className="text-[14px] leading-[1.6] text-[#333] whitespace-pre-wrap">{msg.content}</p>
            </div>
          )}
          <ScheduleCard data={msg.scheduleCard} />
        </div>
      </div>
    );
  }

  // Review reminder card — simplified pointer to /review (replaces ReviewCard in chat)
  if (!isUser && msg.reviewReminder) {
    return (
      <div className="flex items-start gap-3">
        <SparkAvatar size={32} />
        <div className="flex-1 min-w-0 max-w-[85%]">
          {msg.content && (
            <div className="chat-bubble-assistant px-4 py-3 mb-2">
              <p className="text-[14px] leading-[1.6] text-[#333] whitespace-pre-wrap">{msg.content}</p>
            </div>
          )}
          <ReviewReminderCard
            item={msg.reviewReminder.item}
            taskName={msg.reviewReminder.taskName}
            message={msg.reviewReminder.message}
          />
        </div>
      </div>
    );
  }

  // Legacy: scheduled-task reviewing items routed via contentItem+reviewTask → render as reminder too
  if (!isUser && msg.contentItem && (msg.reviewTask || msg.contentItem.status === 'reviewing')) {
    return (
      <div className="flex items-start gap-3">
        <SparkAvatar size={32} />
        <div className="flex-1 min-w-0 max-w-[85%]">
          {msg.content && (
            <div className="chat-bubble-assistant px-4 py-3 mb-2">
              <p className="text-[14px] leading-[1.6] text-[#333] whitespace-pre-wrap">{msg.content}</p>
            </div>
          )}
          <ReviewReminderCard item={msg.contentItem} taskName={msg.reviewTask?.taskName} />
        </div>
      </div>
    );
  }

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
          <ContentCard item={msg.contentItem} onAction={(action, item) => onCardAction(action, item)} />
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
          <DataReportCard
            data={msg.reportData as unknown as ReportData}
            onAction={(action) => onCardAction(action)}
          />
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
      <div className="flex-1 min-w-0 max-w-[80%]">
        <div className="chat-bubble-assistant px-4 py-3">
          <p className="text-[14px] leading-[1.6] text-[#333] whitespace-pre-wrap">{msg.content}</p>
        </div>

        {/* Choices: card variant for clarify questions, pill fallback otherwise */}
        {msg.choices && msg.choices.length > 0 && (
          (() => {
            const isCardMode = msg.choices.some(c => c.variant === 'card');
            if (isCardMode) {
              return (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {msg.choices.map((c, idx) => (
                    <button
                      key={c.id}
                      onClick={() => onSend(c.anglePrompt || c.label)}
                      className="group relative text-left rounded-2xl border border-[#EAE7E0] bg-white hover:border-spark-orange hover:shadow-[0_4px_20px_-8px_rgba(255,140,66,0.4)] transition-all px-4 py-3.5 flex gap-3 items-start"
                    >
                      <div className="shrink-0 w-9 h-9 rounded-xl bg-spark-orange/8 group-hover:bg-spark-orange/15 transition-colors flex items-center justify-center text-[18px] leading-none">
                        {c.emoji || ['🎯', '🌱', '💎'][idx % 3]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-[#2A2A28] leading-tight">
                          {c.label}
                        </div>
                        {c.description && (
                          <div className="mt-1 text-[12px] text-[#8a8a86] leading-[1.5] line-clamp-2">
                            {c.description}
                          </div>
                        )}
                      </div>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-spark-orange opacity-0 group-hover:opacity-100 transition-opacity text-[14px]">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              );
            }
            return (
              <div className="flex flex-wrap gap-2 mt-2">
                {msg.choices.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onSend(c.label)}
                    className="px-4 py-1.5 rounded-full border border-spark-orange/40 text-[13px] text-spark-orange hover:bg-spark-orange/5 transition-colors"
                  >
                    {c.emoji && <span className="mr-1">{c.emoji}</span>}
                    {c.label}
                  </button>
                ))}
              </div>
            );
          })()
        )}

        {/* Quick action buttons */}
        {msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {msg.actions.map(a => (
              <button
                key={a.value}
                onClick={() => onSend(a.value)}
                className={`px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                  a.variant === 'primary'
                    ? 'bg-spark-orange text-white hover:opacity-90'
                    : 'bg-[#F5F5F3] text-[#666] hover:bg-[#EEEDEB]'
                }`}
              >
                {a.icon && <span className="mr-1">{a.icon}</span>}
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
