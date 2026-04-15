import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { action, text, fullContent, platform, brandContext } = await req.json();
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const platformName =
      platform === "xiaohongshu" ? "小红书" :
      platform === "wechat" ? "微信公众号" :
      platform === "douyin" ? "抖音" : "社交媒体";

    let systemPrompt: string;
    let userPrompt: string;

    switch (action) {
      case "rewrite":
        systemPrompt = `你是专业的${platformName}内容编辑。请改写以下文本，保持核心意思但优化表达、提升吸引力。直接返回改写后的文本，不要添加任何解释。${brandContext || ""}`;
        userPrompt = text;
        break;
      case "expand":
        systemPrompt = `你是专业的${platformName}内容编辑。请扩写以下文本，增加细节、例子和深度，使内容更丰富。直接返回扩写后的文本，不要添加任何解释。${brandContext || ""}`;
        userPrompt = text;
        break;
      case "simplify":
        systemPrompt = `你是专业的${platformName}内容编辑。请精简以下文本，保留核心信息，去除冗余。直接返回精简后的文本，不要添加任何解释。${brandContext || ""}`;
        userPrompt = text;
        break;
      case "polish":
        systemPrompt = `你是专业的${platformName}内容编辑。请润色整篇文章，优化措辞和结构，提升可读性和吸引力。直接返回润色后的完整文章，不要添加任何解释。${brandContext || ""}`;
        userPrompt = fullContent || text;
        break;
      case "continue":
        systemPrompt = `你是专业的${platformName}内容创作者。请根据现有内容继续撰写，保持风格一致。直接返回续写的内容（不包含已有内容），不要添加任何解释。${brandContext || ""}`;
        userPrompt = `已有内容：\n${fullContent || text}\n\n请续写：`;
        break;
      case "generate_title":
        systemPrompt = `你是专业的${platformName}标题专家。请根据以下正文内容生成 3 个吸引人的标题选项，用换行分隔，不要编号。${brandContext || ""}`;
        userPrompt = fullContent || text;
        break;
      case "generate_tags":
        systemPrompt = `你是专业的${platformName}内容运营。请根据以下内容生成 3-5 个相关标签，每个标签一行，不带 # 号。${brandContext || ""}`;
        userPrompt = fullContent || text;
        break;
      case "generate_cta":
        systemPrompt = `你是专业的${platformName}内容运营。请根据以下内容生成一条有号召力的 CTA（行动号召语），直接返回文本。${brandContext || ""}`;
        userPrompt = fullContent || text;
        break;
      case "learn_from_edit": {
        const learnPrompt = `你是内容创作助手的学习模块。用户修改了AI生成的内容，请分析修改差异并总结用户的写作偏好。

原始内容：
${text}

用户修改后：
${fullContent}

请用JSON格式返回1-3条偏好洞察，每条不超过20字，格式：
{"insights":["偏好1","偏好2"]}

只返回JSON，不要其他文字。`;

        const learnResp = await fetch(GEMINI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${GEMINI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gemini-2.5-flash",
            messages: [{ role: "user", content: learnPrompt }],
          }),
        });

        if (!learnResp.ok) {
          return new Response(JSON.stringify({ error: "分析失败" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const learnResult = await learnResp.json();
        const raw = learnResult.choices?.[0]?.message?.content || "{}";
        return new Response(JSON.stringify({ raw }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      default:
        systemPrompt = `你是专业的${platformName}内容编辑。请按用户要求处理文本。${brandContext || ""}`;
        userPrompt = text;
    }

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
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
      const t = await response.text();
      console.error("AI edit error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI 服务暂时不可用" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-edit error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "未知错误" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
