// suggest-angles — Generate 3-4 directional, content-aware angle suggestions
// based on a freshly created article. Each suggestion is a short, clickable
// prompt the user can send back to refine/rewrite the article from a new angle.
//
// Returns: { suggestions: Array<{ id, emoji, label, anglePrompt }> }
// label = short button text (≤ 14 字)
// anglePrompt = full prompt that will be sent to the chat when clicked
//
// IMPORTANT: This is intentionally NOT a streaming endpoint — it's a one-shot
// JSON call invoked after generation completes.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  AuthError,
  checkRateLimit,
  getCorsHeaders,
  optionsCors,
  requireUser,
  validatePayloadSize,
} from "../_shared/auth.ts";

const GEMINI_MODEL = "gemini-2.5-flash";
const URL_FOR = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

const SYSTEM_PROMPT = `你是一位资深内容编辑，擅长帮创作者从「这篇文章」出发，给出3-4条**方向性的、能启发用户重新思考内容**的修改建议。

【关键原则】
1. **基于这篇文章的具体内容**给建议，不要套话。要让用户读了就知道：「噢，AI真的看了我的文章」
2. **不要重复卡片上已有的操作**：润色、配封面图、换风格、提交审核、扩写、精简、补标签 —— 这些**绝对不能**出现，因为用户点卡片按钮就能做。
3. 建议的方向应该是**内容层面的二次创作**，例如：
   - 加一个真实案例 / 数据 / 反例
   - 换一个目标受众（针对宝妈、Z世代、专业人士等）
   - 换一个开头钩子（反常识、提问、故事）
   - 加一个对立观点 / 争议点
   - 把抽象观点变成具体场景
   - 提炼成清单 / 步骤 / 对比表
   - 加一个 call-back 收尾
4. 每条建议要**具体到这篇文章**，比如不要说"加个案例"，要说"加一个'用户实际用了 30 天后效果'的真实案例"
5. label ≤ 14 个汉字，要像用户自己会说出口的话
6. anglePrompt 是用户点击后会发送给 AI 的完整指令，要明确告诉 AI 怎么改

【输出 JSON 严格格式】
{
  "suggestions": [
    { "emoji": "💡", "label": "...", "anglePrompt": "..." }
  ]
}
只输出 JSON，不要任何额外文字、不要 markdown 代码块。`;

interface SuggestRequest {
  title: string;
  content: string;
  cta?: string;
  tags?: string[];
  platform?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return optionsCors(req);

  try {
    await requireUser(req);
    validatePayloadSize(req, 50_000);
    checkRateLimit(req, {
      maxRequests: 30,
      windowSec: 60,
      keyPrefix: "suggest-angles",
    });

    const body = (await req.json()) as SuggestRequest;
    const { title, content, cta, tags, platform } = body;

    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: "title and content are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    // Truncate content to keep prompt reasonable
    const safeContent = content.slice(0, 2000);
    const tagStr = (tags ?? []).join("、");

    const userPrompt = `文章信息：
- 平台：${platform ?? "未指定"}
- 标题：${title}
- 正文：${safeContent}
- CTA：${cta ?? "（无）"}
- 标签：${tagStr || "（无）"}

请基于这篇文章的**具体内容**，给我 3-4 条方向性的二次创作建议。`;

    const geminiBody = {
      systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.85,
        responseMimeType: "application/json",
      },
    };

    const resp = await fetch(URL_FOR(KEY), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("suggest-angles gemini error:", resp.status, t);
      return new Response(
        JSON.stringify({ error: "AI 服务暂时不可用", suggestions: [] }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const json = await resp.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{\"suggestions\":[]}";

    let parsed: { suggestions?: Array<{ emoji?: string; label?: string; anglePrompt?: string }> };
    try {
      const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("suggest-angles parse error:", err, "raw:", text);
      parsed = { suggestions: [] };
    }

    const suggestions = (parsed.suggestions ?? [])
      .filter((s) => s && s.label && s.anglePrompt)
      .slice(0, 4)
      .map((s, i) => ({
        id: `angle-${Date.now()}-${i}`,
        emoji: s.emoji || "💡",
        label: String(s.label).slice(0, 30),
        anglePrompt: String(s.anglePrompt).slice(0, 300),
      }));

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-angles error:", e);
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
      JSON.stringify({ error: "Internal server error", suggestions: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
