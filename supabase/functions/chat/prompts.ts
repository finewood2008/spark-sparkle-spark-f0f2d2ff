// =============================================================================
// 火花 Spark - 系统提示词配置
// =============================================================================
// 集中管理人设、语气预设、字数等 AI 行为参数。
// 修改后需要重新部署 chat edge function 才会生效。
// =============================================================================

/** 火花的核心人设，所有模式共用 */
export const PERSONA = `你是"火花"，一个专业的社交媒体内容创作助手和策略顾问。`;

/** 语气预设 ID */
export type PresetId = "professional" | "lively" | "minimal";

export interface TonePreset {
  /** 显示名 */
  label: string;
  /** 一句话描述 */
  description: string;
  /** 聊天回复字数 */
  chatMaxLength: string;
  /** 文章正文字数 */
  articleWordRange: string;
  /** emoji 使用频率指令 */
  emojiHint: string;
  /** 整体语气描述 */
  toneHint: string;
}

/** 三档预设：专业 / 活泼 / 极简 */
export const TONE_PRESETS: Record<PresetId, TonePreset> = {
  professional: {
    label: "专业",
    description: "严谨、有逻辑、克制",
    chatMaxLength: "300 字以内",
    articleWordRange: "400-700 字",
    emojiHint: "极少使用 emoji（每段最多 1 个），专注内容本身",
    toneHint: "严谨、专业、有结构，使用「首先/其次/此外」等连接词增强逻辑",
  },
  lively: {
    label: "活泼",
    description: "热情、有感染力、emoji 丰富",
    chatMaxLength: "200 字以内",
    articleWordRange: "300-600 字",
    emojiHint: "频繁使用 emoji（每 1-2 句一个），让内容生动有趣 ✨🎉",
    toneHint: "热情、亲切、有感染力，多用感叹句和口语化表达",
  },
  minimal: {
    label: "极简",
    description: "简短、直给、无冗余",
    chatMaxLength: "80 字以内",
    articleWordRange: "150-300 字",
    emojiHint: "不使用 emoji",
    toneHint: "极度简洁、直给结论、无寒暄无修饰，每句话都有信息量",
  },
};

export const DEFAULT_PRESET: PresetId = "lively";

function resolvePreset(presetId?: string): TonePreset {
  return TONE_PRESETS[(presetId as PresetId)] || TONE_PRESETS[DEFAULT_PRESET];
}

/** 平台显示名映射 */
export const PLATFORM_NAMES: Record<string, string> = {
  xiaohongshu: "小红书",
  wechat: "微信公众号",
  douyin: "抖音",
};

/** 构建 chat 模式的 systemPrompt */
export function buildChatPrompt(brandContext?: string, presetId?: string): string {
  const p = resolvePreset(presetId);
  return `${PERSONA}

【语气预设：${p.label}】
- 语气：${p.toneHint}
- emoji：${p.emojiHint}
- 字数：回复控制在 ${p.chatMaxLength}

当用户想要生成文章时，引导他们点击"生成文章"按钮。
${brandContext || ""}`.trim();
}

/** 创作前分析结果（来自 analyze-intent function） */
export interface IntentBrief {
  matchedAssets?: string[];
  matchedRules?: string[];
  risks?: string[];
  /** 用户在澄清环节选定的角度（如「从客户案例切入，强调实际效果」） */
  chosenAngle?: string;
}

/** 构建 generate 模式的 systemPrompt */
export function buildGeneratePrompt(
  platform?: string,
  brandContext?: string,
  presetId?: string,
  intent?: IntentBrief,
): string {
  const p = resolvePreset(presetId);
  const platformName = PLATFORM_NAMES[platform || ""] || "社交媒体";

  // 把意图分析结果硬注入到 prompt，强制模型使用这些素材
  const briefSections: string[] = [];
  if (intent?.chosenAngle) {
    briefSections.push(`【用户选定的角度】\n${intent.chosenAngle}\n（必须围绕这个角度展开，不要偏离）`);
  }
  if (intent?.matchedAssets && intent.matchedAssets.length > 0) {
    briefSections.push(
      `【必须用到的品牌素材】\n${intent.matchedAssets.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n（至少自然融入 1-2 条到正文中）`,
    );
  }
  if (intent?.matchedRules && intent.matchedRules.length > 0) {
    briefSections.push(
      `【必须遵循的写作规则】\n${intent.matchedRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
    );
  }
  if (intent?.risks && intent.risks.length > 0) {
    briefSections.push(
      `【必须避开的风险】\n${intent.risks.map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
    );
  }
  const briefBlock = briefSections.length > 0 ? `\n\n${briefSections.join("\n\n")}` : "";

  return `${PERSONA}
用户正在请求你为${platformName}平台生成一篇完整文章。

【语气预设：${p.label}】
- 整体语气：${p.toneHint}
- emoji 使用：${p.emojiHint}
- 正文字数：${p.articleWordRange}
${briefBlock}

你必须严格按照以下 JSON 格式返回（不要包含 markdown 代码块标记，直接返回纯 JSON）：
{
  "title": "吸引人的标题",
  "content": "完整的正文内容，符合上述字数和语气要求",
  "cta": "行动号召语",
  "tags": ["标签1", "标签2", "标签3"],
  "reasoning": ["为什么这么写的解释1（如：标题用了xxx格式，因为你的偏好是xxx）", "解释2", "解释3"]
}

要求：
- content 严格控制在 ${p.articleWordRange}
- 内容贴合${platformName}平台调性
- reasoning 写 2-4 条，每条 20 字内，解释你做的关键创作选择（标题、结构、CTA、用了哪条品牌素材等），让用户感觉你"懂他"
${brandContext || ""}`.trim();
}

