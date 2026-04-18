import type { ChoiceOption, ScheduleCardData } from '../../types/spark';

// Generate context-aware suggestions based on article content
export function generateSuggestions(title: string, content: string, tags?: string[]): ChoiceOption[] {
  const suggestions: ChoiceOption[] = [
    { id: 's1', label: '帮我润色一下这篇文章', emoji: '✨' },
    { id: 's2', label: `给「${title.substring(0, 10)}」配一张封面图`, emoji: '🎨' },
    { id: 's3', label: '换一种更活泼的风格重写', emoji: '🔄' },
  ];
  if (content.length < 200) {
    suggestions.push({ id: 's4', label: '内容太短了，帮我扩写一下', emoji: '📝' });
  }
  if (!tags || tags.length < 3) {
    suggestions.push({ id: 's5', label: '帮我补充更多标签', emoji: '🏷️' });
  }
  if (content.length > 500) {
    suggestions.push({ id: 's6', label: '太长了，帮我精简到300字以内', emoji: '✂️' });
  }
  return suggestions.slice(0, 4);
}

// Detect schedule-creation intent in natural language
export function tryDetectScheduleIntent(text: string): ScheduleCardData | null {
  const scheduleKeywords = /(每周|每天|每日|定时|定期|自动生成|自动发|计划|按时|每隔)/;
  if (!scheduleKeywords.test(text)) return null;
  const frequency: 'daily' | 'weekly' = /每周|周一|周二|周三|周四|周五|周六|周日/.test(text) ? 'weekly' : 'daily';
  // Extract a topic guess: text after "关于" or "写" up to common stopwords
  let topic = '';
  const aboutMatch = text.match(/关于(.+?)(?:的|，|。|$|内容|文章|推文|笔记)/);
  if (aboutMatch) topic = aboutMatch[1].trim();
  if (!topic) {
    const writeMatch = text.match(/写(?:一篇|一个|点)?(.+?)(?:的|，|。|$|内容|文章|推文|笔记)/);
    if (writeMatch) topic = writeMatch[1].trim();
  }
  return {
    id: `${Date.now()}-plan`,
    suggestedTopic: topic.slice(0, 30),
    suggestedFrequency: frequency,
  };
}
