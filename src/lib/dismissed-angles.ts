/**
 * Persist user-dismissed angle suggestions in localStorage so the same
 * direction does not get re-suggested for similar topics.
 *
 * Strategy: bucket dismissals by a "topic fingerprint" derived from the
 * article's tags (sorted, lowercased, joined). When tags overlap (any
 * shared tag), we treat the topics as similar and apply the dismissal.
 *
 * Each bucket stores a Set of normalized angle labels (trimmed, lowercased,
 * punctuation stripped) — robust against minor wording differences from
 * the LLM across calls.
 */

const STORAGE_KEY = 'spark.dismissedAngles.v1';
const NO_TAG_BUCKET = '__no_tag__';
const MAX_PER_BUCKET = 40;

type Store = Record<string, string[]>;

function readStore(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

function normalizeLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/** Buckets relevant to these tags: per-tag bucket + the no-tag fallback. */
function bucketsFor(tags: string[] | undefined): string[] {
  const list = (tags || [])
    .map(normalizeTag)
    .filter(Boolean);
  if (list.length === 0) return [NO_TAG_BUCKET];
  return list;
}

export function isAngleDismissed(label: string, tags?: string[]): boolean {
  const store = readStore();
  const norm = normalizeLabel(label);
  if (!norm) return false;
  for (const b of bucketsFor(tags)) {
    if (store[b]?.includes(norm)) return true;
  }
  // Also check the no-tag fallback bucket (catch-all dismissals)
  if (store[NO_TAG_BUCKET]?.includes(norm)) return true;
  return false;
}

export function dismissAngle(label: string, tags?: string[]) {
  const store = readStore();
  const norm = normalizeLabel(label);
  if (!norm) return;
  for (const b of bucketsFor(tags)) {
    const list = store[b] ? [...store[b]] : [];
    if (!list.includes(norm)) {
      list.push(norm);
      // Cap bucket size, drop oldest
      if (list.length > MAX_PER_BUCKET) list.splice(0, list.length - MAX_PER_BUCKET);
      store[b] = list;
    }
  }
  writeStore(store);
}

export function filterDismissedAngles<T extends { label: string }>(
  angles: T[],
  tags?: string[],
): T[] {
  return angles.filter(a => !isAngleDismissed(a.label, tags));
}
