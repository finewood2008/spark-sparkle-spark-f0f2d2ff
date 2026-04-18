import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AuthError,
  getCorsHeaders,
  optionsCors,
  requireUser,
  validatePayloadSize,
} from "../_shared/auth.ts";

const URL_REGEX = /^https?:\/\/.+/i;
const MAX_URLS = 10;

// ── Helpers ──────────────────────────────────────────────────────────

function jsonResponse(body: unknown, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ScrapeOutput {
  url: string;
  markdown: string | null;
  branding: Record<string, unknown> | null;
  error?: string;
}

/** Scrape a single URL via Firecrawl with markdown + branding. */
async function scrapeUrl(url: string, apiKey: string): Promise<ScrapeOutput> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "branding"],
        onlyMainContent: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Firecrawl error for ${url}: ${res.status} ${text}`);
      return { url, markdown: null, branding: null, error: `Firecrawl ${res.status}` };
    }

    const json = await res.json();
    const data = json?.data ?? {};
    const markdown = data.markdown ?? null;
    const branding = data.branding ?? null;
    if (!markdown && !branding) {
      return { url, markdown: null, branding: null, error: "Empty Firecrawl response" };
    }
    return { url, markdown, branding };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Firecrawl fetch failed for ${url}: ${msg}`);
    return { url, markdown: null, branding: null, error: msg };
  }
}

/** Ask Gemini to write a polished Markdown brand doc + writing patterns. */
async function analyseWithGemini(
  markdownContent: string,
  apiKey: string,
): Promise<{ brandDoc: string; writingPatterns: string[] }> {
  const systemPrompt = `You are a brand strategist. From the scraped web content below, write a structured Markdown brand profile that an AI copywriter can use as context.

OUTPUT FORMAT — return ONLY valid JSON (no fences) with exactly these two fields:
{
  "brandDoc": "string — Markdown document, see template below",
  "writingPatterns": ["string array — concrete writing-style rules observed (3-8 items)"]
}

brandDoc Markdown template (fill in, keep section headers exactly):
# {Brand Name}

## 一句话定位 / Positioning
{one-line tagline}

## 主营业务 / Main Business
{products / services}

## 目标客户 / Target Customer
{who they serve}

## 差异化价值 / Differentiation
{why choose them}

## 语气风格 / Tone of Voice
{communication tone}

## 品牌关键词 / Keywords
- keyword1
- keyword2

## 禁用词 / Words to Avoid
- word1 (or "无" if none)

## 品牌故事 / Brand Story
{condensed narrative, 2-4 sentences}

LANGUAGE RULE (critical):
- Detect the dominant natural language of the scraped content.
- Write the entire brandDoc body in that same language (Chinese if content is mostly 中文, English if mostly English).
- Section headers stay bilingual exactly as shown above.
- writingPatterns array items follow the same language as the body.

If a section has no info, write "未提供" (Chinese) or "Not provided" (English) — never leave blank.
Respond ONLY with the JSON object.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: `Scraped content:\n\n${markdownContent}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Gemini error:", res.status, text);
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const json = await res.json();
  const rawText =
    json?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || "")
      .join("") || "";

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      brandDoc: typeof parsed.brandDoc === "string" ? parsed.brandDoc : "",
      writingPatterns: Array.isArray(parsed.writingPatterns)
        ? parsed.writingPatterns.filter((x: unknown): x is string => typeof x === "string")
        : [],
    };
  } catch {
    console.error("Failed to parse Gemini response, using raw text as brandDoc:", cleaned.slice(0, 200));
    return { brandDoc: cleaned, writingPatterns: [] };
  }
}

