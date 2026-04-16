import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Use Gemini's OpenAI-compatible chat endpoint with the image-capable model.
// (Imagen 3/4 predict endpoint requires paid tier and is not available on this key.)
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const IMAGE_MODEL = "gemini-2.5-flash-image";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { title, content, platform, style } = await req.json();

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY)
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const platformPrompts: Record<string, { aspect: string; vibe: string }> = {
      xiaohongshu: {
        aspect: "3:4 vertical portrait orientation",
        vibe: "Xiaohongshu aesthetic: bright and airy natural lighting, warm sunny tones, soft pastel color palette, lifestyle photography feel, cozy and inviting atmosphere, slightly dreamy with gentle bokeh, Instagram-worthy composition, clean minimalist flat-lay or close-up details, natural textures like linen/wood/flowers",
      },
      wechat: {
        aspect: "16:9 horizontal landscape orientation",
        vibe: "WeChat article style: professional yet approachable, clean editorial layout feel, balanced warm tones, sophisticated modern photography, subtle gradients, business-casual aesthetic",
      },
      douyin: {
        aspect: "9:16 vertical full-screen orientation",
        vibe: "Douyin/TikTok style: bold vibrant colors, high contrast, eye-catching dynamic composition, trendy pop culture aesthetic, energetic and youthful feel, strong visual impact",
      },
    };

    const platformConfig = platformPrompts[platform] || platformPrompts.xiaohongshu;
    const contentSnippet = (content || "").substring(0, 150).replace(/[#\n]/g, " ").trim();

    const prompt = `Generate a single photographic image in ${platformConfig.aspect}. Topic: "${title}". Context: ${contentSnippet}. Visual style: ${style || platformConfig.vibe}. CRITICAL RULES: Absolutely NO text, NO letters, NO words, NO watermarks, NO logos anywhere in the image. Pure visual imagery only. The image should feel like a real photograph taken by a lifestyle blogger.`;

    console.log("Calling Gemini image generation:", IMAGE_MODEL);

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
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
      console.error("Gemini auth error:", errText);
      return new Response(
        JSON.stringify({ error: "Google API Key 无效或没有权限" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini image API error:", response.status, t);
      return new Response(
        JSON.stringify({ error: `图片生成暂不可用 (${response.status})，请稍后重试` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();

    // Try OpenAI-compatible format: choices[0].message.images[0].image_url.url
    const images = result.choices?.[0]?.message?.images;
    if (Array.isArray(images) && images.length > 0) {
      const imageUrl = images[0].image_url?.url || images[0].url;
      if (imageUrl) {
        return new Response(
          JSON.stringify({ imageUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Try inline data URL in content string
    const msgContent = result.choices?.[0]?.message?.content;
    if (msgContent && typeof msgContent === "string" && msgContent.includes("data:image")) {
      const match = msgContent.match(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/);
      if (match) {
        return new Response(
          JSON.stringify({ imageUrl: match[1] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Try multipart content array
    if (Array.isArray(msgContent)) {
      for (const part of msgContent) {
        if (part.type === "image_url" && part.image_url?.url) {
          return new Response(
            JSON.stringify({ imageUrl: part.image_url.url }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    console.error("No image in Gemini response:", JSON.stringify(result).substring(0, 1500));
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
