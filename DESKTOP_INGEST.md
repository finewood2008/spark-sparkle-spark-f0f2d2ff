# 火花桌面客户端 — 数据回传协议

桌面客户端在用户已登录的小红书 / 抖音 / 微信公众号页面（或其官方 PC App）抓取真实互动数据后，POST 到本协议端点，云端会写入 `content_metrics` 表（`source = 'desktop'`），Web 端实时显示。

## 1. 鉴权

用户在 Web 端「账户 → 桌面客户端 Token」生成 Token（形如 `spk_live_xxxxxxxxxxxxxxxxxx`），桌面 App 把它持久化到本地（macOS Keychain / Windows Credential Vault），每次请求带：

```
Authorization: Bearer spk_live_xxxxxxxxxxxxxxxxxx
```

Token 仅显示一次。Token 吊销后立即失效。

## 2. 端点

```
POST https://<your-domain>/api/ingest-metrics
Content-Type: application/json
```

CORS 已放开 `*`，桌面 App（Electron / Tauri / 原生）均可直接调。

## 3. 请求体

```jsonc
{
  "metrics": [
    {
      "review_item_id": "sched_1734567890_abc123",   // 必填，对应 review_items.id
      "platform": "xiaohongshu",                      // 必填: xiaohongshu | douyin | wechat | tiktok | instagram
      "views": 12453,
      "likes": 832,
      "comments": 67,
      "saves": 145,
      "shares": 23,
      "ai_insight": "首小时互动率 6.8%，优于历史均值",  // 可选，AI 分析
      "fetched_at": "2026-04-16T10:23:00Z"             // 可选，ISO8601；不填用服务器时间
    }
    // 单次最多 100 条
  ]
}
```

每条 metric 限制：所有数值 0 ~ 1,000,000,000；`ai_insight` ≤ 2000 字符；`review_item_id` ≤ 128 字符。

## 4. 响应

**成功（200）：**
```json
{
  "ok": true,
  "accepted": 5,        // 实际写入的明细行数
  "aggregates": 3,      // 自动生成的「跨平台聚合」行数（按 review_item_id 合并）
  "skipped": 0          // 因找不到对应 review_items 或不属于本用户而跳过的条数
}
```

**错误：**
- `400` 请求体 schema 不通过（带 `error` 字段说明）
- `401` Token 缺失 / 格式错误 / 失效 / 已吊销
- `500` 内部错误

## 5. 推荐采集节奏

- 内容发布后 **1h / 6h / 24h / 72h** 各采一次，能拿到完整冷启曲线
- 之后每天一次，直到第 7 天
- 同一 `(review_item_id, platform)` 多次上报会保留全部历史，Web 端显示「最新一次」用于卡片，「全部」用于趋势图

## 6. 各平台抓取实现提示

| 平台 | 抓取方式 | 关键说明 |
|------|---------|---------|
| **小红书** | 嵌入 WebView 加载 `https://www.xiaohongshu.com/user/profile/...`，注入 JS 读 DOM；或在用户已登录的 Cookie 下调内部 `/api/sns/web/v1/note/...` | 接口有签名校验，建议直接读 DOM 最稳 |
| **抖音** | 用户登录抖音创作者中心 PC 版，WebView 注入读 `https://creator.douyin.com/...` 数据接口的响应 | 抖音风控较严，加随机延迟 |
| **微信公众号** | 用户登录公众平台 `mp.weixin.qq.com`，WebView 读「图文分析」页 | 数据是 T+1 |

⚠️ 上述方式均使用用户**自己**的 Cookie 抓取**自己**的内容数据，不涉及爬取他人数据，符合各平台个人查看自身数据的合理使用。但仍属于非官方接口，账号级风险由用户承担。

## 7. 示例：Node.js 请求

```ts
import { readFileSync } from 'node:fs';

const TOKEN = readFileSync('/secure/path/to/spark.token', 'utf8').trim();

async function pushMetrics(rows) {
  const res = await fetch('https://your-spark.lovable.app/api/ingest-metrics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ metrics: rows }),
  });
  if (!res.ok) {
    throw new Error(`Ingest failed [${res.status}]: ${await res.text()}`);
  }
  return res.json();
}
```

## 8. 与现有「立即拉取」的关系

- Web 端「立即拉取」按钮调的是云端 `fetch-metrics` Edge Function，目前用 mock 随机数 — 仅作演示
- 桌面客户端通过本协议上传的真实数据**优先级更高**：Web 端读 `content_metrics` 时按 `fetched_at desc` 排序，最新一条会自动覆盖旧的 mock 行
- 长期方向：当桌面 App 普及后，可下线 `fetch-metrics` 的 mock 逻辑

