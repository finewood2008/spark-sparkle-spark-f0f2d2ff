// Supabase Edge Function: fetch-metrics
// Triggered by pg_cron hourly. Scans review_items where:
//   - status = 'published'
//   - published_at is not null
//   - (metrics_fetched_at is null OR last fetch was > 6h ago)
//   - 24 hours have passed since published_at (first fetch only)
// Calls platform APIs (currently mocked) and writes to content_metrics.
// Also inserts a "synthetic chat message" record so the UI can pick it up
// on next page load via the existing review-persistence loader pattern.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  AuthError,
  getCorsHeaders,
  optionsCors,
  requireCronAuth,
} from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY=Deno.e...Y");

interface PlatformMetrics {
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
}

/**
 * TODO: Replace with real platform API calls.
 * Each platform requires its own OAuth + business account credentials:
 *   - 小红书 (Xiaohongshu): https://open.xiaohongshu.com/
 *   - 微信公众号 (WeChat MP): https://mp.weixin.qq.com/
 *   - 抖音 (Douyin): https://developer.open-douyin.com/
 * For now we generate plausible mock data.
 */
async function fetchPlatformMetrics(
  platform: string,
  _contentId: string,
): Promise<PlatformMetrics> {
  // === REAL API INTEGRATION GOES HERE ===
  // const token = Deno.env.get(`${platform.toUpperCase()}_ACCESS_TOKEN`);
  // const res = await fetch(`https://api.${platform}.com/v1/metrics/${_contentId}`, {
  //   headers: { Authorization: `Bearer ${token}` },
  // });
  // const data = await res.json();
  // return { views: data.views, likes: data.likes, ... };

  // === MOCK FALLBACK (used until APIs are wired up) ===
  const baseViews = Math.floor(Math.random() * 4500) + 500;
  const likeRate = 0.05 + Math.random() * 0.1; // 5%–15%
  const commentRate = 0.005 + Math.random() * 0.02; // 0.5%–2.5%
  const saveRate = 0.01 + Math.random() * 0.04;
  const shareRate = 0.005 + Math.random() * 0.015;
  return {
    views: baseViews,
    likes: Math.floor(baseViews * likeRate),
    comments: Math.floor(baseViews * commentRate),
    saves: Math.floor(baseViews * saveRate),
    shares: Math.floor(baseViews * shareRate),
  };
}

/** Generate a one-line AI insight for the metrics. Falls back to template if no API key. */
async function generateInsight(
  title: string,
  platform: string,
  metrics: PlatformMetrics,
): Promise<string> {
  const engagementRate =
    metrics.views > 0
      ? ((metrics.likes + metrics.comments + metrics.saves) / metrics.views) * 100
      : 0;

  if (!LOVABLE_API_KEY) {
    return `本篇互动率 ${engagementRate.toFixed(1)}%，${
      engagementRate > 8 ? "表现不错，建议复用同主题" : "可以尝试调整标题或封面"
    }。`;
  }

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "你是一位社交媒体运营顾问，根据数据用一句话(50字内)给出洞察和建议。直接给结论，不要寒暄。",
          },
          {
            role: "user",
            content: `内容标题：${title}\n平台：${platform}\n浏览：${metrics.views}\n点赞：${metrics.likes}\n评论：${metrics.comments}\n收藏：${metrics.saves}\n互动率：${engagementRate.toFixed(2)}%`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim() || `互动率 ${engagementRate.toFixed(1)}%`;
  } catch (err) {
    console.error("[insight] failed:", err);
    return `本篇互动率 ${engagementRate.toFixed(1)}%。`;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return optionsCors(req);
  }

  try {
    requireCronAuth(req);
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    let force = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        force = !!body.force;
      } catch {
        // no body, ignore
      }
    }

    // Find published items where 24h has elapsed and we haven't fetched metrics yet
    // (or last fetch was more than 6h ago, for periodic refresh).
    // If force=true, bypass the 24h cutoff (for manual testing).
    const cutoff24h = force
      ? new Date().toISOString() // any published item qualifies
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const cutoff6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    let q = supabase
      .from("review_items")
      .select("id, title, platform, published_platforms, published_at, metrics_fetched_at, user_id, device_id")
      .eq("status", "published")
      .not("published_at", "is", null)
      .lte("published_at", cutoff24h);

    if (!force) {
      q = q.or(`metrics_fetched_at.is.null,metrics_fetched_at.lte.${cutoff6h}`);
    }

    const { data: items, error: queryErr } = await q.limit(50);

    if (queryErr) throw queryErr;

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: "No items due for metrics fetch" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processedCount = 0;

    for (const item of items) {
      const platforms: string[] =
        item.published_platforms?.length > 0
          ? item.published_platforms
          : [item.platform];

      let aggregated: PlatformMetrics = { views: 0, likes: 0, comments: 0, saves: 0, shares: 0 };

      for (const platform of platforms) {
        const metrics = await fetchPlatformMetrics(platform, item.id);
        aggregated = {
          views: aggregated.views + metrics.views,
          likes: aggregated.likes + metrics.likes,
          comments: aggregated.comments + metrics.comments,
          saves: aggregated.saves + metrics.saves,
          shares: aggregated.shares + metrics.shares,
        };

        const insight = await generateInsight(item.title, platform, metrics);

        await supabase.from("content_metrics").insert({
          review_item_id: item.id,
          user_id: item.user_id,
          device_id: item.device_id,
          platform,
          views: metrics.views,
          likes: metrics.likes,
          comments: metrics.comments,
          saves: metrics.saves,
          shares: metrics.shares,
          source: "mock", // change to "real" when actual APIs wired up
          ai_insight: insight,
        });
      }

      // Also write an aggregated summary row (platform = 'all') with overall AI insight
      const overallInsight = await generateInsight(item.title, "全平台", aggregated);
      await supabase.from("content_metrics").insert({
        review_item_id: item.id,
        user_id: item.user_id,
        device_id: item.device_id,
        platform: "all",
        views: aggregated.views,
        likes: aggregated.likes,
        comments: aggregated.comments,
        saves: aggregated.saves,
        shares: aggregated.shares,
        source: "mock",
        ai_insight: overallInsight,
      });

      // Mark this item as fetched so we don't re-process immediately
      await supabase
        .from("review_items")
        .update({ metrics_fetched_at: new Date().toISOString() })
        .eq("id", item.id);

      processedCount++;
    }

    return new Response(
      JSON.stringify({ ok: true, processed: processedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fetch-metrics] failed:", msg);
    return new Response(JSON.stringify({ ok: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
