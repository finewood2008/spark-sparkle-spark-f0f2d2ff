import { useEffect, useState } from 'react';
import { ClipboardCheck, ExternalLink } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import ReviewCenter from './ReviewCenter';

interface ReviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReviewDrawer({ open, onOpenChange }: ReviewDrawerProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  // Refetch list every time the drawer opens
  useEffect(() => {
    if (open) setRefreshKey(k => k + 1);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl bg-background border-l border-border p-0 flex flex-col"
      >
        <SheetHeader className="px-5 py-4 border-b border-border flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <ClipboardCheck size={18} className="text-primary" />
            审核中心
          </SheetTitle>
          <a
            href="/review"
            className="mr-8 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            title="在独立页面打开"
          >
            完整页面
            <ExternalLink size={12} />
          </a>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-hidden p-3">
          <ReviewCenter layout="drawer" refreshKey={refreshKey} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
