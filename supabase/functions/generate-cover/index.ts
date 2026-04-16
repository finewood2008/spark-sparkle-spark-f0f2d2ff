import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Google Gemini Imagen 3 — predict endpoint with API key as query param
const IMAGEN_MODEL = "imagen-3.0-generate-002";
const IMAGEN_URL = (apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${apiKey}`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { title, content, platform, style } = await req.json();

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY)
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    // Imagen 3 only supports a fixed list of aspect ratios: 1:1, 3:4, 4:3, 9:16, 16:9
    const platformPrompts: Record<string, { aspect: string; vibe: string }> = {
      xiaohongshu: {
        aspect: "3:4",
        vibe: "Xiaohongshu aesthetic: bright and airy natural lighting, warm sunny tones, soft pastel color palette, lifestyle photography feel, cozy and inviting atmosphere, slightly dreamy with gentle bokeh, Instagram-worthy composition, clean minimalist flat-lay or close-up details, natural textures like linen/wood/flowers",
      },
      wechat: {
        aspect: "16:9",
        vibe: "WeChat article style: professional yet approachable, clean editorial layout feel, balanced warm tones, sophisticated modern photography, subtle gradients, business-casual aesthetic",
      },
      douyin: {
        aspect: "9:16",
        vibe: "Douyin/TikTok style: bold vibrant colors, high contrast, eye-catching dynamic composition, trendy pop culture aesthetic, energetic and youthful feel, strong visual impact",
      },
    };

    const platformConfig = platformPrompts[platform] || platformPrompts.xiaohongshu;
    const contentSnippet = (content || "").substring(0, 150).replace(/[#\n]/g, " ").trim();

    const prompt = `A photographic image. Topic: "${title}". Context: ${contentSnippet}. Visual style: ${style || platformConfig.vibe}. CRITICAL RULES: Absolutely NO text, NO letters, NO words, NO watermarks, NO logos anywhere in the image. Pure visual imagery only. The image should feel like a real photograph taken by a lifestyle blogger.`;

    console.log("Calling Gemini Imagen 3 directly");

    const response = await fetch(IMAGEN_URL(GOOGLE_GEMINI_API_KEY), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: platformConfig.aspect,
          personGeneration: "allow_adult",
        },
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "请求过于频繁，请稍后再试" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (response.status === 401 || response.status === 403) {
      const errText = await response.text();
      console.error("Imagen auth error:", errText);
      return new Response(
        JSON.stringify({ error: "Google API Key 无效或没有 Imagen 访问权限" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const t = await response.text();
      console.error("Imagen API error:", response.status, t);
      return new Response(
        JSON.stringify({ error: `图片生成暂不可用 (${response.status})，请稍后重试` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log("Imagen response keys:", JSON.stringify(Object.keys(result)));

    // Imagen 3 response: { predictions: [{ bytesBase64Encoded, mimeType }] }
    const prediction = result.predictions?.[0];
    if (prediction?.bytesBase64Encoded) {
      const mime = prediction.mimeType || "image/png";
      const imageUrl = `data:${mime};base64,${prediction.bytesBase64Encoded}`;
      return new Response(
        JSON.stringify({ imageUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error("No image in Imagen response:", JSON.stringify(result).substring(0, 1000));
    return new Response(
      JSON.stringify({ error: "图片生成失败，请重试" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-cover error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "未知错误" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
