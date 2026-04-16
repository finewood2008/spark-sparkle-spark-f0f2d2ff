// Shared helpers for hashing and prefixing desktop ingest tokens.
// Tokens look like: spk_live_<24-char-base32-secret>
// We store ONLY a SHA-256 hash + first 8 chars (prefix) in DB; full token is shown to user once.

const TOKEN_NAMESPACE = 'spk_live';

export function generateDeviceToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  // base32-ish (alnum lower) for readability
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let secret = '';
  for (let i = 0; i < bytes.length; i++) {
    secret += alphabet[bytes[i] % alphabet.length];
  }
  return `${TOKEN_NAMESPACE}_${secret}`;
}

export function tokenPrefix(token: string): string {
  // Show e.g. "spk_live_ab" so user can recognize it in the table
  return token.slice(0, TOKEN_NAMESPACE.length + 3);
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
