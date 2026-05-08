# Day 21 · 2026-05-28（周四）

> Week 3 · 队列与事件驱动（Inngest）
> 今天 1.5-2h · **周复盘日**

## 今天学什么

**主题**：Week 3 收官。

Week 1 有了数据，Week 2 有了用户，Week 3 有了**时间**—— 你的系统现在能做延时、定时、重试、失败兜底的事情。这是 agent 长任务的基础设施。M5 Week 17 的"长任务架构"就是在 Week 3 的基础上加上"人工介入 / 取消 / resume"。

## 核心概念

今天要完成的心智动作：

- **产出验收**：Week 3 的 checklist 全部指出来
- **口述三题**：step 幂等、flow control 判据、失败恢复全流程
- **模式提取**：过去三周反复出现的三个模式是什么？
- **Week 4 预判**：streaming + 错误处理，Week 3 哪些能力会复用

## 动手练习

### Part 1 · 产出验收（25 min）

对照 Week 3 最低产出：

**基础**
- [ ] Inngest dev + cloud 都能跑
- [ ] `/api/inngest` route 注册了至少 5 个 function

**事件驱动**
- [ ] Clerk webhook 发 `user/created` event
- [ ] `send-welcome-drip` function 含 `step.sleep`，真实收到两封邮件

**错误处理**
- [ ] 有至少一个 function 配了 `retries` 和 `onFailure`
- [ ] `alerts` 表 + `/admin/alerts` 页能看到失败记录
- [ ] 用过 `NonRetriableError` 至少一次

**流控**
- [ ] cron / concurrency / throttle / debounce / batchEvents 五种各写过一个 demo（或至少读过 docs 说得清）

**真实 pipeline**
- [ ] 图片上传 → 缩略图 → OCR（mock）→ 通知 端到端跑通
- [ ] 生产 Vercel + Inngest Cloud 跑过至少一次
- [ ] `uploads` 表 status 能被 UI 实时反映

**笔记**
- [ ] `notes/inngest-cheatsheet.md`
- [ ] `notes/queue-comparison.md`
- [ ] `notes/queue-decision-guide.md`

### Part 2 · 口述三题（30 min）

合上文档，每题至少 4 分钟：

1. **解释 `step.run` 的幂等机制**
   - 为什么重试时 step 1 不再重跑？
   - 这个持久化的粒度是什么？存哪？
   - 如果你在 step.run 里用了 `Math.random()`，重试时是新随机数还是缓存值？
   - Vercel 重新部署会影响正在跑的 function 吗？

2. **讲清 flow control 5 种的选择判据**
   - 每一种举**两个具体业务场景**
   - 哪两个可以组合？哪两个冲突？
   - 如果你的 LLM 调用需要"每个 user 最多 2 个并行 + 全局每分钟 60 次"，怎么配？

3. **画一次完整 pipeline 的失败恢复流程**
   - 从 `image/uploaded` event 发出到最终 `uploads.status = done`
   - 假设 step 3（OCR）第一次失败、第二次失败、第三次成功，整个流程经历了什么？
   - 假设三次都失败，`onFailure` 怎么被触发？DB 最终状态？
   - 假设 step 3 成功但 Vercel 在 step 4 之前重新部署，恢复后从哪里继续？

### Part 3 · 提取三周模式（20 min）

在 `notes/patterns.md` 追加 Week 3 学到的模式：

**模式 4：异步任务的三段式结构**
- 触发：某个 event / webhook / cron
- 同步入口：立刻写一条"pending"记录 + 发 Inngest event → 立刻返回
- 异步执行：function 做真正的工作 → 改状态 → 通知用户
- UI 观察状态表，不直接等结果

**模式 5：Step 拆分原则**
- 每一步对应一次外部 IO（HTTP / DB / 文件）
- 不要一个 step 干多个 IO（失败时粒度太粗）
- 不要一个 step 只干纯计算（失败时没必要持久化）
- 原则：能独立重试的工作单元 = 一个 step

**模式 6：失败的四层处理**
- Step 内部：retriable error `throw`，non-retriable `NonRetriableError`
- Function 配置：`retries: N`
- Function 兜底：`onFailure` 写 alerts
- 业务补偿：alerts 表被人工或另一个 cron function 处理

### Part 4 · 周复盘（25 min）

`notes/week-03-retro.md`（沿用模板）：

- 完成度 / 欠债
- 核心学到的 3 件事
- 踩的 3 个坑 + 共同根源
- 浪费时间的 1 件事
- **阶段评估**：Inngest 阶段 1/2 ✓，阶段 3 ✗（对齐 ROADMAP）；React Email 阶段 1 ✓；Vercel Blob 阶段 1 ✓
- Week 4 预判：streaming + 错误处理 + ratelimit。会用到：
  - Week 3 的异步任务状态（UI 流式显示 status）
  - Week 2 的错误体系（抛错分类）
  - Week 1 的 `idempotency_keys` 表设计

### Part 5 · Week 3 的一个反思（15 min）

今天写一段反思，不是复盘：

**"我理解了 Inngest 的 step 持久化后，这个心智模型还能用在哪？"**

提示：
- LLM agent 的 tool use loop 其实就是 step 序列（M2 Week 6 会手写一个）
- Anthropic 的 computer use 也是类似的 "每一步持久化状态" 思路
- 任何"可恢复的长流程"背后都是 durable execution

这种**把一个技术的核心概念提炼到抽象层**的思考，是从"会用"走向"会判断"的关键动作。今天每周五做一次。

## 今天结束能回答

- Week 3 学到的**最通用的心智模型**是什么？它和 "事务" 有什么联系？
- 如果让你给前端同事讲"前端工程师 1 周上手 agent 异步基础设施"，你的**大纲**是什么？
- 进入 Week 4 前，你还有什么顾虑 / 想补的？

## 晚上 10 min

- `journal.md` 最后一行：**Week 3 完成，Week 4 预备**
- push 所有 `notes/`
- 休息
- 明天（Day 22）Week 4 Day 1：手写 SSE。这是 M2-M6 每一次 LLM streaming 的底层能力
