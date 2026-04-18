import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AuthError,
  requireCronAuth,
} from "../_shared/auth.ts";

/**
 * execute-schedule — Server-side scheduled task executor
 *
 * Called by pg_cron every hour. Checks all enabled schedule_tasks configs,
 * determines if the current time matches a scheduled_time slot, and if so
 * generates content via Gemini and writes the result to review_items.
 *
 * This replaces the fragile client-side setInterval approach.
 */

const GEMINI_MODEL = "gemini-2.5-flash";

// ── Helpers ─────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function nowInTimezone(tz = "Asia/Shanghai"): Date {
  // Return a Date object that reflects the wall-clock in the given timezone
  const str = new Date().toLocaleString("en-US", { timeZone: tz });
  return new Date(str);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Check if current HH:MM matches any of the scheduled times */
function shouldRunNow(
  scheduledTimes: string[],
  daysOfWeek: number[],
  frequency: string,
  tz = "Asia/Shanghai",
): boolean {
  const now = nowInTimezone(tz);
  const currentTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const currentDay = now.getDay(); // 0=Sun, 1=Mon, ...

  // Check day-of-week filter
  if (frequency !== "daily" && !daysOfWeek.includes(currentDay)) {
    return false;
  }

  // Check if any scheduled time's hour matches current hour
  // We use hour-level matching since pg_cron runs hourly
  const currentHour = pad2(now.getHours());
  return scheduledTimes.some((t) => t.startsWith(currentHour));
}

// ── Gemini Article Generation ───────────────────────────────────────

interface Article {
  title: string;
  content: string;
  cta: string;
  tags: string[];
}

