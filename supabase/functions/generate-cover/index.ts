import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { title, content, platform, style } = await req.json();
    
    // Image generation requires a dedicated image model via Lovable AI Gateway
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const platformName =
      platform === "xiaohongshu" ? "小红书" :
      platform === "wechat" ? "微信公众号" :
      platform === "douyin" ? "抖音" : "社交媒体";

    const prompt = `Generate an image: A beautiful cover photo for a ${platformName} social media article titled "${title}". ${(content || "").substring(0, 200)}. Style: ${style || "Modern, clean, vibrant colors, professional photography style"}. Do NOT include any text or letters in the image. Clean composition, harmonious colors, visually striking hero image.`;

    console.log("Calling Lovable AI Gateway with gemini-2.5-flash-image for image generation");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
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

    if (!response.ok) {
      const t = await response.text();
      console.error("API error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "图片生成暂不可用，请稍后重试" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log("API response keys:", JSON.stringify(Object.keys(result)));

    // Try OpenAI-compatible image format
    const images = result.choices?.[0]?.message?.images;
    if (images && images.length > 0) {
      const imageUrl = images[0].image_url?.url || images[0].url;
      if (imageUrl) {
        return new Response(
          JSON.stringify({ imageUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Try inline base64 in content
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

    console.error("No image found in response:", JSON.stringify(result).substring(0, 1000));
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
