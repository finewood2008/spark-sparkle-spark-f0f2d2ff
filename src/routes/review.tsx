import { createFileRoute } from '@tanstack/react-router';
import ReviewPage from '@/pages/ReviewPage';
import { requireSession } from '@/lib/auth-helpers';

export const Route = createFileRoute('/review')({
  head: () => ({
    meta: [
      { title: '审核中心 — 火花' },
      { name: 'description', content: '管理和审核所有待发布内容' },
    ],
  }),
  ssr: false,
  beforeLoad: () => requireSession(),
  component: ReviewPage,
});
