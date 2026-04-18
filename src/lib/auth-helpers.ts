/**
 * Shared auth helpers for the Spark frontend.
 *
 * Centralizes session-token retrieval so callers don't need to
 * manually call supabase.auth.getSession() everywhere.
 */
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_PUBLISHABLE_KEY } from './env';

/**
 * Return the current user's access_token when logged in,
 * falling back to the anonymous publishable key for unauthenticated flows.
 */
export async function getAuthToken(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
  } catch { /* fall through */ }
  return SUPABASE_PUBLISHABLE_KEY;
}

/**
 * Return the current session, or null if not logged in.
 * Use this when you need more than just the token (e.g. user id).
 */
export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Require an active session or redirect to /auth.
 * Used in route beforeLoad guards.
 */
export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    // Dynamic import to avoid circular deps with router
    const { redirect } = await import('@tanstack/react-router');
    throw redirect({ to: '/auth' });
  }
  return session;
}
