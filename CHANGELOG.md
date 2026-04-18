# Changelog

本文档记录 火花 Spark 的所有重要改动。格式参考 Keep a Changelog，版本号遵循 SemVer。

## [0.2.2] — 2026-04-18

### Edge Functions 全面恢复（CORS + verify_jwt 双修）

修复线上聊天「连接 AI 服务失败 / Failed to fetch」整片打不开的故障。两个独立根因叠加：

#### Fixed
- **CORS 白名单（真正根因）**：`supabase/functions/_shared/auth.ts` 的 `getCorsHeaders` 原本把 `Access-Control-Allow-Origin` 写死成 `${projectRef}.lovable.app`，导致 Preview 域 `*.lovableproject.com`、自定义域 `spark-geo.com`、`*.lovable.dev` 全部被浏览器 CORS 拦截，前端表现为 `Failed to fetch`。改为基于请求 origin 动态匹配 + `Vary: Origin`：
  - 放行：`*.lovable.app` / `*.lovableproject.com` / `*.lovable.dev` / `spark-geo.com` / `localhost`
  - 兼容 `ALLOWED_ORIGIN` 逗号分隔环境变量
- **verify_jwt 网关拦截**：`chat / learn-from-edit / ai-edit / analyze-sources / generate-cover` 五个函数原 `verify_jwt = true`，但 Supabase 网关用旧 HS256 校验器去验新版 ES256 JWT，直接 401 拦截。统一改为 `verify_jwt = false`，由函数内 `requireUser(req)` 自行校验 ES256 token（代码侧本来就这么写，只是 toml 没切）。

#### Verified
端到端实测：
- 聊天生成长文：UI 流式返回，console 零报错
- 抓品牌档案 (analyze-sources)：UI 显示 brandDoc
- ai-edit / generate-cover：curl 200 + SSE / JSON 正常

#### Note
顺手修了一处 `analyze-metrics` / `fetch-metrics` 中被截断的死代码（`Deno.e...Y")`），以及 `execute-schedule.loadBrandContext` 的 Supabase 客户端类型推断错误。

---

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
