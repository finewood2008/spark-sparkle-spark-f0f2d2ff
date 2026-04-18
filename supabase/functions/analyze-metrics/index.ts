// Supabase Edge Function: analyze-metrics
// Pulls content_metrics history for a given review_item_id over the last 7 days,
// computes growth % vs the earliest sample in the window, and asks Lovable AI
// to produce a brief one-line insight + recommendation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  AuthError,
  getCorsHeaders,
  optionsCors,
  requireCronAuth,
} from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface MetricRow {
  fetched_at: string;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
}

function pct(curr: number, prev: number): number {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10; // 1 decimal
}

async function generateInsight(
  title: string,
  latest: MetricRow,
  earliest: MetricRow,
  growth: { views: number; likes: number; comments: number; saves: number },
  sampleCount: number,
): Promise<string> {
  const engagementRate =
    latest.views > 0
      ? ((latest.likes + latest.comments + latest.saves) / latest.views) * 100
      : 0;

  const fallback = `近 7 天浏览增长 ${growth.views}%，互动率 ${engagementRate.toFixed(1)}%。`;

  if (!LOVABLE_API_KEY) return fallback;

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
              "你是社交媒体运营顾问。基于 7 天数据增长情况，用一句话(60字内)给出洞察+下一步建议。直接给结论，不寒暄，不复述数字。",
          },
          {
            role: "user",
            content: `内容标题：${title}
样本数：${sampleCount}
最新浏览：${latest.views}（增长 ${growth.views}%）
最新点赞：${latest.likes}（增长 ${growth.likes}%）
最新评论：${latest.comments}（增长 ${growth.comments}%）
最新收藏：${latest.saves}（增长 ${growth.saves}%）
互动率：${engagementRate.toFixed(2)}%`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim() || fallback;
  } catch (err) {
    console.error("[analyze-metrics] AI failed:", err);
    return fallback;
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
    const { contentId, title } = await req.json();
    if (!contentId) {
      return new Response(JSON.stringify({ ok: false, error: "contentId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from("content_metrics")
      .select("fetched_at, views, likes, comments, saves, shares")
      .eq("review_item_id", contentId)
      .eq("platform", "all")
      .gte("fetched_at", sevenDaysAgo)
      .order("fetched_at", { ascending: true });

    if (error) throw error;

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, hasData: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const earliest = rows[0] as MetricRow;
    const latest = rows[rows.length - 1] as MetricRow;

    const growth = {
      views: pct(latest.views, earliest.views),
      likes: pct(latest.likes, earliest.likes),
      comments: pct(latest.comments, earliest.comments),
      saves: pct(latest.saves, earliest.saves),
    };

    const insight = await generateInsight(
      title || "该内容",
      latest,
      earliest,
      growth,
      rows.length,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        hasData: true,
        sampleCount: rows.length,
        windowStart: earliest.fetched_at,
        windowEnd: latest.fetched_at,
        latest,
        growth,
        insight,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analyze-metrics] failed:", msg);
    return new Response(JSON.stringify({ ok: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
