# Memory System v2 — 重构进度

> 目标：把旧的 `brand_memories` + `learning_entries` 两张表，升级成统一的三层记忆模型
> （identity / preference / context），支持 Firecrawl 自动抓取、用户偏好自动学习、按场景分级注入。

---

## 架构概览

| 层 | 表字段 `layer` | 含义 | 生命周期 |
| --- | --- | --- | --- |
| identity | `identity` | 品牌档案、品牌故事、视觉规范 | 永久 |
| preference | `preference` | 写作风格、标题模式、语气规则 | 永久（可用户确认/删除） |
| context | `context` | 近期内容、会话摘要、计划 | 7 天过期 |

统一进 `public.memories` 一张表，用 `layer + category` 区分。

---

## Phase 进度

### ✅ Phase 1 — 数据库迁移（已完成）

- 新建 `supabase/migrations/20260419000000_create_memories_table.sql`
  - 建 `memories` 表（JSONB content、三层 layer 约束、过期索引）
  - RLS：user_id 自己可读写、device_id 匿名也可读写（兼容未登录场景）
  - 自动 `updated_at` 触发器
  - 从 `brand_memories` / `learning_entries` 复制历史数据（不删旧表）

### ✅ Phase 2 — 类型 + 状态管理（已完成）

- `src/types/memory.ts`：MemoryEntry / BrandProfile / PreferenceRule / SourceUrl / AnalysisResult
- `src/store/memoryStore.ts`：Zustand store
  - 数据：memories / brandProfile / preferences / sourceUrls
  - 开关：isAnalyzing / memoryEnabled
  - **分级注入**：`getFullContext('chat' | 'generate' | 'analyze')`
    - chat：identity 全量 + 仅已确认 preference + context
    - generate：identity 全量 + 所有 preference（省 token，不带 context）
    - analyze：仅 brand + industry（最小注入）

### ✅ Phase 3 — Edge Function + Hook（已完成）

- `supabase/functions/analyze-sources/index.ts`
  - 接收 URL 列表，调 Firecrawl 抓取
  - Gemini/OpenAI 生成 `AnalysisResult`（品牌档案 + 写作模式数组）
  - 返回给前端
- `src/hooks/useMemoryV2.ts`
  - `loadMemories()`：从 Supabase 拉、过滤 7 天过期 context、重构 brandProfile
  - `persistEntry()` / `persistAll()`：单条/全量 upsert
  - `analyzeUrls(urls)`：调 edge function，更新 sourceUrls 状态
  - `saveAnalysisResult(result)`：写入 identity + preference 记忆

### ✅ Phase 4 — 前端记忆面板 UI（已完成）

替换旧的 `SparkProfile.tsx`（19 684 字符、单页表单），改成一个宽抽屉（520px），3 个 Tab：

1. **品牌档案**（identity） — `src/components/memory/BrandProfileTab.tsx`
   - Firecrawl URL 输入 + 「分析」按钮
   - 抓取状态列表（pending / fetching / done / error）
   - 分析结果预览 + 保存并应用
   - 手动编辑表单（品牌名/行业/主营/目标客户/差异化/语气/关键词/禁用词/品牌故事）
2. **偏好规则**（preference） — `src/components/memory/PreferenceTab.tsx`
   - 按 category 分组列表，6 种类别各自配色
   - 每条可 `confirm`（打勾）/ `delete`
   - 未确认规则显示为 `?`，确认后为 `✓`
   - 空状态引导
3. **上下文记忆**（context） — `src/components/memory/ContextTab.tsx`
   - 最近 7 天内的 session summary / recent_content / schedule
   - 显示过期时间倒计时（< 1 天变橙色警示）
   - 「清空全部」快捷操作

主抽屉 `src/components/MemoryPanel.tsx`：
- 顶部开关：点击 toggle 开启/关闭记忆注入
- Tab 导航带 count badge
- 底部 footer 显示记忆注入状态

ChatLayout 挂载：
- `SparkProfile` → `MemoryPanel`
- 同时挂载 `useMemoryV2()` 进行初次加载
- `getContextForChat`：v2 开启时优先用 `useMemoryStore.getFullContext('chat')`，否则 fallback 到旧 `useMemorySync.getFullContext()`（双写过渡）

### ⏸ Phase 5 — 自动学习（未开始）

- 钩子：`lib/review-persistence.ts` 保存编辑后内容时
  - diff 原文 vs 编辑后，生成 evidence
  - 调 LLM 提炼 `rule`（如"喜欢用短段落"、"避免 emoji"）
  - 写入 `layer=preference, category=writing_style, confirmed=false`
- UI 在偏好 Tab 显示 `?` 待用户确认

### ⏸ Phase 6 — 智能注入（未开始）

- 把 `useMemorySync.getFullContext()` 的调用点全部换成 `useMemoryStore.getFullContext(mode)`
- 需要改的入口：
  - `lib/ai-chat.ts` → mode='chat'
  - `lib/ai-generate.ts` → mode='generate'
  - `lib/ai-analyze.ts` / metrics insights → mode='analyze'

### ✅ Phase 7 — 清理（已完成）

- 删除 `src/hooks/useMemorySync.ts`（旧）
- 删除 `src/components/SparkProfile.tsx`（旧）
- `ChatLayout` 移除双写过渡：`getContextForChat` 直接走 `useMemoryStore.getFullContext('chat')`
- 旧的 `brand_memories` / `learning_entries` 表保留 1 个迭代后再删
- 注：`appStore` 里的 `brand` / `learnings` / `brandMemoryEnabled` 字段仍被 `MetricsCard` / `SparkChat` 引用，待 Phase 6（智能注入）一并迁移后再清理

---

## 关键决策记录

1. **为什么合表而不是继续 2 张？**
   - 旧表按"类型"分，新模型按"生命周期"分，更贴合记忆系统的语义
   - 查询注入更方便：一次 `WHERE user_id=?` 就拿全部，再前端按 layer 切

2. **为什么 context 7 天过期？**
   - 聊天摘要、当日计划这些东西放久了反而污染 prompt
   - identity / preference 是长期资产，不过期

3. **为什么新开 `useMemoryV2` 而不是改 `useMemorySync`？**
   - 两套并存一个迭代，便于回滚
   - Phase 7 再删旧 hook

---

## 当前未提交改动

```
M package-lock.json
M supabase/config.toml
?? src/hooks/useMemoryV2.ts                  (新 hook)
?? src/store/memoryStore.ts                  (新 store)
?? src/types/memory.ts                       (新类型)
?? supabase/functions/analyze-sources/       (新 edge function)
?? supabase/migrations/20260419000000_...sql (新迁移)
```

准备 commit 信息：
`feat(memory-v2): Phase 1-3 — 三层记忆模型 + Firecrawl 分析`
