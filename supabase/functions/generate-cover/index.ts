import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Use Gemini's image-capable model via native generateContent endpoint
const IMAGE_MODEL = "gemini-2.5-flash-image";
const GEN_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${key}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, content, platform, style } = await req.json();
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

    console.log("Calling Gemini image:", IMAGE_MODEL);

    const response = await fetch(GEN_URL(KEY), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 401 || response.status === 403) {
      const t = await response.text();
      console.error("Auth error:", t);
      return new Response(JSON.stringify({ error: "Google API Key 无效或没有权限" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("Image API error:", response.status, t);
      return new Response(JSON.stringify({ error: `图片生成暂不可用 (${response.status})` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const parts = result.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      if (p.inlineData?.data) {
        const mime = p.inlineData.mimeType || "image/png";
        return new Response(
          JSON.stringify({ imageUrl: `data:${mime};base64,${p.inlineData.data}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.error("No image in response:", JSON.stringify(result).substring(0, 1000));
    return new Response(JSON.stringify({ error: "图片生成失败，请重试" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-cover error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "未知错误" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
