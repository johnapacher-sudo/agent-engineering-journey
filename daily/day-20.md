# Day 20 · 2026-05-27（周三）

> Week 3 · 队列与事件驱动（Inngest）
> 今天 2-2.5h · **阶段 2 精读日**

## 今天学什么

**主题**：把 Inngest 从"会用"升级到"会选" —— 理解它在队列生态里的位置。

Inngest 不是唯一的 serverless 队列方案。Trigger.dev / Temporal / BullMQ / AWS SQS + Step Functions 都存在。如果你只会 Inngest 一家，面试时答"为什么选 Inngest"会很虚。今天把整个光谱看一遍，把选型判据固化。

## 核心概念

今天要建立的 5 个稳固知识点：

1. **Durable execution 概念**：Inngest / Temporal / Trigger.dev 的共同核心 —— function 的每一步都持久化，可以跨进程 / 跨部署恢复。**这是现代 workflow engine 的定义性特征**。
2. **BullMQ / SQS 和 durable execution 的本质差异**：BullMQ 管理"任务队列"但不管任务内部状态；Inngest 管理"function 执行流"，连你的 `for` 循环都持久化。
3. **传统 queue vs 现代 workflow engine 的取舍**：简单任务用 BullMQ 就够；复杂流程（多步、长时、人工介入）必须 workflow engine。
4. **Inngest 的独特设计决策**：
   - serverless-first（云端调度，本地写 function）
   - event-driven（不是 task-queue）
   - TypeScript-native（和 Mastra / AI SDK 生态天然匹配）
5. **什么情况不该选 Inngest**：
   - 需要本地/私有部署（Temporal 可自托管）
   - 超高吞吐（每秒 10K+ events，可能要专用基础设施）
   - 需要复杂的定时任务调度（n8n / Airflow 更强）

## 参考资源

