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
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const platformName =
      platform === "xiaohongshu" ? "小红书" :
      platform === "wechat" ? "微信公众号" :
      platform === "douyin" ? "抖音" : "社交媒体";

    const prompt = `A beautiful cover photo for a ${platformName} social media article titled "${title}". ${(content || "").substring(0, 200)}. Style: ${style || "Modern, clean, vibrant colors, professional photography style"}. Do NOT include any text or letters in the image. Clean composition, harmonious colors, visually striking hero image.`;

    // Try Imagen 3 API first
    const imagenModels = [
      "imagen-3.0-generate-002",
      "imagen-3.0-generate-001",
    ];

    for (const model of imagenModels) {
      console.log(`Trying Imagen model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${GEMINI_KEY}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1 },
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
        console.error(`Imagen ${model} error:`, response.status, t);
        continue;
      }

      const result = await response.json();
      const predictions = result.predictions;
      if (predictions && predictions.length > 0 && predictions[0].bytesBase64Encoded) {
        const imageUrl = `data:image/png;base64,${predictions[0].bytesBase64Encoded}`;
        return new Response(
          JSON.stringify({ imageUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("No image in Imagen response for model:", model);
    }

    // Fallback: try Gemini with generateContent + IMAGE modality
    const geminiModels = [
      "gemini-2.0-flash-exp-image-generation",
      "gemini-2.0-flash-preview-image-generation",
    ];

    for (const model of geminiModels) {
      console.log(`Trying Gemini model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error(`Gemini ${model} error:`, response.status, t);
        continue;
      }

      const result = await response.json();
      const parts = result.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          return new Response(
            JSON.stringify({ imageUrl }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    console.error("All models failed");
    return new Response(
      JSON.stringify({ error: "图片生成暂不可用，请确认 API Key 已开启 Imagen 或图片生成权限" }),
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
