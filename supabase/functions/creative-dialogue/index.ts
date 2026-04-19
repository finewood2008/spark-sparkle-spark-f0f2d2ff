// creative-dialogue — 多轮自然语言创作前对话（流式版）
// ────────────────────────────────────────────────────
// 协议升级：从一次性 JSON 改为 SSE 双段式：
//   ① data: {"type":"text","delta":"..."}   ← 流式吐 reply 文字
//   ② data: {"type":"text_done"}            ← reply 文字结束
//   ③ data: {"type":"meta", suggestions, ready, brief?} ← 结构化卡片/状态
//   ④ data: [DONE]
//
// 实现思路：Gemini tool-calling 模式下 streamGenerateContent 是把整个
// functionCall args 一次性吐出，无法真流式 reply。所以分两步：
//   1) 先用普通 streamGenerateContent（无 tool）流式生成 reply 文字
//   2) 同一对话上下文 + 已生成的 reply，再用 tool-calling 拿
//      {suggestions, ready, brief}（不再让模型重复生成 reply）
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
const STREAM_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${key}`;
const GEN_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

interface Suggestion {
  id: string;
  emoji: string;
  label: string;
  description: string;
  /** 用户点击时实际发送的文本 */
  value: string;
}

interface MetaPayload {
  suggestions: Suggestion[];
  ready: boolean;
  brief?: {
    chosenAngle: string;
    matchedAssets: string[];
    matchedRules: string[];
    risks: string[];
  };
}

interface InboundMessage {
  role: "user" | "assistant";
  content: string;
}

// ─────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────

/** Step 1 prompt：让模型像真人一样流式吐一段分析/回应文字（60-120 字） */
const REPLY_SYSTEM = `你是火花，一个像真人创作伙伴一样的内容策略师。

用户在准备写一篇内容，你要在 ta 落笔前跟 ta 多轮自然对话，把模糊的需求**循序渐进地收敛**成一个具体、可落笔的方向。

【⚠️ 最重要的原则：每一轮都基于上一轮用户的选择往下"钻"，绝不"平移"】
对话是一棵收敛的树，不是一组平行的问题：
- 第 1 轮：从最大颗粒度切入（受众 / 大方向 / 调性）
- 第 2 轮：基于用户第 1 轮的选择，再切一刀更细的维度
- 第 3 轮：基于第 1+2 轮的选择，问最后一个落地细节（开篇钩子 / 结构 / 情绪基调 等）
- 一旦同时锁定 2 个维度，就该收尾，不要再问

【❌ 严禁这样做】
- 不要在每一轮都重新抛"技术解读 / 应用前景 / 对比分析"这种**与上一轮同级**的方向选项
- 不要无视用户已经选过的内容，重新洗牌问类似问题
- 不要让对话"原地打转"——如果你发现自己想问的问题和上一轮性质很像，那就该收尾了

【这一轮你要输出的文字】
60-120 字、2-3 句话的口语化短段落：
- 先用半句话**确认/复述用户刚才选定的方向**（让 ta 知道你接住了）
- 然后基于这个已锁定的方向，提出**下一层**的细化问题（"既然定了 X，那 X 里你更想……还是……？"）
- 不要列表、不要 markdown、不要 emoji 开头、不要客套话

【已聊过 2 轮以上 或 用户已锁定 2 个维度时】
- 直接说"好，那我就……开始写"（30-50 字），结束对话

只输出这段对话文字，不要任何前缀后缀、不要 JSON、不要代码块。`;

/** Step 2 prompt：基于已有 reply，输出结构化的 suggestions/ready/brief */
const META_SYSTEM = `你是火花的结构化助手。

我会给你：用户的原始需求 + 完整对话历史 + 火花刚刚说的新一轮回复。
请基于这些信息，调用 next_meta 函数返回这一轮配套的卡片选项和 ready 状态。

【suggestions 卡片】
- 每个 suggestion 是一个"创作方向"，不是问题选项
- 3-4 个，每个要能秒选
- emoji 贴切（🎯 痛点 / 📊 数据 / 💎 案例 / 🔥 对比 / 📖 故事 / ✨ 新颖 / 🛠️ 教程 / 💡 观点 / 🌱 共鸣 / 👥 社群）
- label ≤10 字，description ≤20 字说明效果
- value 用第一人称，是用户点击后发送的文本（如"从客户实际遇到的痛点切入"）
- 优先用品牌档案里的差异化点
- 如果火花的 reply 已经在说"好那我就开始写"或类似收尾意图，suggestions 返回 []

