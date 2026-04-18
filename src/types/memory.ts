// Memory System v2 — Type Definitions
// This replaces the old BrandMemory + LearningEntry types with a unified
// layered memory model: identity → preference → context.

export type MemoryLayer = 'identity' | 'preference' | 'context';

export type IdentityCategory = 'brand_profile' | 'brand_story' | 'visual_identity';

export type PreferenceCategory =
  | 'writing_style'
  | 'title_pattern'
  | 'content_structure'
  | 'tone_rule'
  | 'topic_preference'
  | 'performance_insight';

export type ContextCategory = 'recent_content' | 'active_schedule' | 'session_summary';

export type MemoryCategory = IdentityCategory | PreferenceCategory | ContextCategory;

export type MemorySource =
  | 'manual'
  | 'firecrawl'
  | 'auto_edit_learn'
  | 'auto_performance_learn'
  | 'chat_extract';

export interface MemoryEntry {
  id: string;
  layer: MemoryLayer;
  category: MemoryCategory;
  content: Record<string, unknown>;
  source: MemorySource;
  sourceUrl?: string;
  confidence: number;
  evidence?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VisualIdentity {
  logo?: string;
  favicon?: string;
  ogImage?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    textPrimary?: string;
    textSecondary?: string;
  };
  fonts?: string[]; // font family names
}

export interface BrandProfile {
  /** AI-generated, user-editable Markdown describing the whole brand. Source of truth for prompt injection. */
  brandDoc: string;
  /** Logo / colors / fonts, populated from Firecrawl branding format. URLs only — no upload. */
  visualIdentity: VisualIdentity;
  sourceUrls: string[];
  initialized: boolean;

  // Legacy structured fields kept for backwards-compat with old saved profiles.
  // New code should rely on `brandDoc`. These will be empty for fresh analyses.
  brandName?: string;
  industry?: string;
  mainBusiness?: string;
  targetCustomer?: string;
  differentiation?: string;
  toneOfVoice?: string;
  keywords?: string[];
  tabooWords?: string[];
  brandStory?: string;
}

export interface PreferenceRule {
  rule: string;
  evidence: string;
  confirmed: boolean; // 用户确认过
}

export interface SourceUrl {
  url: string;
  lastFetchedAt?: string;
  status: 'pending' | 'fetching' | 'done' | 'error';
  error?: string;
}

// Firecrawl 分析结果 — v2 returns a single Markdown brand doc + visual identity.
export interface AnalysisResult {
  /** Markdown describing the brand (sections: 品牌概述/主营/客户/差异化/语气/关键词/禁用词/品牌故事). */
  brandDoc: string;
  /** Logo / colors / fonts — URLs and values, no file upload. */
  visualIdentity: VisualIdentity;
  /** Writing-style preference rules extracted from the content. */
  writingPatterns: string[];
}
