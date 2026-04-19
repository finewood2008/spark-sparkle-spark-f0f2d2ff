import { create } from 'zustand';
import type { ConversationSummary } from '@/lib/conversation-persistence';

interface ConversationState {
  conversations: ConversationSummary[];
  activeId: string | null;
  loading: boolean;

  setConversations: (list: ConversationSummary[]) => void;
  setActiveId: (id: string | null) => void;
  setLoading: (v: boolean) => void;
  upsertConversation: (c: ConversationSummary) => void;
  removeConversation: (id: string) => void;
  patchConversation: (id: string, patch: Partial<ConversationSummary>) => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  activeId: null,
  loading: false,

  setConversations: (list) => set({ conversations: list }),
  setActiveId: (id) => set({ activeId: id }),
  setLoading: (v) => set({ loading: v }),
  upsertConversation: (c) =>
    set((s) => {
      const idx = s.conversations.findIndex((x) => x.id === c.id);
      if (idx === -1) return { conversations: [c, ...s.conversations] };
      const next = [...s.conversations];
      next[idx] = c;
      return { conversations: next };
    }),
  removeConversation: (id) =>
    set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) })),
  patchConversation: (id, patch) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    })),
}));
