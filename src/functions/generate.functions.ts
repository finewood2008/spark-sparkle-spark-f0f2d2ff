import { createServerFn } from '@tanstack/react-start';

interface GenerateContentInput {
  platform: string;
  topic: string;
  style: string;
  brandContext?: string;
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
}

function getApiUrl(provider: string, baseUrl?: string): string {
  switch (provider) {
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    case 'vveai':
      return 'https://api.vveai.com/v1/chat/completions';
    case 'custom':
      return `${(baseUrl || '').replace(/\/+$/, '')}/chat/completions`;
    default:
      return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  }
}

const PLATFORM_NAMES: Record<string, string> = {
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  douyin: '抖音',
};

export const generateContent = createServerFn({ method: 'POST' })
  .inputValidator((input: GenerateContentInput) => {
    if (!input.apiKey) throw new Error('API Key 未配置');
    if (!input.topic) throw new Error('主题不能为空');
    return input;
  })
  .handler(async ({ data }) => {
    const { platform, topic, style, brandContext, provider, apiKey, baseUrl, model } = data;

    const apiUrl = getApiUrl(provider, baseUrl);
    const platformName = PLATFORM_NAMES[platform] || platform;

    const systemPrompt = `你是"火花"，一个专业的社交媒体内容创作助手。
请为${platformName}平台生成一篇完整的图文内容。

你必须严格按照以下 JSON 格式返回（不要包含 markdown 代码块标记，直接返回纯 JSON）：
{
  "title": "吸引人的标题",
  "content": "完整的正文内容",
  "cta": "行动号召语",
  "tags": ["标签1", "标签2", "标签3"]
}

内容要求：
- 标题要吸睛、有吸引力，适合${platformName}平台的风格
- 正文要有价值、有深度，字数 200-500 字
- CTA 要有号召力，引导互动
- 标签 3-5 个，与主题相关
${style ? `- 写作风格：${style}` : ''}
${brandContext || ''}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请为"${topic}"这个主题生成一篇${platformName}图文内容。` },
        ],
        max_tokens: 2048,
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI API error [${response.status}]:`, errorText);
      if (response.status === 401 || response.status === 403) {
        throw new Error('API Key 无效或已过期');
      }
      if (response.status === 429) {
        throw new Error('请求过于频繁，请稍后再试');
      }
      throw new Error(`AI 服务返回错误 (${response.status})`);
    }

    const result = await response.json();
    const rawContent = result.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('AI 未返回有效内容');
    }

    // Parse JSON from AI response (handle markdown code blocks)
    let cleaned = rawContent.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed = JSON.parse(cleaned);
      return {
        title: parsed.title || '',
        content: parsed.content || '',
        cta: parsed.cta || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      };
    } catch {
      // If JSON parse fails, return raw content as body
      return {
        title: topic,
        content: rawContent,
        cta: '',
        tags: [],
      };
    }
  });
