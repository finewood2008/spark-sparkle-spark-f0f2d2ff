import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { getUserPrefsContext, syncPrefsFromCloud } from '@/lib/user-prefs';
import { loadReviewItemsIntoStore } from '@/lib/review-persistence';
import type { BrandMemory, LearningEntry } from '@/types/spark';

const DEVICE_ID = 'default';

function getIdentifier() {
  const { user, isAuthenticated } = useAuthStore.getState();
  if (isAuthenticated && user?.id) {
    return { column: 'user_id' as const, value: user.id };
  }
  return { column: 'device_id' as const, value: DEVICE_ID };
}

export function useMemorySync() {
  const { brand, setBrand, learnings, setLearnings } = useAppStore();
  const { isAuthenticated, user } = useAuthStore();
  const loaded = useRef(false);
  const savingBrand = useRef(false);
  const savingLearnings = useRef(false);
  const currentUserId = useRef<string | null>(null);

  // Load brand & learnings data
  const loadData = useCallback(async () => {
    const id = getIdentifier();

    // Load brand
    const { data: brandRow } = await supabase
      .from('brand_memories')
      .select('*')
      .eq(id.column, id.value)
      .maybeSingle();

    if (brandRow) {
      setBrand({
        name: brandRow.name,
        industry: brandRow.industry,
        mainBusiness: brandRow.main_business,
        targetCustomer: brandRow.target_customer,
        differentiation: brandRow.differentiation,
        toneOfVoice: brandRow.tone_of_voice,
        keywords: brandRow.keywords || [],
        tabooWords: brandRow.taboo_words || [],
        initialized: brandRow.initialized,
        initStep: brandRow.init_step,
        createdAt: brandRow.created_at,
        updatedAt: brandRow.updated_at,
      });
      // Auto-enable brand memory if data is initialized
      if (brandRow.initialized) {
        useAppStore.getState().setBrandMemoryEnabled(true);
      }
    } else {
      setBrand(null as unknown as BrandMemory);
    }

    // Load learnings
    const { data: learningRows } = await supabase
      .from('learning_entries')
      .select('*')
      .eq(id.column, id.value)
      .order('created_at', { ascending: true });

    if (learningRows && learningRows.length > 0) {
      setLearnings(learningRows.map(r => ({
        id: r.id,
        type: r.type as LearningEntry['type'],
        category: r.category,
        insight: r.insight,
        evidence: r.evidence,
        confidence: r.confidence,
        timestamp: r.created_at,
      })));
    } else {
      setLearnings([]);
    }
  }, [setBrand, setLearnings]);

  // Initial load
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    loadData();
    loadReviewItemsIntoStore();
  }, [loadData]);

  // Reload when user changes (login/logout)
  useEffect(() => {
    const userId = isAuthenticated ? (user?.id || null) : null;
    if (currentUserId.current === userId) return;
    // Skip first render (handled by initial load)
    if (currentUserId.current === null && !loaded.current) {
      currentUserId.current = userId;
      return;
    }
    currentUserId.current = userId;
    loadData();
    loadReviewItemsIntoStore();
    // Also sync user preferences from cloud
    syncPrefsFromCloud();
  }, [isAuthenticated, user?.id, loadData]);

  // Save brand when it changes
  const saveBrand = useCallback(async (b: BrandMemory) => {
    if (savingBrand.current) return;
    savingBrand.current = true;
    try {
      const id = getIdentifier();
      const baseRow = {
        device_id: DEVICE_ID,
        name: b.name,
        industry: b.industry,
        main_business: b.mainBusiness,
        target_customer: b.targetCustomer,
        differentiation: b.differentiation,
        tone_of_voice: b.toneOfVoice,
        keywords: b.keywords,
        taboo_words: b.tabooWords,
        initialized: b.initialized,
        init_step: b.initStep,
        updated_at: new Date().toISOString(),
        user_id: id.column === 'user_id' ? id.value : undefined,
      };

      if (id.column === 'user_id') {
        const { data: existing } = await supabase
          .from('brand_memories')
          .select('id')
          .eq('user_id', id.value)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('brand_memories')
            .update(baseRow)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('brand_memories')
            .insert(baseRow);
        }
      } else {
        await supabase
          .from('brand_memories')
          .upsert(baseRow, { onConflict: 'device_id' });
      }
    } finally {
      savingBrand.current = false;
    }
  }, []);

  // Save learnings when they change
  const saveLearnings = useCallback(async (entries: LearningEntry[]) => {
    if (savingLearnings.current) return;
    savingLearnings.current = true;
    try {
      const id = getIdentifier();
      // Delete all existing for this user/device
      await supabase.from('learning_entries').delete().eq(id.column, id.value);
      if (entries.length > 0) {
        await supabase.from('learning_entries').insert(
          entries.map(e => ({
            id: e.id,
            device_id: DEVICE_ID,
            ...(id.column === 'user_id' ? { user_id: id.value } : {}),
            type: e.type,
            category: e.category,
            insight: e.insight,
            evidence: e.evidence,
            confidence: e.confidence,
            created_at: e.timestamp,
          }))
        );
      }
    } finally {
      savingLearnings.current = false;
    }
  }, []);

  // Watch for changes and persist
  useEffect(() => {
    if (!loaded.current) return;
    if (brand) saveBrand(brand);
  }, [brand, saveBrand]);

  useEffect(() => {
    if (!loaded.current) return;
    saveLearnings(learnings);
  }, [learnings, saveLearnings]);

  // Build full brand context string for AI injection
  const getFullContext = useCallback(() => {
    const state = useAppStore.getState();
    const parts: string[] = [];

    if (state.brand?.initialized) {
      const b = state.brand;
      parts.push('【品牌档案】');
      if (b.name) parts.push(`品牌名: ${b.name}`);
      if (b.industry) parts.push(`行业: ${b.industry}`);
      if (b.mainBusiness) parts.push(`主营: ${b.mainBusiness}`);
      if (b.targetCustomer) parts.push(`目标客户: ${b.targetCustomer}`);
      if (b.differentiation) parts.push(`差异化: ${b.differentiation}`);
      if (b.toneOfVoice) parts.push(`语气风格: ${b.toneOfVoice}`);
      if (b.keywords.length) parts.push(`关键词: ${b.keywords.join('、')}`);
      if (b.tabooWords.length) parts.push(`禁用词: ${b.tabooWords.join('、')}`);
    }

    if (state.learnings.length > 0) {
      parts.push('\n【用户偏好记忆】');
      state.learnings.forEach(l => {
        parts.push(`- ${l.insight}`);
      });
    }

    // Append user writing preferences
    parts.push('\n' + getUserPrefsContext());

    return parts.join('\n');
  }, []);

  return { getFullContext, reloadData: loadData };
}
