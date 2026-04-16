import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildChatPrompt, buildGeneratePrompt } from "./prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const STREAM_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${key}`;

// Convert OpenAI-style messages to Gemini contents + systemInstruction
function toGemini(messages: Array<{ role: string; content: string }>, systemPrompt: string) {
  const contents = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
  };
}

// Re-emit Gemini SSE as OpenAI-style chunks so frontend doesn't need changes
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
            ?.map((p: { text?: string }) => p.text || "")
            .join("") || "";
          if (text) {
            const chunk = {
              choices: [{ delta: { content: text }, index: 0 }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        } catch {
          // ignore partial
        }
      }
    },
    cancel() { reader.cancel(); },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, platform, brandContext } = await req.json();
    const KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const systemPrompt = mode === "generate"
      ? buildGeneratePrompt(platform, brandContext)
      : buildChatPrompt(brandContext);

    const body = toGemini(messages, systemPrompt);

    const response = await fetch(STREAM_URL(KEY), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini error:", response.status, t);
      const status = response.status;
      const msg = status === 429 ? "请求过于频繁，请稍后再试"
        : (status === 401 || status === 403) ? "Google API Key 无效或已过期"
        : `AI 服务暂时不可用 (${status})`;
      return new Response(JSON.stringify({ error: msg }), {
        status: status === 429 ? 429 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(transformStream(response.body!), {
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
