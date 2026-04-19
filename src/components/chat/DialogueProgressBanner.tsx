import { Sparkles } from 'lucide-react';

/**
 * Slim sticky banner shown at the top of the chat while a multi-turn
 * pre-creation dialogue is in flight. Communicates that we're still in the
 * alignment phase, not yet writing — prevents the "is it stuck or thinking?"
 * confusion when spark sends multiple clarifying replies.
 */
export function DialogueProgressBanner({ turn }: { turn: number }) {
  // Show "第 N 轮" where N is human-friendly (1-based, min 1)
  const displayTurn = Math.max(1, turn);
  return (
    <div className="sticky top-0 z-10 border-b border-primary/20 bg-primary/5 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-4 py-1.5 flex items-center gap-2 text-xs">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="font-medium text-primary">创作准备中</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">第 {displayTurn} 轮对齐</span>
        <span className="ml-auto text-muted-foreground/70 hidden sm:inline">
          点击建议卡片或输入想法，火花会继续追问
        </span>
      </div>
    </div>
  );
}
