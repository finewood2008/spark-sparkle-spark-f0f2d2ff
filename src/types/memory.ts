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

export interface BrandProfile {
  brandName: string;
  industry: string;
  mainBusiness: string;
  targetCustomer: string;
  differentiation: string;
  toneOfVoice: string;
  keywords: string[];
  tabooWords: string[];
  brandStory?: string;
  sourceUrls: string[];
  initialized: boolean;
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

// Firecrawl 分析结果
export interface AnalysisResult {
  brandName: string;
  industry: string;
  mainBusiness: string;
  targetCustomer: string;
  differentiation: string;
  toneOfVoice: string;
  keywords: string[];
  tabooWords: string[];
  brandStory: string;
  writingPatterns: string[];
}
