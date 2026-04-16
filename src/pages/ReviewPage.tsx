import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import ReviewCenter from '@/components/ReviewCenter';

export default function ReviewPage() {
  return (
    <div
      className="min-h-screen bg-background"
      style={{
        background:
          'linear-gradient(180deg, oklch(0.95 0.04 70 / 20%), oklch(0.985 0.002 90))',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-5">
          <Link
            to="/"
            className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold text-foreground">审核中心</h1>
        </div>
        <ReviewCenter layout="page" />
      </div>
    </div>
  );
}
