import { createFileRoute, redirect } from '@tanstack/react-router';
import ReviewPage from '@/pages/ReviewPage';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/review')({
  head: () => ({
    meta: [
      { title: '审核中心 — 火花' },
      { name: 'description', content: '管理和审核所有待发布内容' },
    ],
  }),
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: '/auth' });
    }
  },
  component: ReviewPage,
});
