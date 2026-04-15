import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/appStore';
import type { BrandMemory, LearningEntry } from '@/types/spark';

const DEVICE_ID = 'default'; // Single-user for now

export function useMemorySync() {
  const { brand, setBrand, learnings, setLearnings } = useAppStore();
  const loaded = useRef(false);
  const savingBrand = useRef(false);
  const savingLearnings = useRef(false);

  // Load on mount
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    (async () => {
      // Load brand
      const { data: brandRow } = await supabase
        .from('brand_memories')
        .select('*')
        .eq('device_id', DEVICE_ID)
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
      }

      // Load learnings
      const { data: learningRows } = await supabase
        .from('learning_entries')
        .select('*')
        .eq('device_id', DEVICE_ID)
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
      }
    })();
  }, [setBrand, setLearnings]);

  // Save brand when it changes
  const saveBrand = useCallback(async (b: BrandMemory) => {
    if (savingBrand.current) return;
    savingBrand.current = true;
    try {
      await supabase
        .from('brand_memories')
        .upsert({
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
        }, { onConflict: 'device_id' });
    } finally {
      savingBrand.current = false;
    }
  }, []);

  // Save learnings when they change
  const saveLearnings = useCallback(async (entries: LearningEntry[]) => {
    if (savingLearnings.current) return;
    savingLearnings.current = true;
    try {
      // Delete all existing, then insert current
      await supabase.from('learning_entries').delete().eq('device_id', DEVICE_ID);
      if (entries.length > 0) {
        await supabase.from('learning_entries').insert(
          entries.map(e => ({
            id: e.id,
            device_id: DEVICE_ID,
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

    return parts.join('\n');
  }, []);

  return { getFullContext };
}