【ready 判断】（满足任一即可）
- 用户已明确说了 角度 + 目标读者 + 切入点 中至少 2 个
- 用户主动说"直接生成"、"就这样"、"开始写"
- 已经聊了 3 轮还没收敛
- 火花的 reply 本身已经在收尾（如"好，那我就……开始写"）

【ready=true 时】
- 必须附带 brief：chosenAngle (≤30 字最终角度) + 用到的品牌素材/规则/风险
- suggestions 返回 []`;

// ─────────────────────────────────────────────────────────────
// Step 1: 流式吐 reply 文字
// ─────────────────────────────────────────────────────────────
function buildReplyUserParts(
  originalPrompt: string,
  history: InboundMessage[],
  brandContext: string,
): string {
  const historyText = history
    .map((m) => `${m.role === "user" ? "用户" : "火花"}：${m.content}`)
    .join("\n");
  return [
    `【用户最初的创作需求】\n${originalPrompt}`,
    brandContext
      ? `【已知的品牌资料 / 写作偏好】\n${brandContext}`
      : `【已知的品牌资料 / 写作偏好】\n（暂无，请用平台爆款套路给方向）`,
    history.length > 0
      ? `【目前的对话历史】\n${historyText}\n\n请输出火花这一轮的回复文字。`
      : `【这是第一轮】\n请输出一段自然的开场（复述需求 + 给出方向判断 + 抛核心问题）。`,
  ].join("\n\n");
}

async function startReplyStream(
  originalPrompt: string,
  history: InboundMessage[],
  brandContext: string,
  apiKey: string,
): Promise<Response> {
  const body = {
    systemInstruction: { parts: [{ text: REPLY_SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: buildReplyUserParts(originalPrompt, history, brandContext) }] }],
    generationConfig: { temperature: 0.85 },
  };
  return await fetch(STREAM_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─────────────────────────────────────────────────────────────
// Step 2: 拿 suggestions + ready + brief
// ─────────────────────────────────────────────────────────────
async function callMeta(
  originalPrompt: string,
  history: InboundMessage[],
  reply: string,
  brandContext: string,
  apiKey: string,
): Promise<MetaPayload> {
  const historyText = history
    .map((m) => `${m.role === "user" ? "用户" : "火花"}：${m.content}`)
    .join("\n");

  const userText = [
    `【用户最初的需求】\n${originalPrompt}`,
    brandContext ? `【品牌资料】\n${brandContext}` : "",
    historyText ? `【对话历史】\n${historyText}` : "",
    `【火花刚刚说的新一轮回复】\n${reply}`,
    `请调用 next_meta 函数。`,
  ].filter(Boolean).join("\n\n");

  const body = {
    systemInstruction: { parts: [{ text: META_SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    tools: [{
      functionDeclarations: [{
        name: "next_meta",
        description: "返回这一轮的卡片选项和 ready 状态",
        parameters: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              description: "3-4 个建议方向卡片；ready=true 时为 []",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  emoji: { type: "string" },
                  label: { type: "string" },
                  description: { type: "string" },
                  value: { type: "string" },
                },
                required: ["id", "emoji", "label", "description", "value"],
              },
            },
            ready: { type: "boolean" },
            brief: {
              type: "object",
              description: "ready=true 时必填",
              properties: {
                chosenAngle: { type: "string" },
                matchedAssets: { type: "array", items: { type: "string" } },
                matchedRules: { type: "array", items: { type: "string" } },
                risks: { type: "array", items: { type: "string" } },
              },
              required: ["chosenAngle"],
            },
          },
          required: ["suggestions", "ready"],
        },
      }],
    }],
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["next_meta"] } },
  };

  const res = await fetch(GEN_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini meta call ${res.status}: ${t}`);
  }
  const json = await res.json();
  const args = json.candidates?.[0]?.content?.parts?.find(
    (p: { functionCall?: { args?: unknown } }) => p.functionCall,
  )?.functionCall?.args as Partial<MetaPayload> | undefined;

  const ready = !!args?.ready;
  const suggestions = Array.isArray(args?.suggestions)
    ? args!.suggestions!.slice(0, 4).map((s, i) => ({
      id: typeof s.id === "string" && s.id ? s.id : `s-${Date.now()}-${i}`,
      emoji: typeof s.emoji === "string" ? s.emoji : "💡",
      label: typeof s.label === "string" ? s.label : "继续",
      description: typeof s.description === "string" ? s.description : "",
      value: typeof s.value === "string" ? s.value : (s.label ?? ""),
    }))
    : [];

  return {
    suggestions,
    ready,
    brief: ready
      ? {
        chosenAngle: typeof args?.brief?.chosenAngle === "string" && args.brief.chosenAngle
          ? args.brief.chosenAngle
          : originalPrompt,
        matchedAssets: Array.isArray(args?.brief?.matchedAssets) ? args!.brief!.matchedAssets!.slice(0, 3) : [],
        matchedRules: Array.isArray(args?.brief?.matchedRules) ? args!.brief!.matchedRules!.slice(0, 3) : [],
        risks: Array.isArray(args?.brief?.risks) ? args!.brief!.risks!.slice(0, 2) : [],
      }
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// SSE encoder helper
// ─────────────────────────────────────────────────────────────
function sseLine(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return optionsCors(req);

  try {
    await requireUser(req);
    validatePayloadSize(req);
    checkRateLimit(req, { maxRequests: 30, windowSec: 60, keyPrefix: "creative-dialogue" });

    const { originalPrompt, history, brandContext, forceReady } = await req.json();
    if (typeof originalPrompt !== "string" || originalPrompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "originalPrompt required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (originalPrompt.length > 2000) {
      return new Response(JSON.stringify({ error: "originalPrompt too long" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeHistory: InboundMessage[] = Array.isArray(history)
      ? history.filter((m: unknown): m is InboundMessage =>
        !!m && typeof m === "object"
        && (("role" in m && (m as InboundMessage).role === "user")
          || (m as InboundMessage).role === "assistant")
        && typeof (m as InboundMessage).content === "string"
      ).slice(-10)
      : [];
    const safeBrand = typeof brandContext === "string" ? brandContext.slice(0, 8000) : "";

    // forceReady 快捷退出 — 直接返回一条 SSE 流，无需调用模型
    if (forceReady === true) {
      const lastUser = [...safeHistory].reverse().find((m) => m.role === "user")?.content;
      const stream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode(sseLine({ type: "text", delta: "好，那我就直接开始写了。" })));
          controller.enqueue(enc.encode(sseLine({ type: "text_done" })));
          controller.enqueue(enc.encode(sseLine({
            type: "meta",
            suggestions: [],
            ready: true,
            brief: {
              chosenAngle: lastUser || originalPrompt,
              matchedAssets: [],
              matchedRules: [],
              risks: [],
            },
          })));
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    // ── Step 1: 流式吐 reply 文字 ──
    const upstream = await startReplyStream(originalPrompt, safeHistory, safeBrand, apiKey);
    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text();
      console.error("Gemini reply stream error:", upstream.status, t);
      return new Response(JSON.stringify({ error: "AI 服务暂时不可用" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder();
        const dec = new TextDecoder();
        const reader = upstream.body!.getReader();
        let buf = "";
        let fullReply = "";

        try {
          // ── 解析 Gemini SSE，把每个 text part 转发为 {type:"text",delta} ──
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });

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
                  fullReply += text;
                  controller.enqueue(enc.encode(sseLine({ type: "text", delta: text })));
                }
              } catch { /* partial json — ignore */ }
            }
          }

          controller.enqueue(enc.encode(sseLine({ type: "text_done" })));

          // ── Step 2: 拿 meta（卡片 + ready） ──
          let meta: MetaPayload;
          try {
            meta = await callMeta(originalPrompt, safeHistory, fullReply, safeBrand, apiKey);
          } catch (e) {
            console.error("meta call failed, falling back:", e);
            // Fallback：第 3+ 轮直接 ready，否则给空卡片让用户自己输入
            const isLate = safeHistory.length >= 4;
            meta = {
              suggestions: [],
              ready: isLate,
              brief: isLate
                ? { chosenAngle: originalPrompt, matchedAssets: [], matchedRules: [], risks: [] }
                : undefined,
            };
          }

          controller.enqueue(enc.encode(sseLine({ type: "meta", ...meta })));
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("stream pipeline error:", err);
          try {
            controller.enqueue(enc.encode(sseLine({ type: "error", message: "对话流中断" })));
            controller.enqueue(enc.encode("data: [DONE]\n\n"));
          } catch { /* already closed */ }
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("creative-dialogue error:", e);
    if (e instanceof AuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (e instanceof Error && e.message.includes("Rate limit")) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
