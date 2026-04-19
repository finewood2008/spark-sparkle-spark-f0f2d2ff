// title-conversation: generate a concise (<=16 char) Chinese title for a chat
// based on the first user message and the assistant's reply.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  checkRateLimit,
  getCorsHeaders,
  optionsCors,
  requireUser,
  validatePayloadSize,
} from "../_shared/auth.ts";

const SYSTEM_PROMPT = `你是一个对话标题生成器。根据用户的首条消息（以及可选的助手回复），生成一个**精炼**的对话标题。

规则：
- 中文优先，长度 4–14 个汉字（或 8–24 个英文字符）
- 不要出现引号、标点、emoji、"对话/聊天/关于" 等词
- 概括核心意图或主题，不要复述全文
- 只返回纯标题文本，不要任何解释或前缀`;

interface ReqBody {
  userMessage: string;
  assistantMessage?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsCors(req);
  const cors = getCorsHeaders(req);

  try {
    await requireUser(req);
    validatePayloadSize(req, 20_000);
    checkRateLimit(req, { maxRequests: 30, windowSec: 60, keyPrefix: "title" });

    const body = (await req.json()) as ReqBody;
    const userMsg = (body.userMessage || "").slice(0, 2000);
    const aiMsg = (body.assistantMessage || "").slice(0, 1000);
    if (!userMsg.trim()) {
      return new Response(JSON.stringify({ error: "userMessage required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const userContent =
      `用户消息：${userMsg}` +
      (aiMsg ? `\n\n助手回复（节选）：${aiMsg}` : "");

    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
        }),
      },
    );

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited" }),
          { status: 429, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      const t = await resp.text();
      console.error("title gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    let title: string =
      data?.choices?.[0]?.message?.content?.toString().trim() || "";
    // sanitize: strip quotes / punctuation / linebreaks, clamp length
    title = title
      .replace(/[\r\n]+/g, " ")
      .replace(/^["'《「『]+|["'》」』。.!?！？]+$/g, "")
      .trim();
    if (title.length > 16) title = title.slice(0, 16);
    if (!title) title = "新对话";

    return new Response(JSON.stringify({ title }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    console.error("title-conversation error", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
