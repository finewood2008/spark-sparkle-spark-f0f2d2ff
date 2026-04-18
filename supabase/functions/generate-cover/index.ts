import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  getCorsHeaders,
  optionsCors,
  requireUser,
  validatePayloadSize,
  checkRateLimit,
} from "../_shared/auth.ts";

// Use Gemini's image-capable model via native generateContent endpoint
const IMAGE_MODEL = "gemini-2.5-flash-image";
const GEN_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${key}`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return optionsCors(req);

  try {
    await requireUser(req);
    validatePayloadSize(req);
    checkRateLimit(req, { maxRequests: 10, windowSec: 60, keyPrefix: "gen-cover" });

    const { title, content, platform, style } = await req.json();

    // Input validation: title max 200 chars
    if (typeof title === "string" && title.length > 200) {
      return new Response(
        JSON.stringify({ error: "Title too long (max 200 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const platformPrompts: Record<string, { aspect: string; vibe: string }> = {
      xiaohongshu: {
        aspect: "3:4 vertical portrait",
        vibe: "Xiaohongshu aesthetic: bright airy natural lighting, warm sunny tones, soft pastel palette, lifestyle photography, cozy atmosphere, gentle bokeh, minimalist flat-lay or close-up details, natural textures",
      },
      wechat: {
        aspect: "16:9 horizontal landscape",
        vibe: "WeChat article style: professional editorial, balanced warm tones, sophisticated modern photography",
      },
      douyin: {
        aspect: "9:16 vertical full-screen",
        vibe: "Douyin/TikTok style: bold vibrant colors, high contrast, dynamic composition, youthful energy",
      },
    };

    const cfg = platformPrompts[platform] || platformPrompts.xiaohongshu;
    const snippet = (content || "").substring(0, 150).replace(/[#\n]/g, " ").trim();
    const prompt = `Generate a single photographic image in ${cfg.aspect} orientation. Topic: "${title}". Context: ${snippet}. Visual style: ${style || cfg.vibe}. CRITICAL: NO text, NO letters, NO words, NO watermarks, NO logos. Pure visual imagery only, like a real lifestyle photograph.`;

    // 重试配置：最多 3 次（首次 + 2 次重试），针对可恢复错误
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAYS = [800, 2000]; // ms，指数退避
    const isRetryable = (status: number) => status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

    let lastError: { status: number; body: string } | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      console.log(`[generate-cover] attempt ${attempt}/${MAX_ATTEMPTS} - model: ${IMAGE_MODEL}`);

      let response: Response;
      try {
        response = await fetch(GEN_URL(KEY), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        });
      } catch (networkErr) {
        console.error(`[generate-cover] network error on attempt ${attempt}:`, networkErr);
        lastError = { status: 0, body: String(networkErr) };
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
          continue;
        }
        break;
      }

      // 401/403：密钥问题，立刻失败不重试
      if (response.status === 401 || response.status === 403) {
        const t = await response.text();
        console.error("[generate-cover] auth error:", t);
        return new Response(
          JSON.stringify({ error: "图片服务暂不可用，请稍后再试或联系管理员", code: "AUTH_FAILED" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 可重试错误（429/5xx）
      if (!response.ok) {
        const t = await response.text();
        console.error(`[generate-cover] api error ${response.status} on attempt ${attempt}:`, t.substring(0, 300));
        lastError = { status: response.status, body: t };
        if (isRetryable(response.status) && attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
          continue;
        }
        break;
      }

      // 成功：解析图片
      const result = await response.json();
      const parts = result.candidates?.[0]?.content?.parts || [];
      for (const p of parts) {
        if (p.inlineData?.data) {
          const mime = p.inlineData.mimeType || "image/png";
          if (attempt > 1) console.log(`[generate-cover] succeeded on attempt ${attempt}`);
          return new Response(
            JSON.stringify({ imageUrl: `data:${mime};base64,${p.inlineData.data}` }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // 200 但没图（被安全策略拦截等），算作可重试
      console.error(`[generate-cover] no image in response on attempt ${attempt}:`, JSON.stringify(result).substring(0, 500));
      lastError = { status: 200, body: "no_image_returned" };
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
        continue;
      }
    }

    // 所有重试都失败，返回友好错误
    const status = lastError?.status ?? 500;
    let userMessage = "封面生成失败，请稍后重试 🌧️";
    let code = "UNKNOWN";

    if (status === 429) {
      userMessage = "AI 配图正忙，请喝口水稍后再试 ☕";
      code = "RATE_LIMITED";
    } else if (status === 0) {
      userMessage = "网络连接不稳定，请检查后重试";
      code = "NETWORK_ERROR";
    } else if (status >= 500) {
      userMessage = "图片服务暂时不可用，已重试多次仍失败，请稍后再试";
      code = "UPSTREAM_ERROR";
    } else if (status === 200) {
      userMessage = "AI 这次没生成出图片，可换个标题或风格再试一次 ✨";
      code = "NO_IMAGE";
    }

    return new Response(
      JSON.stringify({ error: userMessage, code, attempts: MAX_ATTEMPTS }),
      { status: status === 429 ? 429 : 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[generate-cover] unexpected error:", e);
    if (e instanceof Error && e.message.includes("Rate limit")) {
      return new Response(
        JSON.stringify({ error: e.message }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (e instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: e.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: "Internal server error", code: "INTERNAL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
