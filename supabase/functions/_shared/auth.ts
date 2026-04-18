// _shared/auth.ts — Security helpers for all Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── AuthError ────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

// ── CORS ─────────────────────────────────────────────────────────────

/**
 * Build CORS headers. Reads ALLOWED_ORIGIN env var, falls back to the
 * Supabase project domain. NEVER returns "*".
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const explicitOrigin = Deno.env.get("ALLOWED_ORIGIN");
  const origin = req.headers.get("origin") || "";

  let allowedOrigin: string;

  if (explicitOrigin) {
    // Support comma-separated list of allowed origins
    const allowedList = explicitOrigin.split(",").map((o) => o.trim());
    if (allowedList.includes(origin)) {
      allowedOrigin = origin;
    } else {
      allowedOrigin = allowedList[0]; // Default to first configured origin
    }
  } else {
    // Fall back to Supabase project URL-based domain
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const projectRef = supabaseUrl.match(
      /https:\/\/([^.]+)\.supabase\.co/,
    )?.[1];
    allowedOrigin = projectRef
      ? `https://${projectRef}.lovable.app`
      : "https://localhost:3000";
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

/** Return a 204 preflight response with CORS headers. */
export function optionsCors(req: Request): Response {
  return new Response(null, { status: 204, headers: getCorsHeaders(req) });
}

// ── User Authentication ──────────────────────────────────────────────

/**
 * Extract Bearer token from the request, verify it via
 * supabase.auth.getUser(), and return user.id.
 * Throws AuthError if missing/invalid.
 */
export async function requireUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new AuthError("Missing or malformed Authorization header");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AuthError("Server misconfiguration");
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new AuthError("Invalid or expired token");
  }
  return user.id;
}

// ── Cron / Service Authentication ────────────────────────────────────

/**
 * Check Bearer token against CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY.
 * Throws AuthError if invalid.
 */
export function requireCronAuth(req: Request): void {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw new AuthError("Missing Authorization header");
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (cronSecret && token === cronSecret) return;
  if (serviceRoleKey && token === serviceRoleKey) return;

  throw new AuthError("Invalid cron/service authorization");
}

// ── Payload Validation ───────────────────────────────────────────────

/**
 * Check Content-Length against maxBytes (default 100KB).
 * Throws if payload is too large.
 */
export function validatePayloadSize(
  req: Request,
  maxBytes = 102400,
): void {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new Error(`Payload too large (max ${maxBytes} bytes)`);
  }
}

// ── Rate Limiting ───────────────────────────────────────────────────

/**
 * Simple in-memory sliding-window rate limiter.
 * Works within a single Deno isolate — limits bursts from the same
 * IP or user during the isolate lifetime. Not a distributed rate limiter.
 *
 * Usage:
 *   checkRateLimit(req, { maxRequests: 30, windowSec: 60 });
 *
 * Throws Error("Rate limit exceeded") when over limit.
 */
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_CLEANUP_INTERVAL = 60_000; // 1 min
let lastCleanup = Date.now();

function cleanupStaleEntries(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < RATE_LIMIT_CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, timestamps] of rateLimitStore) {
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, filtered);
    }
  }
}

export function checkRateLimit(
  req: Request,
  opts: { maxRequests?: number; windowSec?: number; keyPrefix?: string } = {},
): void {
  const { maxRequests = 30, windowSec = 60, keyPrefix = "" } = opts;
  const windowMs = windowSec * 1000;

  // Identify client by IP (from Deno.serve / proxy headers)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  const key = `${keyPrefix}:${ip}`;

  cleanupStaleEntries(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (rateLimitStore.get(key) || []).filter((t) => t > cutoff);
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);

  if (timestamps.length > maxRequests) {
    throw new Error(
      `Rate limit exceeded (${maxRequests} requests per ${windowSec}s)`,
    );
  }
}
