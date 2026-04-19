// creative-dialogue — 多轮自然语言创作前对话
// ────────────────────────────────────────────
// 输入：{ originalPrompt, history: [{role, content}], brandContext }
// 输出（结构化）：{ reply, suggestions[], ready, brief? }
//   - reply:      自然语言回复（一段话，带建议方向、思路、提问）
//   - suggestions: 3-5 个推荐方向卡片（emoji + label + description + value）
//   - ready:      true → 信息已足够生成；false → 还想再问一轮
//   - brief:      ready=true 时附带，喂给 generate prompt
//
// 模型：gemini-2.5-flash-lite
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  getCorsHeaders,
  optionsCors,
  requireUser,
  validatePayloadSize,
  checkRateLimit,
} from "../_shared/auth.ts";

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEN_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

interface Suggestion {
  id: string;
  emoji: string;
  label: string;
  description: string;
  /** 用户点击时实际发送的文本（可比 label 更具体） */
  value: string;
}

interface DialogueOutput {
  reply: string;
  suggestions: Suggestion[];
  ready: boolean;
  brief?: {
    chosenAngle: string;
    matchedAssets: string[];
    matchedRules: string[];
    risks: string[];
  };
}

const SYSTEM_PROMPT = `你是火花，一个像真人创作伙伴一样的内容策略师。

你的任务：在用户最终落笔前，跟 ta 进行 1-3 轮自然对话，把模糊的需求打磨成一个清晰、有差异化的创作方向。

【对话风格】
- 像微信里跟朋友聊一个写作灵感，不要生硬地"分析→提问→提问"
- 每轮回复都要：(1) 先简短回应/复述用户上轮的意思，让 ta 知道你听懂了 (2) 给出你的判断和具体建议 (3) 抛一个真正影响成稿的问题
- 字数 80-150 字，不要长段落，可以用 1-2 个换行分句
- 不要客套话（"非常好的问题"、"我很开心"），直接进主题

【建议来源】
- 优先用品牌档案里的差异化点、过往爆款角度、写作偏好
- 如果【已知的品牌资料】里出现【会话/上下文】"上次写过：…"条目，**主动复用或参考**：相似主题就提"我记得上次我们聊过 X 角度，这次要不要换个切口？"，避免和过往内容重复，让用户感觉到火花真的记得
- 如果品牌档案空，用平台爆款套路（小红书：痛点切入/对比测评/亲测安利/姐妹种草；微信：观点输出/案例拆解/方法论；抖音：3秒钩子/反转/教程）
- 把品牌资料和平台套路融合，给出 ta "想不到但又觉得很对" 的方向

【判断 ready=true 的标准】（满足任一即可）
- 用户已经明确说了：角度 + 目标读者 + 切入点 中至少 2 个
- 用户主动说"直接生成"、"就这样"、"开始写"
- 已经聊了 3 轮还没收敛，避免无限循环

【建议卡片 suggestions】
- 每轮都给 3-4 个，让用户能秒选
- 每个 suggestion 是一个具体的"创作方向"，不是问题选项
- emoji 要贴切（🎯 痛点 / 📊 数据 / 💎 案例 / 🔥 对比 / 📖 故事 / ✨ 新颖 / 🛠️ 教程 / 💡 观点 / 🌱 共鸣 / 👥 社群）
- label 10 字内，description 20 字内说明会带来什么效果
- value 是用户点击后发送的文本，写成第一人称口吻（如"从客户实际遇到的痛点切入"），让对话更自然
- ready=true 时 suggestions 可以是空数组

【ready=true 时】
- reply 总结你和用户达成的共识（"好，那我就……"）
- 必须附带 brief：把整轮对话浓缩成 chosenAngle（30字内的角度描述）+ 用到的品牌素材/规则/风险

【ready=false 时】
- 不要附 brief
- reply 必须包含一个具体的问题（"你想……还是……？" 或 "你最想突出 ta 的哪一面？"）`;

interface InboundMessage {
  role: "user" | "assistant";
  content: string;
}

