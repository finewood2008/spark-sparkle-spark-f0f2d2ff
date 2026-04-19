import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  getCorsHeaders,
  optionsCors,
  requireUser,
  validatePayloadSize,
  checkRateLimit,
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
    checkRateLimit(req, { maxRequests: 20, windowSec: 60, keyPrefix: "ai-edit" });

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
      case "restyle":
        systemPrompt = `你是专业的${platformName}内容编辑。请把整篇文章换一种调性重写一遍：在【活泼 / 专业 / 极简】三种风格里，选一种与原文当前风格**明显不同**的风格来重写。
- 保留原文的核心信息、事实和结构骨架
- 标题、CTA、Tag 不输出，只返回正文
- 字数与原文相近（±20%）
- 直接返回完整文章正文，不要任何解释或前后缀
${brandContext || ""}`;
        userPrompt = fullContent || text; break;
      case "expand_full":
        systemPrompt = `你是专业的${platformName}内容编辑。请扩写整篇文章：在保留原文结构和核心观点的前提下，增加细节、案例、数据或情感共鸣，让文章更详实。
- 不要改变文章主题
- 保持原文的语气和风格
- 字数控制在原文的 1.3-1.6 倍
- 直接返回扩写后的完整正文，不要任何解释
${brandContext || ""}`;
        userPrompt = fullContent || text; break;
      case "simplify_full":
        systemPrompt = `你是专业的${platformName}内容编辑。请精简整篇文章：去除冗余表达、合并重复观点，让文章更紧凑有力。
- 保留所有核心信息和关键案例
- 保持原文的语气和风格
- 字数控制在原文的 0.5-0.7 倍
- 直接返回精简后的完整正文，不要任何解释
${brandContext || ""}`;
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
      case "revise_with_angle":
        // text = the angle/direction prompt; fullContent = JSON-stringified existing article {title,content,cta,tags}
        // Returns a NEW full article in the same JSON shape — caller replaces the original.
        systemPrompt = `你是专业的${platformName}内容编辑。用户给你一篇现有文章和一个修改方向，请基于现有文章按照这个方向**重写**成一篇新版本。

【重要原则】
- **不是从零开始写新文章**，而是基于原文修改、增强、调整
- 保留原文的核心主题和价值主张
- 严格按照用户给的方向去改（比如"加一个真实案例"就要真的加案例，而不是只调措辞）
- 输出必须比原文更好、更有针对性
- 字数与原文相近（±30%）

【输出格式 — 严格 JSON】
{
  "title": "标题（可以微调）",
  "content": "正文",
  "cta": "CTA",
  "tags": ["标签1", "标签2"]
}
只输出 JSON，不要 markdown 代码块、不要任何额外文字。
${brandContext || ""}`;
        userPrompt = `【原文 JSON】
${fullContent || "{}"}

【修改方向】
${text}

请按方向重写，输出新的 JSON。`;
        break;
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
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
