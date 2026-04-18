import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const URL_REGEX = /^https?:\/\/.+/i;
const MAX_URLS = 10;

// ── Helpers ──────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Verify JWT via Supabase client and return the user id. */
async function getUserId(authHeader: string | null): Promise<string> {
  if (!authHeader) throw new Error("Missing Authorization header");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables not configured");
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Invalid or expired token");
  return user.id;
}

/** Scrape a single URL via Firecrawl. Returns markdown or null on failure. */
async function scrapeUrl(
  url: string,
  apiKey: string,
): Promise<{ url: string; markdown: string | null; error?: string }> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Firecrawl error for ${url}: ${res.status} ${text}`);
      return { url, markdown: null, error: `Firecrawl ${res.status}` };
    }

    const json = await res.json();
    const markdown = json?.data?.markdown;
    if (!markdown) {
      return { url, markdown: null, error: "No markdown in response" };
    }
    return { url, markdown };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Firecrawl fetch failed for ${url}: ${msg}`);
    return { url, markdown: null, error: msg };
  }
}

/** Call Gemini to analyse concatenated markdown and extract brand profile. */
async function analyseWithGemini(
  markdownContent: string,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const systemPrompt = `You are a brand analyst. Analyse the following web page content scraped from a brand's online presence.
Extract the brand profile and return ONLY valid JSON (no markdown fences) with exactly these fields:

{
  "brand_name": "string – the brand name",
  "industry": "string – the industry or sector",
  "main_business": "string – core products / services description",
  "target_customer": "string – who the brand targets",
  "differentiation": "string – unique selling points / competitive advantages",
  "tone_of_voice": "string – the brand's communication tone",
  "keywords": ["string array – key terms the brand uses frequently"],
  "taboo_words": ["string array – words or topics the brand avoids"],
  "brand_story": "string – condensed brand narrative",
  "writing_patterns": ["string array – noticeable writing style patterns, sentence structures, or rhetorical devices"]
}

If certain fields cannot be determined, use an empty string or empty array.
Respond ONLY with the JSON object, nothing else.`;

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
            {
              text: `Here is the scraped content from the brand's websites:\n\n${markdownContent}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
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

  // Strip possible markdown code fences
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse Gemini response as JSON:", cleaned);
    throw new Error("Gemini returned invalid JSON");
  }
}

// ── Main Handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────
    const userId = await getUserId(req.headers.get("Authorization"));

    // ── Input validation ─────────────────────────────────────────
    const body = await req.json();
    const { urls } = body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return jsonResponse({ error: "urls must be a non-empty array" }, 400);
    }
    if (urls.length > MAX_URLS) {
      return jsonResponse(
        { error: `Too many URLs. Maximum is ${MAX_URLS}` },
        400,
      );
    }

    const invalidUrls = urls.filter(
      (u: unknown) => typeof u !== "string" || !URL_REGEX.test(u),
    );
    if (invalidUrls.length > 0) {
      return jsonResponse(
        {
          error: "Invalid URL(s) detected. Each URL must start with http:// or https://",
          invalid: invalidUrls,
        },
        400,
      );
    }

    // ── API keys ─────────────────────────────────────────────────
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      throw new Error("FIRECRAWL_API_KEY is not configured");
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // ── Scrape URLs ──────────────────────────────────────────────
    const scrapeResults = await Promise.all(
      urls.map((u: string) => scrapeUrl(u, firecrawlKey)),
    );

    const succeeded = scrapeResults.filter((r) => r.markdown !== null);
    const failed = scrapeResults
      .filter((r) => r.markdown === null)
      .map((r) => ({ url: r.url, error: r.error }));

    if (succeeded.length === 0) {
      return jsonResponse(
        {
          error: "All URLs failed to scrape",
          failed,
        },
        422,
      );
    }

    // ── Gemini Analysis ──────────────────────────────────────────
    const combinedMarkdown = succeeded
      .map(
        (r, i) =>
          `--- Source ${i + 1}: ${r.url} ---\n\n${r.markdown}`,
      )
      .join("\n\n");

    // Truncate to ~120k chars to stay within Gemini context window
    const truncated = combinedMarkdown.slice(0, 120_000);

    const analysis = await analyseWithGemini(truncated, geminiKey);

    return jsonResponse({
      user_id: userId,
      analysis,
      sources: {
        total: urls.length,
        succeeded: succeeded.length,
        failed,
      },
    });
  } catch (e) {
    console.error("analyze-sources error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";

    const status =
      message.includes("Missing Authorization") ||
      message.includes("Invalid or expired")
        ? 401
        : 500;

    return jsonResponse({ error: message }, status);
  }
});
