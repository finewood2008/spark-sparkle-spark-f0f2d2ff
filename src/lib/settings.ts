export interface AISettings {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  imageProvider: string;
  imageApiKey: string;
  imageModel: string;
}

const STORAGE_KEY = 'spark-auto-settings';

const defaultSettings: AISettings = {
  provider: 'gemini',
  apiKey: '',
  baseUrl: '',
  model: 'gemini-2.5-flash',
  imageProvider: 'gemini-imagen',
  imageApiKey: '',
  imageModel: 'imagen-3.0-generate-images',
};

export function loadSettings(): AISettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch {}
  return defaultSettings;
}

export function saveSettings(settings: AISettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}
