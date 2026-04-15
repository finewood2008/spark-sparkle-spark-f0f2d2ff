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
    const { messages, mode, platform, brandContext } = await req.json();
    const API_KEY = Deno.env.get("AIPAIBOX_API_KEY");
    if (!API_KEY) throw new Error("AIPAIBOX_API_KEY is not configured");

    let systemPrompt: string;

    if (mode === "generate") {
      const platformName =
        platform === "xiaohongshu" ? "小红书" :
        platform === "wechat" ? "微信公众号" :
        platform === "douyin" ? "抖音" : "社交媒体";

      systemPrompt = `你是"火花"，一个专业的社交媒体内容创作助手。
用户正在请求你为${platformName}平台生成一篇完整文章。

你必须严格按照以下 JSON 格式返回（不要包含 markdown 代码块标记，直接返回纯 JSON）：
{
  "title": "吸引人的标题",
  "content": "完整的正文内容，200-500字",
  "cta": "行动号召语",
  "tags": ["标签1", "标签2", "标签3"]
}

内容要求：
- 标题要吸睛、有吸引力
- 正文要有价值、有深度
- CTA 要有号召力
- 标签 3-5 个
${brandContext || ""}`;
    } else {
      systemPrompt = `你是"火花"，一个专业的社交媒体内容创作助手和策略顾问。

你的职责：
1. 与用户讨论内容方向、选题、策略
2. 提供专业的内容建议和优化意见
3. 当用户明确要求生成文章时，告诉他们你已准备好，引导他们点击"生成文章"按钮
4. 回答关于品牌、平台、数据分析的问题

请用简洁、友好、专业的语气回复。适当使用 emoji 增加亲和力。
回复控制在 200 字以内，除非用户明确要求详细内容。

重要：你的角色是指挥和讨论，不要在对话中直接输出完整文章。当用户想要生成文章时，告诉他们使用生成功能。
${brandContext || ""}`;
    }

    const response = await fetch("https://api.aipaibox.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "请求过于频繁，请稍后再试" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402 || response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: "API Key 无效或额度不足，请检查设置" }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("API error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI 服务暂时不可用" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "未知错误" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
