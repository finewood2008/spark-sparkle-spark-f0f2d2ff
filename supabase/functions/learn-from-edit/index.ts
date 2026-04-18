import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_MODEL = "gemini-2.5-flash";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Verify JWT via Supabase client and return the user id.
 * Throws if missing/invalid — caller should surface a 401.
 */
async function getUserId(authHeader: string | null): Promise<string> {
  if (!authHeader) throw new Error("Missing Authorization header");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables not configured");
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error("Invalid or expired token");
  return user.id;
}

interface ExtractedRule {
  rule: string;
  category:
    | "writing_style"
    | "title_pattern"
    | "content_structure"
    | "tone_rule"
    | "topic_preference";
  confidence: number;
}

/**
 * Ask Gemini to diff `original` vs `edited` and extract 1-3 concrete,
 * reusable writing preferences. Returns [] on parse failure or no diff.
 */
async function extractRulesWithGemini(
  original: string,
  edited: string,
  apiKey: string,
): Promise<ExtractedRule[]> {
  const prompt = `你是一个品牌内容助手，负责从用户对 AI 生成内容的编辑中学习用户的写作偏好。

下面是 AI 生成的原文和用户编辑后的版本，对比两者找出 1-3 条具体、可复用的写作偏好规则。

【原文】
${original}

【用户编辑后】
${edited}

要求：
1. 规则要具体、可执行，比如"使用短段落"、"避免使用 emoji"、"标题用提问句式"、"开头用故事场景"
2. 只关注有明确编辑意图的差异，忽略细小的标点调整
3. category 必须是以下之一: writing_style / title_pattern / content_structure / tone_rule / topic_preference
4. confidence 0.3-0.9 之间，差异越明显置信度越高

只返回 JSON 数组，不要其他任何文字，格式：
[{"rule": "...", "category": "...", "confidence": 0.7}]

如果没有明显差异，返回空数组 []`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("") || "[]";

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r: unknown): r is ExtractedRule =>
          typeof r === "object" &&
          r !== null &&
          typeof (r as ExtractedRule).rule === "string" &&
          typeof (r as ExtractedRule).category === "string",
      )
      .slice(0, 3);
  } catch (err) {
    console.error("[learn-from-edit] JSON parse failed:", err, text);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const userId = await getUserId(req.headers.get("authorization"));

    const { original, edited, contextTitle } = await req.json();
    if (typeof original !== "string" || typeof edited !== "string") {
      return jsonResponse({ error: "original/edited must be strings" }, 400);
    }
    if (original === edited) return jsonResponse({ rules: [] });
    if (original.length < 10 || edited.length < 10) {
      return jsonResponse({ rules: [] });
    }

    const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY") ||
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("GOOGLE_API_KEY");
    if (!geminiKey) {
      return jsonResponse({ error: "GOOGLE_GEMINI_API_KEY not configured" }, 500);
    }

    const rules = await extractRulesWithGemini(original, edited, geminiKey);
    if (rules.length === 0) return jsonResponse({ rules: [] });

    // Persist rules to `memories` table (preference layer, confirmed=false).
    // We use the service-role key to bypass RLS — the user_id is already
    // authenticated above via the JWT, so we're not trusting client input.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Supabase service role key missing" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const now = new Date().toISOString();
    const evidence = contextTitle
      ? `从「${contextTitle}」的编辑中自动提取`
      : "从用户编辑中自动提取";

    const rows = rules.map((r, i) => ({
      id: `${userId}_edit_${Date.now()}_${i}`,
      user_id: userId,
      layer: "preference",
      category: r.category,
      content: {
        rule: r.rule,
        evidence,
        confirmed: false,
      },
      source: "auto_edit_learn",
      confidence: r.confidence,
      evidence,
      created_at: now,
      updated_at: now,
    }));

    const { error: insertError } = await admin.from("memories").insert(rows);
    if (insertError) {
      console.error("[learn-from-edit] insert failed:", insertError);
      return jsonResponse({ error: insertError.message, rules }, 500);
    }

    return jsonResponse({ rules, persisted: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[learn-from-edit] error:", message);
    const status = /Authorization|token/i.test(message) ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
