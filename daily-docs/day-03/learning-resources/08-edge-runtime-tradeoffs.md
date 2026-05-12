# Edge Runtime 的真实取舍（反驳"生产都该 edge"）

## 一句话结论

`runtime = 'edge'` **不是"生产默认值"**。它是个有显著代价的选择，多数业务 Server Action 默认 Node 更合理。

## Edge Runtime 是什么

- 基于 **V8 isolates**（不是完整 Node）
- 跑在全球 **CDN 节点**（Vercel Edge Network / Cloudflare Workers）
- **没有完整 Node.js API**：`fs` / `net` / `child_process` / 部分 `crypto` / 部分 `Buffer` 都没了
- 只剩 Web 标准 API（`fetch` / `Request` / `Response` / `crypto.subtle`）

## Edge 的代价（多数教程没算清楚）

### 代价 1：很多包用不了

`postgres.js` / `pg` / `mysql2` 依赖 `net` 模块，**Edge 里直接挂**。Stripe SDK / Resend / 部分 AWS SDK 早期版本也跑不了。

→ Driver 选型被限制成 HTTP-based（Neon HTTP / Planetscale / Turso / Drizzle HTTP）。

### 代价 2：CPU/内存上限低

| Runtime | CPU 时间 | 内存 |
|---|---|---|
| Node serverless | 10s ~ 15min | 3GB ~ 10GB |
| Vercel Edge | **~50ms（free）/ 数百 ms（pro）** | **128MB** |

跑 PDF 解析 / 图片处理 / 大批量 DB query 都可能 OOM 或超时。

### 代价 3：**地理悖论**（最重要、最少人意识到）

Edge 的卖点是"跑在离用户近的节点"，但**数据库在固定 region**：

```
用户在北京 → Vercel edge node 在香港（10ms）→ Neon DB 在 us-east-1（250ms RTT）
```

如果你的 Server Action 里有 5 次 DB query：

| Runtime | 部署位置 | 总延迟 |
|---|---|---|
| Edge | 全球（离用户近） | 5 × 250ms + 用户↔edge ≈ 1260ms |
| Node serverless | 跟 DB 同 region | 5 × 1ms + 用户↔节点 ≈ 250ms |

**"代码离用户近"反而比"代码离 DB 近"慢得多** —— 当 Server Action 是数据密集型时。

### 代价 4：调试困难

- 没有完整 Node debugger
- 部分 npm 包行为在 Edge 跟 Node 不一致（特别是 buffer 编码、crypto、timezone）
- 日志聚合 vs Node 函数不一样

## 什么时候用 Edge / 什么时候不用

### Edge 真正成立的 4 类场景

1. **Middleware（强制只能 Edge）**：每个请求都要跑的 auth check / A/B / geo redirect
2. **Edge Cache + 动态计算融合**：边缘个性化、A/B test、rate limiting
3. **Auth / OAuth callback**：短逻辑，需要快速响应
4. **LLM Streaming**：这是 Edge 的杀手锏，下面单独讲

### 决策表

| 场景 | runtime | 原因 |
|---|---|---|
| **多次 DB query 的 CRUD Server Action** | Node（默认） | 地理悖论 |
| Auth callback / 短逻辑 / redirect | Edge | 单次轻量，全球分布好 |
| **LLM streaming（Anthropic / OpenAI）** | Edge ✅ | streaming 是 Edge 强项；LLM 延迟主导，DB 不是瓶颈 |
| Webhook 处理（Stripe / Inngest） | Node | 通常需要时间长 + Node SDK |
| 静态资源 / middleware redirect | Edge | 极轻量 |
| 文件上传 / 图像处理 | Node | `fs` + 大内存 |
| 大 JSON parse / 复杂计算 | Node | CPU 限制 |

## 为什么 LLM Streaming Edge 比 Node serverless 优

不是说 Node 跑不了，是 Edge 有 **4 个具体优势**：

| 维度 | Vercel Node serverless | Edge runtime |
|---|---|---|
| 最大连接时长 | 10s 默认，pro 300s | **数分钟到无限**（hobby 限制更宽松） |
| 冷启动 | 100-500ms（用户等首 token 的时间） | < 5ms |
| 计费模型 | **按 wall-clock 时长**（30s stream = 按 30s 计费） | **按 CPU 时间**（stream 等响应时 CPU idle，几乎免费） |
| 单次成本 | 一次 30s LLM stream 可能贵 10×+ | 便宜 |

举例：跑一个 Claude API stream 30 秒：

- **Node serverless**：30s × 内存（1GB）= ~$0.027 per call
- **Edge**：真正 CPU 用了 50ms = ~$0.00005 per call

**500 倍成本差距**，这就是为什么 LLM 应用几乎都跑 Edge。

## 行业 ground truth

| 产品类型 | 一般用 Edge 吗？ |
|---|---|
| ChatGPT / Claude / 等 LLM 产品 | ✅ 几乎都用（stream 入口） |
| Notion / Linear / Figma 这种大型 SaaS 的 **API** | ❌ **不用 Edge**——自管 + 多 region Node |
| 大型电商核心 API | ❌ 几乎不用 |
| 内容站、博客、营销页 | ✅ Edge |
| AI 应用（Cursor、Devin、Bolt...） | ✅ **streaming 部分用 Edge**，核心业务 API 用 Node |

模式：**Node + Edge 混用**，不是 Edge 替代 Node。

## 心法

1. **`runtime = 'edge'` 不是默认值**——除非你测过，确认它更快。
2. **数据密集型 = Node**；**计算/流式 = Edge**。
3. **加 edge 前先回答 3 问题**：DB 在哪 region？用户主要在哪？我做几次 DB query？
4. **"现代/简单/快"3 个词只要有一个被用来推 Edge，立刻警惕** —— 通常省略了"代价"。

## 自检题

1. 你的项目部署在 Vercel，DB 在 us-east-1，用户主要在中国。如果用 Edge runtime + 10 次 DB query，预期延迟多少？跟 Node serverless 比呢？
2. 假设你在 Edge runtime 里用 `@neondatabase/serverless` 的 HTTP driver，**是否能用事务**？为什么？这跟"Edge 限制"还是"driver 限制"有关？
3. 为什么 Vercel / Cloudflare 这么积极推 Edge runtime？除了"对用户更好"，**对平台自己的商业价值**是什么？
