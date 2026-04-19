import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import {
  listConversations,
  createConversation as apiCreate,
  renameConversation as apiRename,
  deleteConversation as apiDelete,
  loadMessages,
  saveMessage,
  touchConversation,
  deriveTitle,
  generateAITitle,
  type ConversationSummary,
} from '@/lib/conversation-persistence';
import type { ChatMessage } from '@/types/spark';

/**
 * Hook orchestrating multi-conversation lifecycle.
 *
 * Responsibilities:
 * - Load the conversation list when auth state becomes ready
 * - Auto-select the most recent conversation (or create one) on first load
 * - Persist new messages from the chat store to Supabase, in order
 * - Update conversation title from the first user message
 */
export function useConversations() {
  const { user, isAuthenticated } = useAuthStore();
  const {
    conversations,
    activeId,
    setConversations,
    setActiveId,
    setLoading,
    upsertConversation,
    removeConversation,
    patchConversation,
  } = useConversationStore();
  const messages = useAppStore((s) => s.messages);
  const setMessagesStore = useAppStore.setState;

  // Track which message ids we've already persisted to avoid double-writes
  const persistedIdsRef = useRef<Set<string>>(new Set());
  // Track whether we've attempted the initial bootstrap for this auth session
  const bootstrappedForUserRef = useRef<string | null>(null);
  // Track conversations we've already AI-titled (or are titling) to avoid duplicates
  const aiTitledRef = useRef<Set<string>>(new Set());

  /** Refresh the conversation list from the server. */
  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    setLoading(true);
    const list = await listConversations();
    setConversations(list);
    setLoading(false);
  }, [isAuthenticated, user?.id, setConversations, setLoading]);

  /** Open an existing conversation: load its messages into the chat store. */
  const openConversation = useCallback(
    async (id: string) => {
      setActiveId(id);
      persistedIdsRef.current = new Set();
      // Existing conversation already has whatever title it has — don't AI-rename it
      aiTitledRef.current.add(id);
      const msgs = await loadMessages(id);
      msgs.forEach((m) => persistedIdsRef.current.add(m.id));
      setMessagesStore({ messages: msgs });
    },
    [setActiveId, setMessagesStore],
  );

  /** Create a new empty conversation and switch to it. */
  const newConversation = useCallback(async (): Promise<ConversationSummary | null> => {
    persistedIdsRef.current = new Set();
    setMessagesStore({ messages: [] });
    if (!isAuthenticated || !user?.id) {
      // Anonymous fallback: just clear messages, no persistence
      setActiveId(null);
      return null;
    }
    const c = await apiCreate('新对话');
    if (c) {
      upsertConversation(c);
      setActiveId(c.id);
    }
    return c;
  }, [isAuthenticated, user?.id, setActiveId, setMessagesStore, upsertConversation]);

  /** Rename a conversation. */
  const renameConversation = useCallback(
    async (id: string, title: string) => {
      patchConversation(id, { title });
      await apiRename(id, title);
    },
    [patchConversation],
  );

  /** Delete a conversation; if it was active, fall back to the next one or create new. */
  const deleteConversation = useCallback(
    async (id: string) => {
      removeConversation(id);
      await apiDelete(id);
      if (activeId === id) {
        const remaining = useConversationStore.getState().conversations;
        if (remaining.length > 0) {
          await openConversation(remaining[0].id);
        } else {
          await newConversation();
        }
      }
    },
    [activeId, removeConversation, openConversation, newConversation],
  );

  // ---------- Bootstrap on auth ----------
  useEffect(() => {
    const authKey = isAuthenticated && user?.id ? user.id : '__anon__';
    if (bootstrappedForUserRef.current === authKey) return;
    bootstrappedForUserRef.current = authKey;

    void (async () => {
      if (!isAuthenticated || !user?.id) {
        // Anonymous: no persistence, single ephemeral session
        setConversations([]);
        setActiveId(null);
        return;
      }
      setLoading(true);
      const list = await listConversations();
      setConversations(list);
      if (list.length > 0) {
        await openConversation(list[0].id);
      } else {
        // Don't auto-create on every fresh login; defer creation until user sends a message.
        setActiveId(null);
        setMessagesStore({ messages: [] });
      }
      setLoading(false);
    })();
  }, [
    isAuthenticated,
    user?.id,
    openConversation,
    setActiveId,
    setConversations,
    setLoading,
    setMessagesStore,
  ]);

  // ---------- Persist new messages ----------
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (messages.length === 0) return;

    void (async () => {
      let convId = activeId;
      // Lazily create a conversation when the user sends the first message
      if (!convId) {
        const firstUser = messages.find((m) => m.role === 'user');
        const title = firstUser ? deriveTitle(firstUser.content) : '新对话';
        const c = await apiCreate(title);
        if (!c) return;
        convId = c.id;
        upsertConversation(c);
        setActiveId(convId);
      }

      // Persist any messages we haven't seen yet
      const fresh: ChatMessage[] = [];
      for (const m of messages) {
        if (!persistedIdsRef.current.has(m.id)) {
          fresh.push(m);
          persistedIdsRef.current.add(m.id);
        }
      }
      if (fresh.length === 0) return;

      // Save sequentially to preserve order
      for (const m of fresh) {
        await saveMessage(convId, m);
      }

      // Update conversation: bump last_message_at, set title from first user msg
      const firstUserMsg = messages.find((m) => m.role === 'user');
      const summary = useConversationStore
        .getState()
        .conversations.find((c) => c.id === convId);
      const shouldRetitle =
        firstUserMsg && (!summary?.title || summary.title === '新对话');
      if (shouldRetitle && firstUserMsg) {
        const title = deriveTitle(firstUserMsg.content);
        patchConversation(convId, {
          title,
          lastMessageAt: new Date().toISOString(),
        });
        await apiRename(convId, title);
      } else {
        patchConversation(convId, { lastMessageAt: new Date().toISOString() });
      }
      await touchConversation(convId);

      // ----- AI-refined title (once per conversation, after first AI reply) -----
      const firstAssistantMsg = messages.find(
        (m) => m.role === 'assistant' && (m.content || '').trim().length > 0,
      );
      if (
        firstUserMsg &&
        firstAssistantMsg &&
        !aiTitledRef.current.has(convId)
      ) {
        aiTitledRef.current.add(convId);
        void (async () => {
          const aiTitle = await generateAITitle(
            firstUserMsg.content,
            firstAssistantMsg.content,
          );
          if (!aiTitle) return;
          patchConversation(convId!, { title: aiTitle });
          await apiRename(convId!, aiTitle);
        })();
      }
    })();
  }, [
    messages,
    activeId,
    isAuthenticated,
    user?.id,
    setActiveId,
    upsertConversation,
    patchConversation,
  ]);

  return {
    conversations,
    activeId,
    refresh,
    openConversation,
    newConversation,
    renameConversation,
    deleteConversation,
  };
}
