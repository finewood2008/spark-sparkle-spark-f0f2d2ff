import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useMemoryStore } from '@/store/memoryStore';
import { SUPABASE_PUBLISHABLE_KEY, functionsUrl } from '@/lib/env';
import type {
  MemoryEntry,
  AnalysisResult,
  BrandProfile,
  SourceUrl,
} from '@/types/memory';

// ---------------------------------------------------------------------------
// NOTE: The `memories` table does not yet exist in the Supabase generated
// types (the migration will be applied separately). We cast the client to
// `any` for queries against this table. Once the types are regenerated the
// casts can be removed.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserId(): string | null {
  const { user, isAuthenticated } = useAuthStore.getState();
  return isAuthenticated && user?.id ? user.id : null;
}

/** Convert a Supabase row (snake_case) to our MemoryEntry (camelCase). */
function rowToEntry(row: Record<string, unknown>): MemoryEntry {
  return {
    id: row.id as string,
    layer: row.layer as MemoryEntry['layer'],
    category: row.category as MemoryEntry['category'],
    content: (row.content ?? {}) as Record<string, unknown>,
    source: row.source as MemoryEntry['source'],
    sourceUrl: (row.source_url as string) ?? undefined,
    confidence: (row.confidence as number) ?? 1,
    evidence: (row.evidence as string) ?? undefined,
    expiresAt: (row.expires_at as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Convert a MemoryEntry to a Supabase row for upsert. */
function entryToRow(entry: MemoryEntry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    layer: entry.layer,
    category: entry.category,
    content: entry.content,
    source: entry.source,
    source_url: entry.sourceUrl ?? null,
    confidence: entry.confidence,
    evidence: entry.evidence ?? null,
    expires_at: entry.expiresAt ?? null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

/** Returns true if the entry is a context-layer item that has expired. */
function isExpired(entry: MemoryEntry): boolean {
  if (entry.layer !== 'context') return false;
  if (!entry.expiresAt) return false;
  return new Date(entry.expiresAt).getTime() < Date.now();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMemoryV2() {
  const { isAuthenticated, user } = useAuthStore();
  const store = useMemoryStore;

  const loaded = useRef(false);
  const currentUserId = useRef<string | null>(null);
  const saving = useRef(false);

  // -----------------------------------------------------------------------
  // Load memories from Supabase → memoryStore
  // -----------------------------------------------------------------------
  const loadMemories = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      // Not logged in — clear store
      store.getState().setMemories([]);
      store.getState().setBrandProfile(null);
      store.getState().setSourceUrls([]);
      store.getState().setMemoryEnabled(false);
      return;
    }

    // --- load memory entries ---
    const { data: rows, error } = await db
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[useMemoryV2] failed to load memories:', error.message);
      return;
    }

    const allEntries: MemoryEntry[] = ((rows ?? []) as Record<string, unknown>[]).map(rowToEntry);

    // 7-day expiration: filter out expired context entries
    const validEntries = allEntries.filter((e) => !isExpired(e));

    // Clean up expired entries in DB (fire & forget)
    const expiredIds = allEntries.filter(isExpired).map((e) => e.id);
    if (expiredIds.length > 0) {
      db.from('memories').delete().in('id', expiredIds).then(() => {
        // silent
      });
    }

    store.getState().setMemories(validEntries);

    // --- extract brand profile from identity layer ---
    const profileEntry = validEntries.find(
      (e) => e.layer === 'identity' && e.category === 'brand_profile',
    );
    if (profileEntry) {
      const c = profileEntry.content as Record<string, unknown>;
      const bp: BrandProfile = {
        brandName: (c.brandName as string) ?? '',
        industry: (c.industry as string) ?? '',
        mainBusiness: (c.mainBusiness as string) ?? '',
        targetCustomer: (c.targetCustomer as string) ?? '',
        differentiation: (c.differentiation as string) ?? '',
        toneOfVoice: (c.toneOfVoice as string) ?? '',
        keywords: (c.keywords as string[]) ?? [],
        tabooWords: (c.tabooWords as string[]) ?? [],
        brandStory: (c.brandStory as string) ?? undefined,
        sourceUrls: (c.sourceUrls as string[]) ?? [],
        initialized: (c.initialized as boolean) ?? false,
      };
      store.getState().setBrandProfile(bp);

      // Auto-enable memory if brand is initialized
      if (bp.initialized) {
        store.getState().setMemoryEnabled(true);
      }

      // Populate sourceUrls state
      if (bp.sourceUrls.length > 0) {
        store.getState().setSourceUrls(
          bp.sourceUrls.map(
            (url): SourceUrl => ({
              url,
              status: 'done',
            }),
          ),
        );
      }
    } else {
      store.getState().setBrandProfile(null);
    }
  }, [store]);

  // -----------------------------------------------------------------------
  // Persist a single MemoryEntry to Supabase
  // -----------------------------------------------------------------------
  const persistEntry = useCallback(async (entry: MemoryEntry) => {
    const userId = getUserId();
    if (!userId) return;

    const row = entryToRow(entry, userId);
    const { error } = await db
      .from('memories')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.error('[useMemoryV2] persist failed:', error.message);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Persist all current memories (full sync)
  // -----------------------------------------------------------------------
  const persistAll = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    try {
      const userId = getUserId();
      if (!userId) return;

      const entries = store.getState().memories;
      if (entries.length === 0) return;

      const rows = entries.map((e) => entryToRow(e, userId));
      const { error } = await db
        .from('memories')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error('[useMemoryV2] persistAll failed:', error.message);
      }
    } finally {
      saving.current = false;
    }
  }, [store]);

  // -----------------------------------------------------------------------
  // analyzeUrls — call the analyze-sources Edge Function
  // -----------------------------------------------------------------------
  const analyzeUrls = useCallback(
    async (urls: string[]): Promise<AnalysisResult | null> => {
      const userId = getUserId();
      if (!userId) {
        console.warn('[useMemoryV2] analyzeUrls: not authenticated');
        return null;
      }

      store.getState().setIsAnalyzing(true);

      // Mark all given URLs as 'fetching'
      urls.forEach((url) => {
        store.getState().addSourceUrl({ url, status: 'fetching' });
      });

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken) {
          throw new Error('No access token available');
        }

        const response = await fetch(functionsUrl('analyze-sources'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ urls }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`analyze-sources failed (${response.status}): ${body}`);
        }

        const payload = (await response.json()) as {
          analysis?: AnalysisResult;
        };

        // Edge function returns { user_id, analysis, sources } with analysis already in camelCase
        const result: AnalysisResult = payload.analysis ?? {
          brandName: '',
          industry: '',
          mainBusiness: '',
          targetCustomer: '',
          differentiation: '',
          toneOfVoice: '',
          keywords: [],
          tabooWords: [],
          brandStory: '',
          writingPatterns: [],
        };

        // Update source URL statuses
        urls.forEach((url) => {
          store.getState().addSourceUrl({
            url,
            status: 'done',
            lastFetchedAt: new Date().toISOString(),
          });
        });

        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[useMemoryV2] analyzeUrls error:', message);

        // Mark URLs as error
        urls.forEach((url) => {
          store.getState().addSourceUrl({ url, status: 'error', error: message });
        });

        return null;
      } finally {
        store.getState().setIsAnalyzing(false);
      }
    },
    [store],
  );

  // -----------------------------------------------------------------------
  // saveAnalysisResult — write analysis into the memories table
  // -----------------------------------------------------------------------
  const saveAnalysisResult = useCallback(
    async (result: AnalysisResult) => {
      const userId = getUserId();
      if (!userId) return;

      const now = new Date().toISOString();
      const sourceUrls = store.getState().sourceUrls.map((s) => s.url);

      // 1. Create / update brand_profile identity entry
      const brandProfileEntry: MemoryEntry = {
        id: `${userId}_brand_profile`,
        layer: 'identity',
        category: 'brand_profile',
        content: {
          brandName: result.brandName,
          industry: result.industry,
          mainBusiness: result.mainBusiness,
          targetCustomer: result.targetCustomer,
          differentiation: result.differentiation,
          toneOfVoice: result.toneOfVoice,
          keywords: result.keywords,
          tabooWords: result.tabooWords,
          sourceUrls,
          initialized: true,
        },
        source: 'firecrawl',
        confidence: 0.8,
        createdAt: now,
        updatedAt: now,
      };

      // 2. Create brand_story identity entry if we have one
      const storyEntry: MemoryEntry | null = result.brandStory
        ? {
            id: `${userId}_brand_story`,
            layer: 'identity',
            category: 'brand_story',
            content: { brandStory: result.brandStory },
            source: 'firecrawl',
            confidence: 0.7,
            createdAt: now,
            updatedAt: now,
          }
        : null;

      // 3. Create preference entries for each writing pattern
      const patternEntries: MemoryEntry[] = result.writingPatterns.map(
        (pattern, idx): MemoryEntry => ({
          id: `${userId}_pattern_${idx}`,
          layer: 'preference',
          category: 'writing_style',
          content: {
            rule: pattern,
            evidence: `从分析 ${sourceUrls.join(', ')} 自动提取`,
            confirmed: false,
          },
          source: 'firecrawl',
          confidence: 0.6,
          createdAt: now,
          updatedAt: now,
        }),
      );

      const allEntries = [brandProfileEntry, ...(storyEntry ? [storyEntry] : []), ...patternEntries];

      // Persist to Supabase
      const rows = allEntries.map((e) => entryToRow(e, userId));
      const { error } = await db
        .from('memories')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error('[useMemoryV2] saveAnalysisResult failed:', error.message);
        return;
      }

      // Update local store
      const existing = store.getState().memories;
      const newIds = new Set(allEntries.map((e) => e.id));
      const merged = [...existing.filter((e) => !newIds.has(e.id)), ...allEntries];
      store.getState().setMemories(merged);

      // Update brand profile
      store.getState().setBrandProfile({
        brandName: result.brandName,
        industry: result.industry,
        mainBusiness: result.mainBusiness,
        targetCustomer: result.targetCustomer,
        differentiation: result.differentiation,
        toneOfVoice: result.toneOfVoice,
        keywords: result.keywords,
        tabooWords: result.tabooWords,
        brandStory: result.brandStory || undefined,
        sourceUrls,
        initialized: true,
      });

      store.getState().setMemoryEnabled(true);
    },
    [store],
  );

  // -----------------------------------------------------------------------
  // learnFromEdit — call the learn-from-edit Edge Function
  //   Extracts preference rules from the diff between AI-generated original
  //   and user-edited content. The Edge Function writes rules to the
  //   memories table (preference layer, confirmed=false). This is a
  //   background learning op — callers should treat it as fire-and-forget
  //   and never block the UI on its result.
  // -----------------------------------------------------------------------
  const learnFromEdit = useCallback(
    async (
      original: string,
      edited: string,
      contextTitle?: string,
    ): Promise<{ rule: string; category: string; confidence: number }[]> => {
      const userId = getUserId();
      if (!userId) return [];
      if (original === edited) return [];
      if (original.length < 10 || edited.length < 10) return [];

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken) return [];

        const response = await fetch(functionsUrl('learn-from-edit'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ original, edited, contextTitle }),
        });

        if (!response.ok) {
          const body = await response.text();
          console.warn(
            `[useMemoryV2] learn-from-edit failed (${response.status}):`,
            body,
          );
          return [];
        }

        const result = await response.json();
        const rules = (result.rules ?? []) as {
          rule: string;
          category: string;
          confidence: number;
        }[];

        if (rules.length > 0) {
          // Reload so the new preference rules show up in the memory panel
          await loadMemories();
        }

        return rules;
      } catch (err) {
        console.warn('[useMemoryV2] learnFromEdit error:', err);
        return [];
      }
    },
    [loadMemories],
  );

  // -----------------------------------------------------------------------
  // reloadMemories — public method to force a full reload
  // -----------------------------------------------------------------------
  const reloadMemories = useCallback(async () => {
    await loadMemories();
  }, [loadMemories]);

  // -----------------------------------------------------------------------
  // Lifecycle: initial load
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    loadMemories();
  }, [loadMemories]);

  // -----------------------------------------------------------------------
  // Lifecycle: reload when user changes (login/logout)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const userId = isAuthenticated ? (user?.id ?? null) : null;
    if (currentUserId.current === userId) return;
    // Skip first render — handled by initial load
    if (currentUserId.current === null && !loaded.current) {
      currentUserId.current = userId;
      return;
    }
    currentUserId.current = userId;
    loadMemories();
  }, [isAuthenticated, user?.id, loadMemories]);

  // -----------------------------------------------------------------------
  // Return public API
  // -----------------------------------------------------------------------
  return {
    analyzeUrls,
    saveAnalysisResult,
    reloadMemories,
    persistEntry,
    persistAll,
    learnFromEdit,
  };
}
