import { createServerFn } from '@tanstack/react-start';

interface ChatInput {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
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

export const chatWithAI = createServerFn({ method: 'POST' })
  .inputValidator((input: ChatInput) => {
    if (!input.apiKey) throw new Error('API Key 未配置，请先在设置页面填写');
    if (!input.messages || input.messages.length === 0) throw new Error('消息不能为空');
    return input;
  })
  .handler(async ({ data }) => {
    const { messages, provider, apiKey, baseUrl, model } = data;

    const apiUrl = getApiUrl(provider, baseUrl);

    const systemMessage = {
      role: 'system' as const,
      content: `你是"火花"，一个专业的社交媒体内容创作助手。你擅长：
- 为小红书、微信公众号、抖音等平台创作图文内容
- 优化标题、正文、CTA（行动号召）
- 提供内容策略和数据分析建议
- 根据品牌调性生成一致的内容

请用简洁、友好、专业的语气回复。适当使用 emoji 增加亲和力。
回复尽量控制在 200 字以内，除非用户明确要求详细内容。`,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (provider === 'gemini') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const body = {
      model: model || 'gemini-2.5-flash',
      messages: [systemMessage, ...messages],
      max_tokens: 1024,
      temperature: 0.8,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI API error [${response.status}]:`, errorText);

      if (response.status === 401 || response.status === 403) {
        throw new Error('API Key 无效或已过期，请检查设置');
      }
      if (response.status === 429) {
        throw new Error('请求过于频繁，请稍后再试');
      }
      if (response.status === 402) {
        throw new Error('API 额度不足，请检查账户余额');
      }
      throw new Error(`AI 服务返回错误 (${response.status})`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI 未返回有效内容');
    }

    return { content };
  });
