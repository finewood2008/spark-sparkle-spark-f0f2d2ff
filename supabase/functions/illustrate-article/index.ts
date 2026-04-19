import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  getCorsHeaders,
  optionsCors,
  requireUser,
  validatePayloadSize,
  checkRateLimit,
} from "../_shared/auth.ts";

/**
 * illustrate-article
 * --------------------------------
 * 智能全文配图：
 * 1) 用 gemini-2.5-flash 分析正文，挑出 2-4 个最适合插图的段落，
 *    给每张图生成一个独立的视觉 prompt（由 LLM 决定主题/风格连贯性）。
 * 2) 并行调用 gemini-2.5-flash-image 把每张 prompt 转成 base64 图片。
 * 3) 把图片以 markdown 形式插回原文（在指定段落后面），返回新正文。
 */

const TEXT_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash-image";
const TEXT_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${key}`;
const IMG_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${key}`;

interface PlanItem {
  /** 原文中作为锚点的段落片段（前 30 字），用于定位插入位置 */
  anchorSnippet: string;
  /** 该位置的图片 prompt（英文，详细描述画面） */
  imagePrompt: string;
  /** 简短中文 alt 描述，markdown 用 */
  alt: string;
}

const platformVibe: Record<string, string> = {
  xiaohongshu:
    "Xiaohongshu aesthetic: bright airy natural lighting, warm sunny tones, soft pastel palette, lifestyle photography, cozy atmosphere, gentle bokeh, minimalist composition, natural textures",
  wechat:
    "WeChat article style: professional editorial, balanced warm tones, sophisticated modern photography",
  douyin:
    "Douyin/TikTok style: bold vibrant colors, high contrast, dynamic composition, youthful energy",
};

async function planIllustrations(
  title: string,
  content: string,
  platform: string,
  apiKey: string,
): Promise<PlanItem[]> {
  const vibe = platformVibe[platform] || platformVibe.xiaohongshu;
  const systemPrompt = `你是一个新媒体内容编辑，擅长决定一篇文章哪些位置最适合插图。
任务：分析下面的文章，挑出 2-4 个最适合配插图的段落（开头/转折/关键论点/结尾常见），为每张图设计一个详细的英文图片 prompt。
要求：
- 每张图的画面要和该段落内容直接相关，不能是泛泛的概念图。
- 整组图保持统一的视觉风格：${vibe}。
- 每个 anchorSnippet 必须严格摘自原文（前 30 个字符），用于定位插入点。
- 输出严格的 JSON：{"plans":[{"anchorSnippet":"...","imagePrompt":"...","alt":"..."}]}
- 不输出任何解释、代码块标记或 markdown，只输出 JSON 对象本体。
- imagePrompt 末尾必须带：CRITICAL: NO text, NO letters, NO words, NO watermarks, NO logos. Pure visual imagery only.`;

  const userPrompt = `标题：${title}\n\n正文：\n${content}`;

  const resp = await fetch(TEXT_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("[illustrate] plan failed", resp.status, t.substring(0, 300));
    throw new Error(`plan_failed:${resp.status}`);
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let parsed: { plans?: PlanItem[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    // 容错：去掉 ```json 包裹
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(cleaned);
  }
  const plans = (parsed.plans || []).filter(
    (p) => p?.anchorSnippet && p?.imagePrompt && p?.alt,
  );
  if (plans.length === 0) throw new Error("no_plans");
  return plans.slice(0, 4);
}

async function generateOneImage(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const resp = await fetch(IMG_URL(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });
    if (!resp.ok) {
      console.error("[illustrate] img gen failed", resp.status);
      return null;
    }
    const data = await resp.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      if (p.inlineData?.data) {
        const mime = p.inlineData.mimeType || "image/png";
        return `data:${mime};base64,${p.inlineData.data}`;
      }
    }
    return null;
  } catch (e) {
    console.error("[illustrate] img gen exception", e);
    return null;
  }
}

/**
 * 把 imageUrl 按 plan.anchorSnippet 插入到原文段落之后。
 * 找不到锚点时退化：把图追加到文末。
 */
function insertIllustrations(
  content: string,
  illustrations: Array<{ plan: PlanItem; imageUrl: string }>,
): string {
  let result = content;
  for (const { plan, imageUrl } of illustrations) {
    const md = `\n\n![${plan.alt}](${imageUrl})\n\n`;
    const anchor = plan.anchorSnippet.trim().substring(0, 30);
    const idx = result.indexOf(anchor);
    if (idx === -1) {
      // 锚点丢失（被截断/有特殊字符），追加到文末
      result = result + md;
      continue;
    }
    // 找到该段落的结尾（下一个换行或文末）
    const lineEnd = result.indexOf("\n", idx + anchor.length);
    const insertAt = lineEnd === -1 ? result.length : lineEnd;
    result = result.substring(0, insertAt) + md + result.substring(insertAt);
  }
  return result;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return optionsCors(req);

  try {
    await requireUser(req);
    validatePayloadSize(req, 200_000);
    checkRateLimit(req, { maxRequests: 5, windowSec: 60, keyPrefix: "illustrate" });

    const { title, content, platform } = await req.json();
    if (!content || typeof content !== "string" || content.length < 50) {
      return new Response(
        JSON.stringify({ error: "正文太短，无法智能配图（至少 50 字）" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (content.length > 8000) {
      return new Response(
        JSON.stringify({ error: "正文太长（>8000 字），请精简后再试" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    // 1) 规划插图位置 + prompt
    const plans = await planIllustrations(title || "", content, platform || "xiaohongshu", KEY);
    console.log(`[illustrate] planned ${plans.length} illustrations`);

    // 2) 并行生成所有图片
    const results = await Promise.all(
      plans.map(async (p) => ({ plan: p, imageUrl: await generateOneImage(p.imagePrompt, KEY) })),
    );
    const ok = results.filter((r): r is { plan: PlanItem; imageUrl: string } => !!r.imageUrl);
    if (ok.length === 0) {
      return new Response(
        JSON.stringify({ error: "AI 没能生成任何插图，请稍后重试", code: "NO_IMAGES" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) 插回原文
    const newContent = insertIllustrations(content, ok);

    return new Response(
      JSON.stringify({
        content: newContent,
        count: ok.length,
        planned: plans.length,
        illustrations: ok.map(({ plan, imageUrl }) => ({ alt: plan.alt, imageUrl })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[illustrate] error", e);
    if (e instanceof AuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (e instanceof Error && e.message.includes("Rate limit")) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ error: "全文配图失败，请稍后重试", code: "INTERNAL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