**Inngest 官方（1h）**
- **[Inngest: Concepts overview](https://www.inngest.com/docs/concepts)** — 全读，把前面几天学的点串起来
- **[Inngest: Flow Control reference](https://www.inngest.com/docs/guides/flow-control)** — 再读一遍，对照 Day 18 实验结果验证理解
- **[Inngest: AgentKit](https://agentkit.inngest.com/)** — 15 min，了解 Inngest 自己的 agent 层（M5 Week 17 会再提）

**访谈 / 深度博客（30 min，任选其一）**
- Latent Space podcast 里 Inngest 创始人 Tony 的访谈（搜 "Inngest Tony"）
- Inngest 博客：Why we built durable execution

**对比 / 竞品（30 min）**
- **[Trigger.dev vs Inngest](https://trigger.dev/blog)** — 扫 Trigger 博客的立场文章
- **[Temporal concepts](https://docs.temporal.io/concepts)** — 扫一眼 activity / workflow 抽象（10 min）
- **[BullMQ README](https://github.com/taskforcesh/bullmq)** — 扫一眼 README，感受传统 queue 的 API 形状

## 动手练习

今天不写新业务。三件事：整理笔记、对比表、自答题。

### Part 1 · Inngest 速查手册（30 min）

在 `notes/inngest-cheatsheet.md` 里整理：

- **定义 function**：`createFunction(config, trigger, handler)`
- **Trigger 类型**：`{ event: 'name' }` / `{ cron: '...' }` / `{ event: 'name', if: 'event.data.x == 1' }`
- **Config 可选项**（过去两周用过的）：retries / concurrency / throttle / debounce / batchEvents / onFailure / priority / idempotency
- **Step 类型**：
  - `step.run(name, fn)` —— 持久化一个任务
  - `step.sleep(name, duration)` —— 睡一会儿
  - `step.sleepUntil(name, date)` —— 睡到某时间
  - `step.waitForEvent(name, { event, match, timeout })` —— 等外部 event（M5 Week 17 会深入）
  - `step.sendEvent(name, { name, data })` —— 在 function 内发新 event
- **常用模式**：webhook → send event → function、cron → 批处理、fan-out（一个 event 触发多个 function）
- **常用错误**：`NonRetriableError` / `RetryAfterError`

### Part 2 · 队列方案对比表（45 min）

在 `notes/queue-comparison.md` 里填：

| 维度 | Inngest | Trigger.dev | Temporal | BullMQ | AWS SQS + Step Functions |
|---|---|---|---|---|---|
| 部署模式 | SaaS / 自托管 | SaaS / 自托管 | 自托管为主 | 自托管（Redis） | AWS-only |
| 编程模型 | event-driven function | task + trigger | workflow + activity | queue + worker | queue + state machine |
| Durable execution | ✓ | ✓ | ✓ | ✗（手动实现） | ✓ |
| Step 级持久化 | ✓ | ✓ | ✓ | ✗ | ✓ |
| Serverless 友好 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐ |
| TypeScript DX | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐ |
| 多语言支持 | TS 为主 | TS 为主 | Go/Java/Python/TS | Node only | 任何 |
| 免费额度 | 5万 steps/月 | 5K runs/月 | 自托管无限 | 自托管无限 | AWS free tier |
| 学习曲线 | 低 | 低 | 高 | 中 | 高 |
| 适合场景 | 中小 agent 应用 | 中小应用 | 超长 / 超关键流程 | 简单 queue | AWS 生态 |
| 适合你现阶段 | ✓✓✓ | ✓ | ✗（过度） | ✗（不 serverless） | ✗（不 serverless） |

查文档填空。**这张表以后每次"该用什么队列"的问题直接查**。

### Part 3 · 自答题（45 min）

用语音或文字作答，不看资料：

1. **如果明天 Inngest 宣布停止运营，我怎么迁移？**
   - 数据：events 和 run history 存在 Inngest 云端，你能 export 吗？
   - 代码：function 定义能多通用？对 `inngest.createFunction` 的依赖有多深？
   - 替代：Trigger.dev 的 API 长什么样？迁移成本大概？
   - 这题的意义：理解**供应商锁定**的真实代价

2. **一个 agent 任务要跑 30 分钟，我该用 Inngest 还是别的？**
   - Vercel function 最长 5 分钟（Pro）—— 所以 agent 本身不能住在 function 里
   - Inngest 在每个 step 之间 suspend，每个 step 只要 <5 分钟就行
   - Temporal 更适合"人工介入 1 周后才继续"的超长流程
   - 结论：30 分钟用 Inngest 最顺手

3. **我的 agent 每分钟要调 100 次 LLM（不同用户），OpenAI 限 60/分钟，怎么办？**
   - 不能用 per-function 的 throttle（会饿死某些用户）
   - 正确做法：在 LLM 调用层抽象一个 rate limiter（Upstash ratelimit），每个调用 token 取不到就用 `throw new RetryAfterError` 让 Inngest 延迟重试
   - 这题的意义：**Inngest 不是你唯一的流控层**，业务层也要配合

### Part 4 · 写一页"inngest vs BullMQ"选型建议（30 min）

假设你是一个 team 的技术 lead，要给团队写个"新项目该用哪个队列"的 2 页建议。在 `notes/queue-decision-guide.md` 写出来。

框架：
- 3 条 "如果...那就用 A" 的判据
- 3 条 "如果...那就用 B" 的判据
- 如何避免锁定（抽象层设计）

## 今天结束能回答

- Durable execution 的核心特性是什么？它解决的是 "distributed system 里的哪个痛点"？
- Inngest 的 step 持久化和 PostgreSQL 的 WAL 有可类比之处吗？它们保证的是同一种东西吗？
- 什么情况下用 BullMQ 完全够用，上 Inngest 就是 over-engineering？举两个例子。

## 晚上 10 min

- `journal.md`：**今天最打动你的一个概念**
- commit 三份 notes
- 明天（Day 21）Week 3 收官复盘