async function generateArticle(
  topic: string,
  platform: string,
  style: string,
  brandContext: string,
  geminiKey: string,
): Promise<Article> {
  const systemPrompt = brandContext
    ? `你是一个品牌内容创作助手。请基于以下品牌信息来创作内容：\n\n${brandContext}\n\n`
    : "你是一个品牌内容创作助手。";

  const userPrompt = `请为"${topic}"这个主题生成一篇${platform}平台的文章。${style ? `写作风格：${style}` : ""}

请返回 JSON 格式（不要 markdown 代码块），包含以下字段：
{
  "title": "文章标题",
  "content": "文章正文",
  "cta": "行动号召语",
  "tags": ["标签1", "标签2", "标签3"]
}`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");

  const parsed = JSON.parse(text);
  return {
    title: parsed.title || topic,
    content: parsed.content || "",
    cta: parsed.cta || "",
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}

// ── Brand Context Loader ────────────────────────────────────────────

/**
 * Build the same brand context that ChatLayout/SparkChat inject for chat+generate
 * mode. Mirrors src/store/memoryStore.ts buildIdentityContext + buildPreferenceContext:
 *   1. Prefer brand_profile.brandDoc (Markdown source of truth)
 *   2. Fall back to legacy structured identity fields when brandDoc is empty
 *   3. Append visual identity (colors / fonts) when present
 *   4. Append all preference rules (generate mode includes unconfirmed rules)
 */
async function loadBrandContext(
  admin: ReturnType<typeof createClient>,
  userId: string | null,
): Promise<string> {
  if (!userId) return "";

  try {
    const { data } = await admin
      .from("memories")
      .select("layer, category, content")
      .eq("user_id", userId)
      .in("layer", ["identity", "preference"]);

    if (!data || data.length === 0) return "";

    const sections: string[] = [];

    // ── Identity layer ──────────────────────────────────────────────
    const identity = data.filter((r: { layer: string }) => r.layer === "identity");
    const brandProfileRow = identity.find(
      (r: { category: string }) => r.category === "brand_profile",
    );
    const profileContent = (brandProfileRow?.content ?? {}) as Record<string, unknown>;
    const brandDoc = typeof profileContent.brandDoc === "string"
      ? (profileContent.brandDoc as string).trim()
      : "";

    const idParts: string[] = [];
    if (brandDoc.length > 0) {
      idParts.push(brandDoc);
    } else if (brandProfileRow) {
      // Legacy structured fallback
      const legacyLines: string[] = [];
      const push = (label: string, key: string) => {
        const v = profileContent[key];
        if (typeof v === "string" && v.trim()) legacyLines.push(`${label}: ${v.trim()}`);
      };
      push("品牌名", "brandName");
      push("行业", "industry");
      push("主营业务", "mainBusiness");
      push("目标客户", "targetCustomer");
      push("差异化", "differentiation");
      push("语气", "toneOfVoice");
      const kw = profileContent.keywords;
      if (Array.isArray(kw) && kw.length > 0) legacyLines.push(`关键词: ${kw.join("、")}`);
      const taboo = profileContent.tabooWords;
      if (Array.isArray(taboo) && taboo.length > 0) legacyLines.push(`禁用词: ${taboo.join("、")}`);
      if (legacyLines.length > 0) legacyLines.unshift("【品牌档案】"), idParts.push(legacyLines.join("\n"));
    }

    // Visual identity (colors / fonts) — useful even when brandDoc covers text
    const visual = profileContent.visualIdentity as Record<string, unknown> | undefined;
    if (visual && typeof visual === "object") {
      const visualLines: string[] = [];
      const colors = visual.colors as Record<string, string> | undefined;
      if (colors) {
        const colorPairs = Object.entries(colors)
          .filter(([, v]) => typeof v === "string" && v)
          .map(([k, v]) => `${k}=${v}`);
        if (colorPairs.length > 0) visualLines.push(`品牌色: ${colorPairs.join(", ")}`);
      }
      const fonts = visual.fonts;
      if (Array.isArray(fonts) && fonts.length > 0) {
        visualLines.push(`字体: ${fonts.join(", ")}`);
      }
      if (visualLines.length > 0) {
        idParts.push("【视觉识别】\n" + visualLines.join("\n"));
      }
    }

    // Extra identity entries beyond brand_profile (brand_story, visual_identity)
    const extraIdentity = identity.filter(
      (r: { category: string }) => r.category !== "brand_profile",
    );
    for (const row of extraIdentity) {
      const c = (row as { content: Record<string, unknown> }).content ?? {};
      const val = c.value ?? c.text ?? "";
      const text = typeof val === "string" ? val.trim() : JSON.stringify(val);
      if (text) idParts.push(`【${(row as { category: string }).category}】\n${text}`);
    }

    if (idParts.length > 0) sections.push(idParts.join("\n\n"));

    // ── Preference layer (generate mode: include all rules) ─────────
    const prefs = data.filter((r: { layer: string }) => r.layer === "preference");
    if (prefs.length > 0) {
      const prefLines = prefs
        .map((r: { content: Record<string, unknown> }) => {
          const rule = (r.content as { rule?: string })?.rule;
          return typeof rule === "string" && rule.trim() ? `• ${rule.trim()}` : null;
        })
        .filter((x): x is string => x !== null);
      if (prefLines.length > 0) {
        sections.push("【写作偏好】\n" + prefLines.join("\n"));
      }
    }

    return sections.join("\n\n");
  } catch {
    return "";
  }
}

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Only allow POST (from pg_cron http extension or manual trigger)
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Require cron/service authorization
  try {
    requireCronAuth(req);
  } catch (e) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY") ||
    Deno.env.get("GEMINI_API_KEY");

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Missing Supabase config" }, 500);
  }
  if (!geminiKey) {
    return jsonResponse({ error: "Missing GOOGLE_GEMINI_API_KEY" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // 1. Load all enabled schedule configs
  const { data: configs, error: cfgErr } = await admin
    .from("schedule_tasks")
    .select("*")
    .eq("kind", "config")
    .eq("enabled", true);

  if (cfgErr) {
    return jsonResponse({ error: cfgErr.message }, 500);
  }
  if (!configs || configs.length === 0) {
    return jsonResponse({ executed: 0, message: "No enabled schedules" });
  }

  const results: Array<{
    deviceId: string;
    topic: string;
    platform: string;
    status: string;
    error?: string;
  }> = [];

  for (const cfg of configs) {
    const scheduledTimes = (cfg.scheduled_times as string[]) || ["09:00"];
    const daysOfWeek = (cfg.days_of_week as number[]) || [1, 2, 3, 4, 5];
    const frequency = (cfg.frequency as string) || "daily";

    if (!shouldRunNow(scheduledTimes, daysOfWeek, frequency)) {
      continue; // Not this task's time
    }

    const topics = (cfg.topics as string[]) || [];
    const platforms = (cfg.platforms as string[]) || ["xiaohongshu"];
    const style = (cfg.style as string) || "";
    const postsPerDay = (cfg.posts_per_day as number) || 1;
    const deviceId = cfg.device_id as string;
    const userId = cfg.user_id as string | null;

    if (topics.length === 0) continue;

    // Load brand context for this user
    const brandContext = await loadBrandContext(admin, userId);

    // Generate content for each post slot
    for (let i = 0; i < Math.min(postsPerDay, 3); i++) {
      const topic = topics[Math.floor(Math.random() * topics.length)];
      const platform = platforms[Math.floor(Math.random() * platforms.length)];

      try {
        const article = await generateArticle(
          topic,
          platform,
          style,
          brandContext,
          geminiKey,
        );

        const contentId = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();

        // Write to review_items table
        const { error: reviewErr } = await admin.from("review_items").insert({
          id: contentId,
          title: article.title,
          content: article.content,
          cta: article.cta,
          tags: article.tags,
          platform,
          status: "reviewing",
          auto_generated: true,
          source: "schedule",
          task_name: `定时任务·${topic}`,
          topic,
          triggered_at: now,
          device_id: deviceId,
          user_id: userId,
          created_at: now,
          updated_at: now,
        });

        if (reviewErr) throw new Error(reviewErr.message);

        // Write execution log
        await admin.from("schedule_tasks").insert({
          device_id: deviceId,
          user_id: userId,
          kind: "log",
          log_topic: topic,
          log_platform: platform,
          log_status: "success",
          log_content_id: contentId,
          log_timestamp: now,
        });

        // Update last execution on the config row
        await admin
          .from("schedule_tasks")
          .update({
            log_status: "success",
            log_topic: topic,
            log_platform: platform,
            log_content_id: contentId,
            log_timestamp: now,
          })
          .eq("device_id", deviceId)
          .eq("kind", "config");

        results.push({ deviceId, topic, platform, status: "success" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        // Log the failure
        await admin.from("schedule_tasks").insert({
          device_id: deviceId,
          user_id: userId,
          kind: "log",
          log_topic: topic,
          log_platform: platform,
          log_status: "error",
          log_error: message,
          log_timestamp: new Date().toISOString(),
        });

        results.push({ deviceId, topic, platform, status: "error", error: message });
      }
    }
  }

  return jsonResponse({
    executed: results.length,
    results,
    checkedAt: new Date().toISOString(),
  });
});