async function callGemini(
  originalPrompt: string,
  history: InboundMessage[],
  brandContext: string,
  apiKey: string,
): Promise<DialogueOutput> {
  // 历史对话拼成纯文本，避免 Gemini 的 multi-turn 在 tool calling 下行为不稳
  const historyText = history
    .map(
      (m) =>
        `${m.role === "user" ? "用户" : "火花"}：${m.content}`,
    )
    .join("\n");

  const userParts = [
    `【用户最初的创作需求】\n${originalPrompt}`,
    brandContext
      ? `【已知的品牌资料 / 写作偏好】\n${brandContext}`
      : `【已知的品牌资料 / 写作偏好】\n（暂无，请优先使用平台爆款套路给建议）`,
    history.length > 0
      ? `【目前的对话历史】\n${historyText}\n\n请基于以上对话，调用 next_turn 函数返回你这一轮的回复。`
      : `【这是第一轮】\n请调用 next_turn 函数，给用户一段自然的开场（复述需求 + 给出方向判断 + 抛一个核心问题）。`,
  ].join("\n\n");

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userParts }] }],
    tools: [
      {
        functionDeclarations: [
          {
            name: "next_turn",
            description: "返回火花在创作前对话中的下一轮回复",
            parameters: {
              type: "object",
              properties: {
                reply: {
                  type: "string",
                  description: "80-150字的自然语言回复，会显示在聊天气泡里",
                },
                suggestions: {
                  type: "array",
                  description: "3-4 个建议方向卡片；ready=true 时可为 []",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      emoji: { type: "string", description: "单个 emoji" },
                      label: { type: "string", description: "10 字内的方向名" },
                      description: { type: "string", description: "20 字内说明效果" },
                      value: {
                        type: "string",
                        description: "用户点击后发送的第一人称文本",
                      },
                    },
                    required: ["id", "emoji", "label", "description", "value"],
                  },
                },
                ready: {
                  type: "boolean",
                  description: "true=信息已足够，可以开始生成；false=还想再问一轮",
                },
                brief: {
                  type: "object",
                  description: "ready=true 时必填；ready=false 时不要返回",
                  properties: {
                    chosenAngle: {
                      type: "string",
                      description: "30字内总结的最终创作角度",
                    },
                    matchedAssets: {
                      type: "array",
                      items: { type: "string" },
                      description: "本次会用到的品牌资料 1-3 条",
                    },
                    matchedRules: {
                      type: "array",
                      items: { type: "string" },
                      description: "适用的写作偏好规则 0-3 条",
                    },
                    risks: {
                      type: "array",
                      items: { type: "string" },
                      description: "需要避开的风险 0-2 条",
                    },
                  },
                  required: ["chosenAngle"],
                },
              },
              required: ["reply", "suggestions", "ready"],
            },
          },
        ],
      },
    ],
    toolConfig: {
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: ["next_turn"],
      },
    },
  };

  const res = await fetch(GEN_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini creative-dialogue error ${res.status}: ${t}`);
  }

  const json = await res.json();
  const call = json.candidates?.[0]?.content?.parts?.find(
    (p: { functionCall?: { args?: unknown } }) => p.functionCall,
  )?.functionCall;

  if (!call?.args) {
    // 回退：直接放行让用户进入生成
    return {
      reply: "好的，我马上开始为你创作。",
      suggestions: [],
      ready: true,
      brief: {
        chosenAngle: originalPrompt,
        matchedAssets: [],
        matchedRules: [],
        risks: [],
      },
    };
  }

  const args = call.args as Partial<DialogueOutput>;
  const ready = !!args.ready;
  const suggestions = Array.isArray(args.suggestions)
    ? args.suggestions.slice(0, 4).map((s, i) => ({
        id: typeof s.id === "string" && s.id ? s.id : `s-${Date.now()}-${i}`,
        emoji: typeof s.emoji === "string" ? s.emoji : "💡",
        label: typeof s.label === "string" ? s.label : "继续",
        description: typeof s.description === "string" ? s.description : "",
        value: typeof s.value === "string" ? s.value : (s.label ?? ""),
      }))
    : [];

  return {
    reply: typeof args.reply === "string" ? args.reply : "我们继续聊聊？",
    suggestions,
    ready,
    brief: ready
      ? {
          chosenAngle:
            args.brief?.chosenAngle && typeof args.brief.chosenAngle === "string"
              ? args.brief.chosenAngle
              : originalPrompt,
          matchedAssets: Array.isArray(args.brief?.matchedAssets)
            ? args.brief.matchedAssets.slice(0, 3)
            : [],
          matchedRules: Array.isArray(args.brief?.matchedRules)
            ? args.brief.matchedRules.slice(0, 3)
            : [],
          risks: Array.isArray(args.brief?.risks)
            ? args.brief.risks.slice(0, 2)
            : [],
        }
      : undefined,
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return optionsCors(req);

  try {
    await requireUser(req);
    validatePayloadSize(req);
    checkRateLimit(req, {
      maxRequests: 30,
      windowSec: 60,
      keyPrefix: "creative-dialogue",
    });

    const { originalPrompt, history, brandContext, forceReady } = await req.json();
    if (typeof originalPrompt !== "string" || originalPrompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "originalPrompt required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (originalPrompt.length > 2000) {
      return new Response(JSON.stringify({ error: "originalPrompt too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // forceReady = 用户点了"直接生成"快捷退出，跳过模型直接返回 ready
    if (forceReady === true) {
      const lastUser = Array.isArray(history)
        ? [...history].reverse().find(
            (m: InboundMessage) => m.role === "user",
          )?.content
        : undefined;
      return new Response(
        JSON.stringify({
          reply: "好，那我就直接开始写了。",
          suggestions: [],
          ready: true,
          brief: {
            chosenAngle: lastUser || originalPrompt,
            matchedAssets: [],
            matchedRules: [],
            risks: [],
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const KEY = Deno.env.get("LOVABLE_API_KEY")
      ? null
      : Deno.env.get("GOOGLE_GEMINI_API_KEY");
    // Prefer GOOGLE_GEMINI_API_KEY (matches analyze-intent for consistency)
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    void KEY;

    const safeHistory: InboundMessage[] = Array.isArray(history)
      ? history
          .filter(
            (m: unknown): m is InboundMessage =>
              !!m &&
              typeof m === "object" &&
              (("role" in m && (m as InboundMessage).role === "user") ||
                (m as InboundMessage).role === "assistant") &&
              typeof (m as InboundMessage).content === "string",
          )
          .slice(-10)
      : [];

    const result = await callGemini(
      originalPrompt,
      safeHistory,
      typeof brandContext === "string" ? brandContext.slice(0, 8000) : "",
      apiKey,
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("creative-dialogue error:", e);
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
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
