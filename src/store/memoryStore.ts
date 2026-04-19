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
  /** All brand profiles owned by the current user. */
  brandProfiles: BrandProfile[];
  /** The currently active brand profile (derived from brandProfiles). */
  brandProfile: BrandProfile | null;
  preferences: MemoryEntry[];
  sourceUrls: SourceUrl[];

  // --- flags ---
  isAnalyzing: boolean;
  memoryEnabled: boolean;

  // --- setters ---
  setMemories: (memories: MemoryEntry[]) => void;
  setBrandProfiles: (profiles: BrandProfile[]) => void;
  /** Locally mark one profile id as active (UI optimistic update). */
  setActiveBrandProfileLocal: (id: string) => void;
  /** Remove a profile from local state. */
  removeBrandProfileLocal: (id: string) => void;
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

  const parts: string[] = [];

  if (bp.brandDoc && bp.brandDoc.trim().length > 0) {
    parts.push('【品牌档案】');
    parts.push(bp.brandDoc.trim());
  } else {
    // Legacy fallback for old saved profiles
    parts.push('【品牌档案】');
    if (bp.brandName) parts.push(`品牌名: ${bp.brandName}`);
    if (bp.industry) parts.push(`行业: ${bp.industry}`);
    if (bp.mainBusiness) parts.push(`主营: ${bp.mainBusiness}`);
    if (bp.targetCustomer) parts.push(`目标客户: ${bp.targetCustomer}`);
    if (bp.differentiation) parts.push(`差异化: ${bp.differentiation}`);
    if (bp.toneOfVoice) parts.push(`语气风格: ${bp.toneOfVoice}`);
    if (bp.keywords?.length) parts.push(`关键词: ${bp.keywords.join('、')}`);
    if (bp.tabooWords?.length) parts.push(`禁用词: ${bp.tabooWords.join('、')}`);
    if (bp.brandStory) parts.push(`品牌故事: ${bp.brandStory}`);
  }

  // Append visual identity if present
  const vi = bp.visualIdentity;
  if (vi && (vi.colors || vi.fonts?.length)) {
    const visParts: string[] = ['【视觉识别】'];
    if (vi.colors?.primary) visParts.push(`主色: ${vi.colors.primary}`);
    if (vi.fonts?.length) visParts.push(`字体: ${vi.fonts.join(', ')}`);
    parts.push(visParts.join('\n'));
  }

  // Append any extra identity-layer memories
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

  const parts: string[] = ['【会话/上下文】（仅最近，可作为参考，避免重复角度）'];
  // Sort newest first so the model sees the most relevant sessions
  const sorted = [...contextEntries].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  sorted.slice(0, 6).forEach((m) => {
    const c = m.content as Record<string, unknown>;
    if (m.category === 'session_summary') {
      // Rich render: "主题 X → 角度 Y | 用到 a, b"
      const topic = (c.topic as string) ?? '';
      const angle = (c.chosenAngle as string) ?? '';
      const assets = Array.isArray(c.matchedAssets) ? (c.matchedAssets as string[]).join('、') : '';
      const assetsTail = assets ? ` | 用到 ${assets}` : '';
      parts.push(`- 上次写过：${topic} → ${angle}${assetsTail}`);
    } else {
      const summary = c.summary;
      parts.push(`- [${m.category}] ${summary || JSON.stringify(c)}`);
    }
  });
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

function pickActive(profiles: BrandProfile[]): BrandProfile | null {
  if (profiles.length === 0) return null;
  return profiles.find((p) => p.isActive) ?? profiles[0] ?? null;
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  // --- initial state ---
  memories: [],
  brandProfiles: [],
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

  setBrandProfiles: (profiles) =>
    set({
      brandProfiles: profiles,
      brandProfile: pickActive(profiles),
    }),

  setActiveBrandProfileLocal: (id) =>
    set((s) => {
      const updated = s.brandProfiles.map((p) => ({ ...p, isActive: p.id === id }));
      return {
        brandProfiles: updated,
        brandProfile: pickActive(updated),
      };
    }),

  removeBrandProfileLocal: (id) =>
    set((s) => {
      const updated = s.brandProfiles.filter((p) => p.id !== id);
      const hadActive = updated.some((p) => p.isActive);
      const finalList =
        !hadActive && updated.length > 0
          ? updated.map((p, idx) => ({ ...p, isActive: idx === 0 }))
          : updated;
      return {
        brandProfiles: finalList,
        brandProfile: pickActive(finalList),
      };
    }),

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
    // chat mode: full session context
    // analyze mode: also include context (so creative-dialogue can recall
    //   past creation sessions — chosen angles, used assets — and reuse them
    //   on similar topics, making spark feel like it remembers)
    if (mode === 'chat' || mode === 'analyze') {
      const ctx = buildContextLayer(memories);
      if (ctx) sections.push(ctx);
    }
    // generate: no context layer (the brief carries everything needed)

    return sections.join('\n\n');
  },
}));
