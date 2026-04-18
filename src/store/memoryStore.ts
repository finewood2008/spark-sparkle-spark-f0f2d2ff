import { create } from 'zustand';
import type {
  MemoryEntry,
  BrandProfile,
  SourceUrl,
  PreferenceRule,
} from '../types/memory';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface MemoryState {
  // --- data ---
  memories: MemoryEntry[];
  brandProfile: BrandProfile | null;
  preferences: MemoryEntry[];
  sourceUrls: SourceUrl[];

  // --- flags ---
  isAnalyzing: boolean;
  memoryEnabled: boolean;

  // --- setters ---
  setMemories: (memories: MemoryEntry[]) => void;
  setBrandProfile: (bp: BrandProfile | null) => void;
  addPreference: (entry: MemoryEntry) => void;
  removePreference: (id: string) => void;
  confirmPreference: (id: string) => void;
  setSourceUrls: (urls: SourceUrl[]) => void;
  addSourceUrl: (url: SourceUrl) => void;
  removeSourceUrl: (url: string) => void;
  setIsAnalyzing: (v: boolean) => void;
  setMemoryEnabled: (v: boolean) => void;

  // --- derived context builders (callable, not selectors) ---
  getIdentityContext: () => string;
  getPreferenceContext: () => string;
  getFullContext: (mode: 'chat' | 'generate' | 'analyze') => string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildIdentityContext(bp: BrandProfile | null, memories: MemoryEntry[]): string {
  if (!bp || !bp.initialized) return '';

  const parts: string[] = ['【品牌档案】'];
  if (bp.brandName) parts.push(`品牌名: ${bp.brandName}`);
  if (bp.industry) parts.push(`行业: ${bp.industry}`);
  if (bp.mainBusiness) parts.push(`主营: ${bp.mainBusiness}`);
  if (bp.targetCustomer) parts.push(`目标客户: ${bp.targetCustomer}`);
  if (bp.differentiation) parts.push(`差异化: ${bp.differentiation}`);
  if (bp.toneOfVoice) parts.push(`语气风格: ${bp.toneOfVoice}`);
  if (bp.keywords.length) parts.push(`关键词: ${bp.keywords.join('、')}`);
  if (bp.tabooWords.length) parts.push(`禁用词: ${bp.tabooWords.join('、')}`);
  if (bp.brandStory) parts.push(`品牌故事: ${bp.brandStory}`);

  // Append any extra identity-layer memories (e.g. visual_identity)
  const extras = memories.filter(
    (m) => m.layer === 'identity' && m.category !== 'brand_profile',
  );
  extras.forEach((m) => {
    const desc = (m.content as Record<string, unknown>).description;
    if (desc) parts.push(`[${m.category}] ${desc}`);
  });

  return parts.join('\n');
}

function buildPreferenceContext(preferences: MemoryEntry[]): string {
  if (preferences.length === 0) return '';

  const parts: string[] = ['【用户偏好规则】'];
  preferences.forEach((p) => {
    const rule = p.content as unknown as PreferenceRule;
    const tag = rule.confirmed ? '✓' : '?';
    parts.push(`- [${tag}] ${rule.rule || JSON.stringify(p.content)}`);
  });
  return parts.join('\n');
}

function buildContextLayer(memories: MemoryEntry[]): string {
  const contextEntries = memories.filter((m) => m.layer === 'context');
  if (contextEntries.length === 0) return '';

  const parts: string[] = ['【会话/上下文】'];
  contextEntries.forEach((m) => {
    const summary = (m.content as Record<string, unknown>).summary;
    parts.push(`- [${m.category}] ${summary || JSON.stringify(m.content)}`);
  });
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMemoryStore = create<MemoryState>((set, get) => ({
  // --- initial state ---
  memories: [],
  brandProfile: null,
  preferences: [],
  sourceUrls: [],
  isAnalyzing: false,
  memoryEnabled: false,

  // --- setters ---
  setMemories: (memories) => {
    const preferences = memories.filter((m) => m.layer === 'preference');
    set({ memories, preferences });
  },

  setBrandProfile: (bp) => set({ brandProfile: bp }),

  addPreference: (entry) =>
    set((s) => {
      const updated = [...s.memories, entry];
      return {
        memories: updated,
        preferences: updated.filter((m) => m.layer === 'preference'),
      };
    }),

  removePreference: (id) =>
    set((s) => {
      const updated = s.memories.filter((m) => m.id !== id);
      return {
        memories: updated,
        preferences: updated.filter((m) => m.layer === 'preference'),
      };
    }),

  confirmPreference: (id) =>
    set((s) => {
      const updated = s.memories.map((m) => {
        if (m.id !== id) return m;
        const rule = m.content as unknown as PreferenceRule;
        return {
          ...m,
          content: { ...rule, confirmed: true } as unknown as Record<string, unknown>,
          updatedAt: new Date().toISOString(),
        };
      });
      return {
        memories: updated,
        preferences: updated.filter((m) => m.layer === 'preference'),
      };
    }),

  setSourceUrls: (urls) => set({ sourceUrls: urls }),

  addSourceUrl: (url) =>
    set((s) => ({
      sourceUrls: [...s.sourceUrls.filter((u) => u.url !== url.url), url],
    })),

  removeSourceUrl: (url) =>
    set((s) => ({
      sourceUrls: s.sourceUrls.filter((u) => u.url !== url),
    })),

  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setMemoryEnabled: (v) => set({ memoryEnabled: v }),

  // --- context builders ---
  getIdentityContext: () => {
    const { brandProfile, memories } = get();
    return buildIdentityContext(brandProfile, memories);
  },

  getPreferenceContext: () => {
    const { preferences } = get();
    return buildPreferenceContext(preferences);
  },

  /**
   * Build a context string tailored to the usage mode:
   *
   * - chat:     identity (full) + preference (confirmed only) + context (all)
   * - generate: identity (full) + preference (all) — no context to save tokens
   * - analyze:  identity (basic) only — minimal injection for analysis prompts
   */
  getFullContext: (mode: 'chat' | 'generate' | 'analyze') => {
    const { brandProfile, memories, preferences, memoryEnabled } = get();

    if (!memoryEnabled) return '';

    const sections: string[] = [];

    // --- identity layer ---
    if (mode === 'analyze') {
      // Minimal: just brand name + industry
      if (brandProfile?.initialized) {
        const brief: string[] = [];
        if (brandProfile.brandName) brief.push(`品牌: ${brandProfile.brandName}`);
        if (brandProfile.industry) brief.push(`行业: ${brandProfile.industry}`);
        sections.push(brief.join(' | '));
      }
    } else {
      const identity = buildIdentityContext(brandProfile, memories);
      if (identity) sections.push(identity);
    }

    // --- preference layer ---
    if (mode === 'chat') {
      // Only confirmed preferences for chat
      const confirmed = preferences.filter((p) => {
        const rule = p.content as unknown as PreferenceRule;
        return rule.confirmed;
      });
      if (confirmed.length > 0) {
        sections.push(buildPreferenceContext(confirmed));
      }
    } else if (mode === 'generate') {
      // All preferences for generation
      const prefCtx = buildPreferenceContext(preferences);
      if (prefCtx) sections.push(prefCtx);
    }
    // analyze mode: no preferences

    // --- context layer ---
    if (mode === 'chat') {
      const ctx = buildContextLayer(memories);
      if (ctx) sections.push(ctx);
    }
    // generate & analyze: no context layer

    return sections.join('\n\n');
  },
}));
