# Changelog

本文档记录 火花 Spark 的所有重要改动。格式参考 Keep a Changelog，版本号遵循 SemVer。

## [0.3.1] — 2026-04-19

### 修复 Edge Functions "Failed to fetch"

#### Fixed
- `supabase/functions/_shared/auth.ts` CORS 白名单：动态匹配 `lovableproject.com` / `lovable.app` / `lovable.dev` / `spark-geo.com` / `localhost`，
  并把请求 Origin 回显回去（之前硬编码项目 supabase 子域名，导致 Preview 和自定义域被拦截）
- `supabase/config.toml` 5 个面向前端的函数（chat / ai-edit / generate-cover / learn-from-edit / analyze-sources）`verify_jwt` 回退为 `false`：
  Supabase 网关 JWT 校验对 HS256/ES256 算法判定与 anon key 签名不匹配，会在到达函数前直接拒绝；
  改由函数内 `requireUser(req)` 用 `supabase.auth.getUser(token)` 自行校验，等价安全
- 重新部署全部 8 个 Edge Functions，端到端验证：聊天长文 ✅、ai-edit 润色 ✅、analyze-sources 抓取 ✅、generate-cover 封面 ✅

### Note
- 本节修正了 [0.3.0] "verify_jwt=true" 的描述：实际生产为 `false`，安全由函数内部校验保证

---

## [0.3.0] — 2026-04-19

### 安全加固 + 架构优化

两阶段改造：Phase 1 安全加固，Phase 2 架构清理。总计 75 文件变更，净减 ~3400 行代码。

#### Added
- `supabase/functions/_shared/auth.ts` 共享安全模块（6 导出）：
  getCorsHeaders / optionsCors / requireUser / requireCronAuth / validatePayloadSize / checkRateLimit
- `src/lib/auth-helpers.ts`：getAuthToken / getCurrentSession / requireSession
  统一 10+ 处重复的 supabase.auth.getSession() 调用
- Edge Functions 滑动窗口 rate limiting：
  chat/ai-edit 20次/分, generate-cover/analyze-sources 10次/分, learn-from-edit 30次/分
  超限返回 HTTP 429
- SparkChat 拆分为 5 个子模块 (src/components/chat/)：
  ChatAtoms / ChatInput / MessageBubble / WelcomeState / chat-utils

#### Changed
- Edge Functions: verify_jwt=true (chat/ai-edit/generate-cover/learn-from-edit/analyze-sources)
- CORS: 消除 `*` 通配符，改为 ALLOWED_ORIGIN 白名单或项目域名推导
- 输入校验: messages 50 条 / 10K 字符上限, text 20K, payload 100KB
- 前端 AI 调用 (ai-stream / ContentCard) 改用 session access_token 替代 anon key
- 路由守卫: /account, /review 添加 beforeLoad + ssr:false
- ChatLayout: DraftDrawer / MemoryPanel / SchedulePage / ReviewPage 改为 React.lazy
  review count 延迟 1s, realtime subscription 延迟 500ms
- SparkChat 主文件: 945 行 → 446 行

#### Removed
- 41 个未使用的 shadcn/ui 组件 (46 → 5)
- 生产环境 console.log (oauth.authorize.tsx)
- authService.ts 中的误导性 TODO 注释（改为 stub 标注）

## [0.2.1] — 2026-04-19

### 自动学习 + 智能注入

把 Memory v2 剩下两块核心能力补齐：AI 生成内容被用户编辑后自动提炼偏好规则，以及 AI 调用时按模式注入不同粒度的上下文。

#### Added
- Edge Function `supabase/functions/learn-from-edit`：
  - 接收 `{original, edited, contextTitle?}`
  - 用 Gemini 2.5-flash 做 diff 分析，提取 1-3 条具体可复用的写作偏好
  - 写入 `memories` 表（layer=preference，confirmed=false，source=auto_edit_learn）
  - JWT 验证用户身份，service-role key 绕过 RLS 安全写入
- `useMemoryV2` 暴露 `learnFromEdit(original, edited, title?)`
  - 静默容错：任何失败都不阻塞 UI
  - 成功后自动 `loadMemories()` 刷新偏好规则面板
- `src/lib/ai-stream.ts` 新增 `resolveBrandContext(mode, explicit)` 统一入口：
  - 调用方显式传 brandContext 优先（ChatLayout 已自组装）
  - 否则从 `useMemoryStore.getFullContext(mode)` 自动拉取
  - 三种模式分流：
    - `chat` → identity + 已确认偏好 + context facts
    - `generate` → identity + 全部偏好（含未确认，用于草稿调性）
    - `analyze` → 仅最小品牌身份

#### Changed
- `ContentCard.handleSave` 编辑保存钩子：v1 + v2 并行触发学习，仅当 `memoryEnabled=true` 调 v2；新规则在聊天里气泡提醒用户去「火花记忆 → 偏好规则」确认
- `streamChat` / `streamEdit` 全部走新的统一注入逻辑
- `generateArticle`（SchedulePage / MetricsCard / schedule-persistence 使用）自动获得 generate 模式上下文，无需改调用方

---

## [0.2.0] — 2026-04-18

### 记忆系统 v2 — 三层架构重构

把原来按「类型」分的 `brand_memories` + `learning_entries` 两张表重构成按「生命周期」分层的单表 `memories`。

#### Added
- 新表 `public.memories`：三层模型（identity / preference / context）+ JSONB content + RLS
- Edge Function `analyze-sources`：用 Firecrawl 抓取官网/文章/社媒链接，Gemini 2.5-flash 抽取品牌身份
- Zustand `memoryStore`：三层数据管理 + `getFullContext(mode)` 按模式返回上下文
- Hook `useMemoryV2`：Supabase 同步、持久化、`analyzeUrls()`
- 组件 `MemoryPanel`：三标签 UI（品牌档案 / 偏好规则 / 上下文），含确认/删除/置信度显示

#### Removed
- `src/components/SparkProfile.tsx`（旧品牌档案 UI，被 MemoryPanel 取代）
- `src/hooks/useMemorySync.ts`（旧双写 hook）

#### Deprecated
- `brand_memories` / `learning_entries` 表：保留一个迭代后删除

---

## [0.1.x] — 2026-04-16 以前

- 初始 Lovable 构建：React 19 + TanStack Start + Supabase + Tailwind v4
- 多平台内容生成（小红书/抖音/公众号/视频号）
- 审核流 / 排期 / 指标看板
- 品牌档案 v1 + 学习条目 v1
- 火花 Logo 设计迭代
