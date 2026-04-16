/**
 * POST /api/ingest-metrics
 *
 * Accepts real platform metrics from the Spark Desktop client.
 * Authenticated via a `Authorization: Bearer spk_live_<secret>` device token
 * issued in the user's account page. Bypasses RLS via service-role client,
 * so security is enforced entirely at the route level (token hash lookup).
 */
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { hashToken } from '@/lib/device-token';

const PLATFORM = z.enum(['xiaohongshu', 'douyin', 'wechat', 'tiktok', 'instagram']);

const IngestSchema = z.object({
  metrics: z
    .array(
      z.object({
        review_item_id: z.string().min(1).max(128),
        platform: PLATFORM,
        views: z.number().int().min(0).max(1_000_000_000).default(0),
        likes: z.number().int().min(0).max(1_000_000_000).default(0),
        comments: z.number().int().min(0).max(1_000_000_000).default(0),
        saves: z.number().int().min(0).max(1_000_000_000).default(0),
        shares: z.number().int().min(0).max(1_000_000_000).default(0),
        ai_insight: z.string().max(2000).optional(),
        fetched_at: z.string().datetime().optional(),
      }),
    )
    .min(1)
    .max(100),
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
} as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export const Route = createFileRoute('/api/ingest-metrics')({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        // 1. Auth — Bearer device token
        const authHeader = request.headers.get('authorization') || '';
        if (!authHeader.startsWith('Bearer ')) {
          return jsonResponse({ error: 'Missing bearer token' }, 401);
        }
        const token = authHeader.slice(7).trim();
        if (!token.startsWith('spk_live_')) {
          return jsonResponse({ error: 'Invalid token format' }, 401);
        }

        const tokenHash = await hashToken(token);
        const { data: tokenRow, error: tokenErr } = await supabaseAdmin
          .from('device_tokens')
          .select('id, user_id, revoked_at')
          .eq('token_hash', tokenHash)
          .maybeSingle();

        if (tokenErr || !tokenRow) {
          return jsonResponse({ error: 'Invalid token' }, 401);
        }
        if (tokenRow.revoked_at) {
          return jsonResponse({ error: 'Token revoked' }, 401);
        }

        // 2. Validate body
        let parsedBody: z.infer<typeof IngestSchema>;
        try {
          const raw = await request.json();
          parsedBody = IngestSchema.parse(raw);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Invalid body';
          return jsonResponse({ error: `Validation failed: ${msg}` }, 400);
        }

        const userId = tokenRow.user_id;
        const now = new Date().toISOString();

        // 3. Verify ownership: every review_item_id must belong to this user (or be device-shared)
        const ids = Array.from(new Set(parsedBody.metrics.map((m) => m.review_item_id)));
        const { data: items, error: itemsErr } = await supabaseAdmin
          .from('review_items')
          .select('id, user_id')
          .in('id', ids);

        if (itemsErr) {
          return jsonResponse({ error: itemsErr.message }, 500);
        }
        const ownedIds = new Set(
          (items ?? [])
            .filter((it) => !it.user_id || it.user_id === userId)
            .map((it) => it.id),
        );

        const validRows = parsedBody.metrics.filter((m) =>
          ownedIds.has(m.review_item_id),
        );
        const skipped = parsedBody.metrics.length - validRows.length;

        if (validRows.length === 0) {
          return jsonResponse(
            { ok: true, accepted: 0, skipped, message: 'No matching review items' },
            200,
          );
        }

        // 4. Insert metrics rows + per-content aggregate row (platform='all')
        const insertRows = validRows.map((m) => ({
          review_item_id: m.review_item_id,
          user_id: userId,
          platform: m.platform,
          views: m.views,
          likes: m.likes,
          comments: m.comments,
          saves: m.saves,
          shares: m.shares,
          ai_insight: m.ai_insight ?? null,
          source: 'desktop',
          fetched_at: m.fetched_at ?? now,
        }));

        // Aggregate per review_item_id
        const aggregates = new Map<
          string,
          { views: number; likes: number; comments: number; saves: number; shares: number }
        >();
        for (const m of validRows) {
          const cur = aggregates.get(m.review_item_id) || {
            views: 0,
            likes: 0,
            comments: 0,
            saves: 0,
            shares: 0,
          };
          cur.views += m.views;
          cur.likes += m.likes;
          cur.comments += m.comments;
          cur.saves += m.saves;
          cur.shares += m.shares;
          aggregates.set(m.review_item_id, cur);
        }
        for (const [reviewItemId, agg] of aggregates) {
          insertRows.push({
            review_item_id: reviewItemId,
            user_id: userId,
            platform: 'all',
            views: agg.views,
            likes: agg.likes,
            comments: agg.comments,
            saves: agg.saves,
            shares: agg.shares,
            ai_insight: null,
            source: 'desktop',
            fetched_at: now,
          });
        }

        const { error: insertErr } = await supabaseAdmin
          .from('content_metrics')
          .insert(insertRows);
        if (insertErr) {
          return jsonResponse({ error: insertErr.message }, 500);
        }

        // 5. Update review_items.metrics_fetched_at
        await supabaseAdmin
          .from('review_items')
          .update({ metrics_fetched_at: now })
          .in('id', Array.from(aggregates.keys()));

        // 6. Update last_used_at on the token (best-effort)
        await supabaseAdmin
          .from('device_tokens')
          .update({ last_used_at: now })
          .eq('id', tokenRow.id);

        return jsonResponse({
          ok: true,
          accepted: validRows.length,
          aggregates: aggregates.size,
          skipped,
        });
      },
    },
  },
});
