import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AuthError,
  getCorsHeaders,
  optionsCors,
  requireUser,
  validatePayloadSize,
  checkRateLimit,
} from "../_shared/auth.ts";

const STORAGE_BUCKET = "article-images";

/**
 * 把 base64 图片上传到 Storage，返回公开 URL。
 * 路径：{userId}/{ts}-{rand}.{ext}，符合 RLS（用户子目录）。
 * 失败时回退返回原 data URL（不阻塞流程）。
 */
async function uploadBase64ToStorage(
  dataUrl: string,
  userId: string,
): Promise<string> {
  try {
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return dataUrl;
    const mime = m[1];
    const b64 = m[2];
    const ext = mime.split("/")[1]?.split("+")[0] || "png";

    // base64 -> Uint8Array
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error("[illustrate] missing SUPABASE_URL / SERVICE_ROLE_KEY");
      return dataUrl;
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) {
      console.error("[illustrate] storage upload failed", error.message);
      return dataUrl;
    }
    const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl || dataUrl;
  } catch (e) {
    console.error("[illustrate] upload exception", e);
    return dataUrl;
  }
}

/**
 * illustrate-article (SSE 流式版)
 * --------------------------------
 * 1) 用 gemini-2.5-flash 规划 2-4 个插图位置，立即推 `event: plan` 给前端，
 *    前端先在每个锚点处插入 `🎨 正在配第 N/总 张...` 占位。
 * 2) 并行生成图片，每张图完成立即推 `event: image`，前端把对应占位换成图。
 * 3) 全部完成后推 `event: done`。
 */

const TEXT_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash-image";
const TEXT_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${key}`;
const IMG_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${key}`;

interface PlanItem {
  anchorSnippet: string;
  imagePrompt: string;
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return optionsCors(req);

  try {
    const userId = await requireUser(req);
    validatePayloadSize(req, 200_000);
    checkRateLimit(req, { maxRequests: 5, windowSec: 60, keyPrefix: "illustrate" });

    const body = await req.json();
    const { title, content, platform, mode, imagePrompt, alt, platformVibeKey } = body as {
      title?: string;
      content?: string;
      platform?: string;
      mode?: "single" | "full";
      imagePrompt?: string;
      alt?: string;
      platformVibeKey?: string;
    };

    const KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    // ---- Single-image regeneration mode ----
    if (mode === "single") {
      if (!imagePrompt || typeof imagePrompt !== "string") {
        return new Response(
          JSON.stringify({ error: "缺少 imagePrompt" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const vibe =
        platformVibe[platformVibeKey || platform || "xiaohongshu"] || platformVibe.xiaohongshu;
      const prompt = imagePrompt.includes("CRITICAL: NO text")
        ? imagePrompt
        : `${imagePrompt}. Style: ${vibe}. CRITICAL: NO text, NO letters, NO words, NO watermarks, NO logos. Pure visual imagery only.`;
      const dataUrl = await generateOneImage(prompt, KEY);
      if (!dataUrl) {
        return new Response(
          JSON.stringify({ error: "图片生成失败，请重试" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // 上传到 Storage 拿公开 URL（避免把 base64 塞进正文）
      const imageUrl = await uploadBase64ToStorage(dataUrl, userId);
      return new Response(
        JSON.stringify({ imageUrl, alt: alt || "", imagePrompt: prompt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Full-article mode (default, SSE streaming) ----
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };
        try {
          // 1) 规划阶段
          const plans = await planIllustrations(
            title || "",
            content,
            platform || "xiaohongshu",
            KEY,
          );
          console.log(`[illustrate] planned ${plans.length} illustrations (streaming)`);
          send("plan", {
            total: plans.length,
            items: plans.map((p, i) => ({
              index: i,
              anchorSnippet: p.anchorSnippet,
              alt: p.alt,
            })),
          });

          // 2) 并行生成图片，每张完成立即推送
          let okCount = 0;
          await Promise.all(
            plans.map(async (p, i) => {
              const imageUrl = await generateOneImage(p.imagePrompt, KEY);
              if (imageUrl) {
                okCount += 1;
                // imagePrompt 一并推给前端，用于"重新生成单张"
                send("image", { index: i, alt: p.alt, imageUrl, imagePrompt: p.imagePrompt });
              } else {
                send("image_failed", { index: i, alt: p.alt, imagePrompt: p.imagePrompt });
              }
            }),
          );

          // 3) 完成
          send("done", { total: plans.length, succeeded: okCount });
          controller.close();
        } catch (e) {
          console.error("[illustrate] stream error", e);
          send("error", {
            message: e instanceof Error ? e.message : "全文配图失败",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
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
