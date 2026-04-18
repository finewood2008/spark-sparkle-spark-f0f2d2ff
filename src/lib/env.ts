// Centralized env access for Supabase URL / publishable key.
// All client-side code should import from here instead of reading
// `import.meta.env.VITE_SUPABASE_*` directly, so we never end up
// with `undefined/functions/v1/...` calls in published builds when
// Vite env replacement fails or values aren't injected.

const FALLBACK_SUPABASE_URL = 'https://rbrsjjxtpyjmmjbidtyp.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicnNqanh0cHlqbW1qYmlkdHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDY1MzUsImV4cCI6MjA5MTc4MjUzNX0.lvVTfqgtzu0JbVwji5cTZZUP97uJ1pDkcUhBbWed1cc';

function readProcessEnv(key: string): string | undefined {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL ||
  readProcessEnv('SUPABASE_URL') ||
  FALLBACK_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  readProcessEnv('SUPABASE_PUBLISHABLE_KEY') ||
  FALLBACK_SUPABASE_PUBLISHABLE_KEY;

// Convenience helper for building edge function URLs.
export function functionsUrl(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}
