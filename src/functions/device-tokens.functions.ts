import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { generateDeviceToken, hashToken, tokenPrefix } from '@/lib/device-token';
import { z } from 'zod';

/**
 * Issue a new desktop ingest token for the current user.
 * Returns the FULL token only once — caller must show it to the user immediately.
 */
export const createDeviceToken = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().min(1).max(64).default('桌面客户端'),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const token = generateDeviceToken();
    const prefix = tokenPrefix(token);
    const hash = await hashToken(token);

    const { error } = await supabaseAdmin.from('device_tokens').insert({
      user_id: userId,
      token_hash: hash,
      token_prefix: prefix,
      label: data.label,
    });

    if (error) {
      throw new Error(`Failed to create device token: ${error.message}`);
    }

    return { token, prefix, label: data.label };
  });

/**
 * List the current user's device tokens (without secrets).
 */
export const listDeviceTokens = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from('device_tokens')
      .select('id, label, token_prefix, last_used_at, created_at, revoked_at')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return { tokens: data ?? [] };
  });

/**
 * Revoke (soft-delete) one of the user's tokens.
 */
export const revokeDeviceToken = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from('device_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