/** Merge branding payloads from multiple sources — first non-empty wins per field. */
function mergeBranding(brandings: Array<Record<string, unknown> | null>): {
  logo?: string;
  favicon?: string;
  ogImage?: string;
  colors?: Record<string, string>;
  fonts?: string[];
} {
  const result: {
    logo?: string;
    favicon?: string;
    ogImage?: string;
    colors?: Record<string, string>;
    fonts?: string[];
  } = {};

  for (const b of brandings) {
    if (!b) continue;
    const images = (b.images as Record<string, unknown> | undefined) ?? {};
    const colors = (b.colors as Record<string, unknown> | undefined) ?? {};
    const fonts = b.fonts as Array<{ family?: string }> | undefined;

    if (!result.logo) {
      const logo = (images.logo as string) || (b.logo as string);
      if (typeof logo === "string" && logo) result.logo = logo;
    }
    if (!result.favicon) {
      const fav = images.favicon as string | undefined;
      if (typeof fav === "string" && fav) result.favicon = fav;
    }
    if (!result.ogImage) {
      const og = images.ogImage as string | undefined;
      if (typeof og === "string" && og) result.ogImage = og;
    }
    if (!result.colors) {
      const c: Record<string, string> = {};
      for (const k of [
        "primary",
        "secondary",
        "accent",
        "background",
        "textPrimary",
        "textSecondary",
      ]) {
        const v = colors[k];
        if (typeof v === "string" && v) c[k] = v;
      }
      if (Object.keys(c).length > 0) result.colors = c;
    }
    if (!result.fonts && Array.isArray(fonts)) {
      const list = fonts
        .map((f) => f?.family)
        .filter((x): x is string => typeof x === "string" && x.length > 0);
      if (list.length > 0) result.fonts = Array.from(new Set(list));
    }
  }

  return result;
}

// ── Main Handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return optionsCors(req);
  }

  try {
    const userId = await requireUser(req);
    validatePayloadSize(req);

    const body = await req.json();
    const { urls } = body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return jsonResponse({ error: "urls must be a non-empty array" }, corsHeaders, 400);
    }
    if (urls.length > MAX_URLS) {
      return jsonResponse(
        { error: `Too many URLs. Maximum is ${MAX_URLS}` },
        corsHeaders,
        400,
      );
    }

    const invalidUrls = urls.filter(
      (u: unknown) => typeof u !== "string" || !URL_REGEX.test(u),
    );
    if (invalidUrls.length > 0) {
      return jsonResponse(
        {
          error: "Invalid URL(s). Each URL must start with http:// or https://",
          invalid: invalidUrls,
        },
        corsHeaders,
        400,
      );
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY is not configured");

    const geminiKey =
      Deno.env.get("GOOGLE_GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const scrapeResults = await Promise.all(
      urls.map((u: string) => scrapeUrl(u, firecrawlKey)),
    );

    const succeeded = scrapeResults.filter((r) => r.markdown !== null);
    const failed = scrapeResults
      .filter((r) => r.markdown === null)
      .map((r) => ({ url: r.url, error: r.error }));

    if (succeeded.length === 0) {
      return jsonResponse({ error: "All URLs failed to scrape", failed }, corsHeaders, 422);
    }

    const combinedMarkdown = succeeded
      .map((r, i) => `--- Source ${i + 1}: ${r.url} ---\n\n${r.markdown}`)
      .join("\n\n");

    const truncated = combinedMarkdown.slice(0, 120_000);

    const ai = await analyseWithGemini(truncated, geminiKey);
    const visualIdentity = mergeBranding(scrapeResults.map((r) => r.branding));

    const analysis = {
      brandDoc: ai.brandDoc,
      visualIdentity,
      writingPatterns: ai.writingPatterns,
    };

    return jsonResponse({
      user_id: userId,
      analysis,
      sources: {
        total: urls.length,
        succeeded: succeeded.length,
        failed,
      },
    }, corsHeaders);
  } catch (e) {
    console.error("analyze-sources error:", e);
    if (e instanceof AuthError) {
      return jsonResponse({ error: e.message }, corsHeaders, 401);
    }
    return jsonResponse({ error: "Internal server error" }, corsHeaders, 500);
  }
});
