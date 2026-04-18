import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Identity
    const identity = data.filter((r: { layer: string }) => r.layer === "identity");
    if (identity.length > 0) {
      const idLines = identity.map((r: { category: string; content: Record<string, unknown> }) => {
        const val = r.content?.value ?? r.content?.values ?? "";
        return `${r.category}: ${typeof val === "string" ? val : JSON.stringify(val)}`;
      });
      sections.push("【品牌身份】\n" + idLines.join("\n"));
    }

    // Preferences
    const prefs = data.filter((r: { layer: string }) => r.layer === "preference");
    if (prefs.length > 0) {
      const prefLines = prefs.map((r: { content: Record<string, unknown> }) => {
        return `• ${(r.content as { rule?: string })?.rule ?? JSON.stringify(r.content)}`;
      });
      sections.push("【写作偏好】\n" + prefLines.join("\n"));
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

  // Optional: accept a secret token for auth
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
