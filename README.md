# 火花 Spark — AI 新媒体内容工作台

面向中小企业的 AI 内容创作助手。对话式交互生成小红书/公众号/抖音/视频号内容，自带品牌记忆、审核流、排期发布和数据回流。

## 技术栈

- **前端** React 19 + TanStack Start (Vite) + Tailwind CSS v4
- **后端** Supabase (Auth / PostgreSQL / Edge Functions / Realtime)
- **AI** Google Gemini 2.5-flash（对话/生成/分析/封面图）
- **部署** Lovable 托管 + Cloudflare Workers (可选代理)

## 项目结构

```
src/
├── components/
│   ├── chat/              # SparkChat 子模块（拆分后）
│   │   ├── ChatAtoms.tsx       SparkAvatar + TypingIndicator
│   │   ├── ChatInput.tsx       输入框 + 快捷模板
│   │   ├── MessageBubble.tsx   8种消息类型渲染
│   │   ├── WelcomeState.tsx    首页欢迎 + 数据卡
│   │   └── chat-utils.ts      建议生成 + 排期意图检测
│   ├── memory/            # 三层记忆面板 (identity/preference/context)
│   ├── settings/          # 语气预设卡片
│   ├── ui/                # shadcn/ui (精简至 5 个常用组件)
│   ├── SparkChat.tsx      # 主聊天组件 (446行)
│   ├── ChatLayout.tsx     # 顶部导航 + 侧抽屉编排
│   ├── ContentCard.tsx    # 内容卡片 (编辑/封面/标题/提交)
│   └── ...                # DataReport / Distribution / Schedule / Review 等
├── hooks/
│   └── useMemoryV2.ts     # 记忆 CRUD + Firecrawl 品牌分析
├── store/
│   ├── appStore.ts        # 全局状态 (消息/内容/品牌)
│   ├── authStore.ts       # 认证状态
│   └── memoryStore.ts     # 三层记忆 + 上下文注入
├── lib/
│   ├── ai-stream.ts       # AI 流式调用 (chat/generate/edit)
│   ├── auth-helpers.ts    # 统一 auth token 获取
│   └── ...                # env / user-prefs / persistence
├── routes/                # TanStack File-based routing
├── pages/                 # ReviewPage / SchedulePage
└── types/                 # TypeScript 类型定义

supabase/functions/
├── _shared/auth.ts        # CORS / JWT / Rate Limit / Payload 校验
├── chat/                  # 对话 (Gemini streaming)
├── ai-edit/               # 选中文本改写 (polish/rewrite/expand/shorten)
├── generate-cover/        # Gemini 2.5-flash-image 封面生成
├── learn-from-edit/       # 用户编辑 → 自动提炼偏好规则
├── analyze-sources/       # Firecrawl 抓取 + Gemini 品牌身份提取
├── execute-schedule/      # 定时任务执行 (pg_cron 触发)
├── fetch-metrics/         # 内容指标采集
└── analyze-metrics/       # 数据趋势 + AI 洞察
```

## 核心功能

### 对话式内容创作
在聊天中直接说"帮我写一篇小红书种草笔记"，AI 生成 JSON 结构化内容（标题/正文/CTA/标签），自动渲染为可编辑卡片。

### 品牌记忆系统 (Memory v2)
三层架构：
- **Identity** — 品牌名/行业/语气/差异化（通过 URL 分析或手动填写）
- **Preference** — AI 从用户编辑中自动学习的写作偏好规则
- **Context** — 临时上下文事实（热点/活动/季节）

不同 AI 调用模式注入不同粒度：chat 注入已确认规则，generate 注入全部偏好（含未确认），analyze 仅注入身份。

### 审核 + 发布流
内容生成 → 草稿 → 提交审核 → 审批 → 选择平台分发。支持手动创作和定时任务两种来源。

### 定时任务
自然语言创建（"每天帮我写一篇小红书笔记"），pg_cron 调度，生成内容自动进入审核中心，Realtime 推送桌面通知。

### 数据回流
采集已发布内容的阅读/点赞/评论/收藏数据，7 天趋势对比，Gemini 生成运营洞察建议。

## 安全机制

| 层级 | 措施 |
|------|------|
| 认证 | Supabase Auth JWT，verify_jwt=true (5 个用户函数) |
| 授权 | 前端 route guard (beforeLoad → requireSession) |
| CORS | 白名单制，无通配符 |
| 输入 | messages 50条/10K字符，text 20K，payload 100KB |
| 限流 | 滑动窗口 rate limit：chat 20/min，gen-cover 10/min 等 |
| 隔离 | cron 函数用 CRON_SECRET / SERVICE_ROLE_KEY 鉴权 |

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npx tsc --noEmit

# 构建
npm run build
```

环境变量在 Supabase Dashboard 和 `.env` 中配置，关键项：
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- Edge Functions: `GEMINI_API_KEY`, `FIRECRAWL_API_KEY`, `CRON_SECRET`

## 版本历史

详见 [CHANGELOG.md](./CHANGELOG.md)

当前版本: **v0.3.0**
