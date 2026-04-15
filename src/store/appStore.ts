import { create } from 'zustand';
import type { ChatMessage, ContentItem, ScheduleConfig, BrandMemory, LearningEntry, Suggestion, TabId } from '../types/spark';

interface AppState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;

  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  suggestions: Suggestion[];
  setSuggestions: (s: Suggestion[]) => void;

  contents: ContentItem[];
  setContents: (c: ContentItem[]) => void;
  selectedContentId: string | null;
  setSelectedContentId: (id: string | null) => void;

  schedule: ScheduleConfig | null;
  setSchedule: (s: ScheduleConfig) => void;

  brand: BrandMemory | null;
  setBrand: (b: BrandMemory) => void;
  brandMemoryEnabled: boolean;
  setBrandMemoryEnabled: (v: boolean) => void;
  learnings: LearningEntry[];
  setLearnings: (l: LearningEntry[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'studio',
  setActiveTab: (tab) => set({ activeTab: tab }),

  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),
  suggestions: [],
  setSuggestions: (suggestions) => set({ suggestions }),

  contents: [],
  setContents: (contents) => set({ contents }),
  selectedContentId: null,
  setSelectedContentId: (id) => set({ selectedContentId: id }),

  schedule: null,
  setSchedule: (schedule) => set({ schedule }),

  brand: null,
  setBrand: (brand) => set({ brand }),
  brandMemoryEnabled: false,
  setBrandMemoryEnabled: (v) => set({ brandMemoryEnabled: v }),
  learnings: [],
  setLearnings: (learnings) => set({ learnings }),
}));
