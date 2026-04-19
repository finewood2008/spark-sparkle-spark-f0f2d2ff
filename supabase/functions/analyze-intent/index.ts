// analyze-intent — 火花生成前的"理解你"环节
// ────────────────────────────────────────────
// 输入：用户原话 + 已有的 v2 brand/preference context（前端拼好的字符串）
// 输出（结构化 JSON）：
//   - intentType: 'tutorial' | 'recommendation' | 'opinion' | 'story' | 'other'
//   - matchedAssets: string[]   品牌档案里和这个主题最相关的差异化点/案例/关键词
//   - matchedRules:  string[]   写作偏好里适用的规则
//   - risks:         string[]   触发禁用词/调性冲突等风险
//   - clarifyQuestion: { question, options[] } | null
//   - skipClarify: boolean      用户原话已足够明确则 true
//
// 模型：gemini-2.5-flash-lite（快、便宜，足够做这种轻量分析）
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

interface ClarifyOption {
  id: string;
  label: string;
  /** 用户选这个时，附加给生成 prompt 的 "角度提示" */
  anglePrompt: string;
}

interface AnalysisOutput {
  intentType: string;
  matchedAssets: string[];
  matchedRules: string[];
  risks: string[];
  clarifyQuestion: {
    question: string;
    options: ClarifyOption[];
  } | null;
  skipClarify: boolean;
}

const SYSTEM_PROMPT = `你是火花的"创作前分析助手"。在用户请求生成内容前，你需要：
1. 阅读用户的请求 + 他的品牌资料/写作偏好
2. 找出最相关的品牌资产（差异化点、案例、关键词、品牌故事片段）
3. 找出适用的写作偏好规则
4. 识别风险（禁用词、和品牌调性冲突、和过往内容重复）
5. 决定是否需要问用户一个澄清问题来对齐方向

判断 skipClarify 的标准（满足任一即跳过）：
- 用户原话超过 30 字且明确说明了角度（"从…切入"、"突出…"、"针对…读者"）
- 用户给了具体素材或案例
- 用户明确说"直接生成"、"快速"、"随便"

不需要跳过时，只问 1 个最关键的问题，提供 2-3 个选项。问题应该是真正影响成稿质量的（角度、目标读者、想突出的卖点），不要问废话。

如果用户的品牌资料是空的，matchedAssets 和 matchedRules 返回空数组，但仍可正常给出 clarifyQuestion。`;

async function analyzeWithGemini(
  userPrompt: string,
  brandContext: string,
  apiKey: string,
): Promise<AnalysisOutput> {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `【用户的创作请求】\n${userPrompt}\n\n【已有的品牌资料 / 偏好】\n${brandContext || "(暂无品牌资料)"}\n\n请分析后调用 analyze_intent 函数返回结果。`,
          },
        ],
      },
    ],
    tools: [
      {
        functionDeclarations: [
          {
            name: "analyze_intent",
            description: "返回创作前的结构化分析",
            parameters: {
              type: "object",
              properties: {
                intentType: {
                  type: "string",
                  enum: ["tutorial", "recommendation", "opinion", "story", "other"],
                  description: "用户想要的内容类型",
                },
                matchedAssets: {
                  type: "array",
                  items: { type: "string" },
                  description: "品牌资料中和这个主题最相关的 1-3 个点，每条简短一句。无品牌资料则返回 []",
                },
                matchedRules: {
                  type: "array",
                  items: { type: "string" },
                  description: "适用的写作偏好规则 1-3 条。无则返回 []",
                },
                risks: {
                  type: "array",
                  items: { type: "string" },
                  description: "触发禁用词/调性冲突等风险，无则 []",
                },
                clarifyQuestion: {
                  type: "object",
                  description: "需要澄清时给出，否则返回 null（用 skipClarify=true 表示）",
                  properties: {
                    question: { type: "string", description: "1-2 句话的问题" },
                    options: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          label: { type: "string", description: "选项展示文字，10 字内" },
                          anglePrompt: {
                            type: "string",
                            description: "用户选这个后，给生成 prompt 追加的角度指令，如「从客户案例切入，强调实际效果」",
                          },
                        },
                        required: ["id", "label", "anglePrompt"],
                      },
                      minItems: 2,
                      maxItems: 3,
                    },
                  },
                  required: ["question", "options"],
                },
                skipClarify: {
                  type: "boolean",
                  description: "true 表示用户原话已足够明确，不需要澄清",
                },
              },
              required: ["intentType", "matchedAssets", "matchedRules", "risks", "skipClarify"],
            },
          },
        ],
      },
    ],
    toolConfig: {
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: ["analyze_intent"],
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
    throw new Error(`Gemini analyze-intent error ${res.status}: ${t}`);
  }

  const json = await res.json();
  const call = json.candidates?.[0]?.content?.parts?.find(
    (p: { functionCall?: { args?: unknown } }) => p.functionCall,
  )?.functionCall;
  if (!call?.args) {
    // 回退：返回空分析 + 不澄清，让生成流程继续
    return {
      intentType: "other",
      matchedAssets: [],
      matchedRules: [],
      risks: [],
      clarifyQuestion: null,
      skipClarify: true,
    };
  }
  const args = call.args as Partial<AnalysisOutput>;
  return {
    intentType: typeof args.intentType === "string" ? args.intentType : "other",
    matchedAssets: Array.isArray(args.matchedAssets) ? args.matchedAssets.slice(0, 3) : [],
    matchedRules: Array.isArray(args.matchedRules) ? args.matchedRules.slice(0, 3) : [],
    risks: Array.isArray(args.risks) ? args.risks.slice(0, 3) : [],
    clarifyQuestion: args.skipClarify ? null : (args.clarifyQuestion ?? null),
    skipClarify: !!args.skipClarify,
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return optionsCors(req);

  try {
    await requireUser(req);
    validatePayloadSize(req);
    checkRateLimit(req, { maxRequests: 30, windowSec: 60, keyPrefix: "analyze-intent" });

    const { userPrompt, brandContext } = await req.json();
    if (typeof userPrompt !== "string" || userPrompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "userPrompt required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (userPrompt.length > 2000) {
      return new Response(JSON.stringify({ error: "userPrompt too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const analysis = await analyzeWithGemini(
      userPrompt,
      typeof brandContext === "string" ? brandContext.slice(0, 8000) : "",
      KEY,
    );

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-intent error:", e);
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
