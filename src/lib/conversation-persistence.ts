// Persistence helpers for multi-conversation support.
// Conversations + chat_messages live in Supabase with RLS scoped to auth.uid().
// For unauthenticated users this layer becomes a no-op and the app falls back
// to in-memory conversations only (consistent with the rest of the app).

import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';
import type { ChatMessage } from '@/types/spark';

export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  lastMessageAt: string;
  createdAt: string;
}

function getUserId(): string | null {
  const { user, isAuthenticated } = useAuthStore.getState();
  return isAuthenticated && user?.id ? user.id : null;
}

function rowToSummary(row: Record<string, unknown>): ConversationSummary {
  return {
    id: row.id as string,
    title: (row.title as string) || '新对话',
    pinned: !!row.pinned,
    lastMessageAt: (row.last_message_at as string) || (row.created_at as string),
    createdAt: row.created_at as string,
  };
}

// ---------------- Conversations ----------------

export async function listConversations(): Promise<ConversationSummary[]> {
  const userId = getUserId();
  if (!userId) return [];
  const { data, error } = await (supabase as ReturnType<typeof Object>)
    .from('conversations')
    .select('id, title, pinned, last_message_at, created_at')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('last_message_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('[conversations] list failed', error);
    return [];
  }
  return ((data || []) as Record<string, unknown>[]).map(rowToSummary);
}

export async function createConversation(title = '新对话'): Promise<ConversationSummary | null> {
  const userId = getUserId();
  if (!userId) return null;
  const { data, error } = await (supabase as ReturnType<typeof Object>)
    .from('conversations')
    .insert({ user_id: userId, title })
    .select('id, title, pinned, last_message_at, created_at')
    .single();
  if (error || !data) {
    console.error('[conversations] create failed', error);
    return null;
  }
  return rowToSummary(data as Record<string, unknown>);
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  const { error } = await (supabase as ReturnType<typeof Object>)
    .from('conversations')
    .update({ title })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) console.error('[conversations] rename failed', error);
}

export async function deleteConversation(id: string): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  const { error } = await (supabase as ReturnType<typeof Object>)
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) console.error('[conversations] delete failed', error);
}

export async function touchConversation(id: string): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  await (supabase as ReturnType<typeof Object>)
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
}

export async function setConversationPinned(
  id: string,
  pinned: boolean,
): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  const { error } = await (supabase as ReturnType<typeof Object>)
    .from('conversations')
    .update({ pinned })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) console.error('[conversations] pin failed', error);
}

// ---------------- Messages ----------------

export async function loadMessages(conversationId: string): Promise<ChatMessage[]> {
  const userId = getUserId();
  if (!userId) return [];
  const { data, error } = await (supabase as ReturnType<typeof Object>)
    .from('chat_messages')
    .select('id, payload, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) {
    console.error('[messages] load failed', error);
    return [];
  }
  return ((data || []) as Record<string, unknown>[])
    .map((row) => row.payload as ChatMessage)
    .filter((m): m is ChatMessage => !!m && typeof m === 'object' && !!m.id);
}

export async function saveMessage(
  conversationId: string,
  msg: ChatMessage,
): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  const { error } = await (supabase as ReturnType<typeof Object>)
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role: msg.role,
      content: msg.content || '',
      payload: msg,
    });
  if (error) console.error('[messages] save failed', error);
}

/** Best-effort title from the first user message. */
export function deriveTitle(text: string): string {
  const clean = (text || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '新对话';
  return clean.length > 24 ? clean.slice(0, 24) + '…' : clean;
}

/**
 * Ask the AI to generate a concise title for a conversation, based on
 * the first user message and (optionally) the assistant's reply.
 * Returns null on any failure — caller should keep the existing title.
 */
export async function generateAITitle(
  userMessage: string,
  assistantMessage?: string,
): Promise<string | null> {
  const userId = getUserId();
  if (!userId) return null;
  try {
    const { data, error } = await supabase.functions.invoke('title-conversation', {
      body: { userMessage, assistantMessage },
    });
    if (error) {
      console.warn('[conversations] AI title failed', error);
      return null;
    }
    const title = (data as { title?: string } | null)?.title?.trim();
    return title && title.length > 0 ? title : null;
  } catch (e) {
    console.warn('[conversations] AI title threw', e);
    return null;
  }
}
