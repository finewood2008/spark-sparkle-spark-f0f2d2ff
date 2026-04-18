import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  getCorsHeaders,
  optionsCors,
  requireUser,
  validatePayloadSize,
} from "../_shared/auth.ts";

const GEMINI_MODEL = "gemini-2.5-flash";
const STREAM_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${key}`;
const GEN_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

function transformStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          const text = parsed.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text || "").join("") || "";
          if (text) {
            const chunk = { choices: [{ delta: { content: text }, index: 0 }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        } catch {/* ignore */}
      }
    },
    cancel() { reader.cancel(); },
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return optionsCors(req);

  try {
    await requireUser(req);
    validatePayloadSize(req);

    const { action, text, fullContent, platform, brandContext } = await req.json();

    // Input validation: text/fullContent max 20k chars
    if (typeof text === "string" && text.length > 20000) {
      return new Response(JSON.stringify({ error: "Text too long (max 20000 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof fullContent === "string" && fullContent.length > 20000) {
      return new Response(JSON.stringify({ error: "Content too long (max 20000 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const platformName =
      platform === "xiaohongshu" ? "小红书" :
      platform === "wechat" ? "微信公众号" :
      platform === "douyin" ? "抖音" : "社交媒体";

    let systemPrompt: string;
    let userPrompt: string;

    switch (action) {
      case "rewrite":
        systemPrompt = `你是专业的${platformName}内容编辑。请改写以下文本，保持核心意思但优化表达。直接返回改写后的文本。${brandContext || ""}`;
        userPrompt = text; break;
      case "expand":
        systemPrompt = `你是专业的${platformName}内容编辑。请扩写以下文本，增加细节、例子和深度。直接返回扩写后的文本。${brandContext || ""}`;
        userPrompt = text; break;
      case "simplify":
        systemPrompt = `你是专业的${platformName}内容编辑。请精简以下文本，去除冗余。直接返回精简后的文本。${brandContext || ""}`;
        userPrompt = text; break;
      case "polish":
        systemPrompt = `你是专业的${platformName}内容编辑。请润色整篇文章。直接返回完整文章。${brandContext || ""}`;
        userPrompt = fullContent || text; break;
      case "continue":
        systemPrompt = `你是专业的${platformName}内容创作者。请根据现有内容继续撰写。直接返回续写的内容。${brandContext || ""}`;
        userPrompt = `已有内容：\n${fullContent || text}\n\n请续写：`; break;
      case "generate_title":
        systemPrompt = `你是专业的${platformName}标题专家。请生成 3 个吸引人的标题，用换行分隔，不要编号。${brandContext || ""}`;
        userPrompt = fullContent || text; break;
      case "generate_tags":
        systemPrompt = `你是专业的${platformName}内容运营。请生成 3-5 个相关标签，每个一行，不带 # 号。${brandContext || ""}`;
        userPrompt = fullContent || text; break;
      case "generate_cta":
        systemPrompt = `你是专业的${platformName}内容运营。请生成一条有号召力的 CTA。${brandContext || ""}`;
        userPrompt = fullContent || text; break;
      case "learn_from_edit": {
        const learnPrompt = `分析用户对内容的修改，总结写作偏好。
原始：${text}
修改后：${fullContent}
返回 JSON：{"insights":["偏好1","偏好2"]} 只返回JSON。`;
        const r = await fetch(GEN_URL(KEY), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: learnPrompt }] }] }),
        });
        if (!r.ok) {
          return new Response(JSON.stringify({ error: "分析失败" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const result = await r.json();
        const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        return new Response(JSON.stringify({ raw }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      default:
        systemPrompt = `你是专业的${platformName}内容编辑。${brandContext || ""}`;
        userPrompt = text;
    }

    const response = await fetch(STREAM_URL(KEY), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini edit error:", response.status, t);
      const status = response.status;
      const msg = status === 429 ? "请求过于频繁" : "AI 服务暂时不可用";
      return new Response(JSON.stringify({ error: msg }), {
        status: status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(transformStream(response.body!), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-edit error:", e);
    if (e instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: e.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
