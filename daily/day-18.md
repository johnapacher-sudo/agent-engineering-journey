# Day 18 · 2026-05-25（周一）

> Week 3 · 队列与事件驱动（Inngest）
> 今天 2-2.5h

## 今天学什么

**主题**：流量控制的 5 种武器 —— cron / concurrency / throttle / debounce / batch。

前几天我们处理的是"单个任务"的执行。今天换视角：**一堆任务同时涌进来怎么办？** 这是生产系统的真实场景 —— LLM API 有 rate limit、DB 不能被打爆、外部服务有配额。Inngest 把 5 种流控模式封装到 function 配置里，你只要**选对**，不用自己实现。

## 核心概念

- **Cron**：按时间表触发。
  - 用法：`{ cron: '0 2 * * *' }`（每天凌晨 2 点）
  - 场景：清理过期数据、生成日报、定时嵌入新文档
- **Concurrency**：限制**同时**运行的 function 实例数。
  - 全局：一次只跑 1 个（防资源抢占）
  - 按 key：同一个 `userId` 只跑 1 个，但不同 userId 可以并行
  - 场景：避免用户 A 连发 10 个 LLM 请求挤占额度
- **Throttle**：限制**速率**（每分钟 N 个）。超出的排队。
  - 用法：`{ throttle: { limit: 5, period: '1m' } }`
  - 场景：第三方 API 有 rate limit（Stripe 100/秒、OpenAI 500/分钟）
- **Debounce**：短时间内多次触发只执行最后一次。
  - 用法：`{ debounce: { period: '5s', key: 'event.data.userId' } }`
  - 场景：用户连续改 10 次文档设置，只在停止 5 秒后做一次索引更新
- **Batch**：累积 N 个 event 或 N 秒超时后一起处理。
  - 用法：`{ batchEvents: { maxSize: 10, timeout: '10s' } }`
  - 场景：10 个用户同时点赞，一次批量写 DB 比 10 次快得多

### 选择判据

| 场景 | 用什么 |
|---|---|
| "每天" / "每小时" | cron |
| "不要让用户 A 同时跑 2 个任务" | concurrency（按 userId） |
| "不要超过外部 API rate limit" | throttle |
| "等用户停下来再执行" | debounce |
| "凑够一把一起干比一件件干便宜" | batchEvents |

注意：这些可以**组合**。一个 function 可以同时有 concurrency + throttle。

## 参考资源

- **[Inngest: Flow Control Overview](https://www.inngest.com/docs/guides/flow-control)** — 15 min
- **[Concurrency](https://www.inngest.com/docs/guides/concurrency)** — 15 min
- **[Throttle](https://www.inngest.com/docs/guides/throttling)** — 10 min
- **[Debounce](https://www.inngest.com/docs/guides/debounce)** — 10 min
- **[Batching](https://www.inngest.com/docs/guides/batching)** — 10 min

## 动手练习

今天每种机制写一个最小 demo function，触发 event 观察行为。目标是**看到差异**，不是把所有功能堆进一个项目。

### Part 1 · Cron（20 min）

```ts
export const dailyCleanupFn = inngest.createFunction(
  { id: 'daily-cleanup' },
  { cron: 'TZ=Asia/Shanghai 0 2 * * *' },  // 每天凌晨 2 点
  async ({ step }) => {
    await step.run('cleanup', async () => {
      const result = await db.delete(posts).where(
        and(eq(posts.status, 'draft'), lt(posts.createdAt, thirtyDaysAgo()))
      )
      return { deleted: result.rowCount }
    })
  }
)
```

本地测试技巧：改 cron 成每分钟 `* * * * *`，重启 dev server 等 1 分钟观察。

### Part 2 · Concurrency（20 min）

```ts
export const userJobFn = inngest.createFunction(
  {
    id: 'user-job',
    concurrency: { limit: 1, key: 'event.data.userId' },
  },
  { event: 'user/job' },
  async ({ event, step }) => {
    await step.run('work', async () => {
      console.log(`[${event.data.userId}] starting at ${new Date().toISOString()}`)
      await new Promise(r => setTimeout(r, 5000))
      console.log(`[${event.data.userId}] done at ${new Date().toISOString()}`)
    })
  }
)
```

测试：快速连发 3 个 event（相同 userId）和 3 个 event（不同 userId），观察 Inngest UI 里 run 的执行时间线：
- 相同 userId：串行（一个完了下一个才开始）
- 不同 userId：并行

### Part 3 · Throttle（15 min）

```ts
export const externalApiFn = inngest.createFunction(
  {
    id: 'call-external',
    throttle: { limit: 5, period: '1m' },
  },
  { event: 'external/call' },
  async ({ event, step }) => {
    await step.run('call', async () => {
      console.log(`[call ${event.data.n}] at ${new Date().toISOString()}`)
    })
  }
)
```

一次性发 20 个 event，观察：前 5 个立刻执行，剩下的排队每分钟执行 5 个。

### Part 4 · Debounce（15 min）

```ts
export const autoSaveFn = inngest.createFunction(
  {
    id: 'auto-save',
    debounce: { period: '5s', key: 'event.data.docId' },
  },
  { event: 'doc/changed' },
  async ({ event, step }) => {
    console.log(`saving doc ${event.data.docId} with content: ${event.data.content}`)
  }
)
```

连发 5 个 event（相同 docId，content 不同），间隔 1 秒：观察只有最后一个 event 的 content 被处理。

### Part 5 · Batch（20 min）

```ts
export const collectLikesFn = inngest.createFunction(
  {
    id: 'collect-likes',
    batchEvents: { maxSize: 5, timeout: '10s' },
  },
  { event: 'post/liked' },
  async ({ events, step }) => {
    console.log(`processing ${events.length} likes at once`)
    // events 是 event 数组，不是单个
    await step.run('batch-insert', async () => {
      // 一次 SQL 批量写入
    })
  }
)
```

发 3 个 event 等 10 秒 → batch 触发（timeout 到了）
发 5 个 event 立刻 → batch 触发（maxSize 到了）

### Part 6 · 组合（10 min）

让 `externalApiFn` 同时配 concurrency（limit 2 per user）+ throttle（全局 5/分钟）：

```ts
{
  id: 'call-external',
  concurrency: { limit: 2, key: 'event.data.userId' },
  throttle: { limit: 5, period: '1m' },
}
```

思考：这两个约束怎么互相作用？（答：取交集，两个限制都必须满足）

## 今天结束能回答

- Concurrency `{ limit: 1 }` 不带 key 和 `{ limit: 1, key: 'userId' }` 有什么差异？什么场景选哪个？
- Throttle 和 Concurrency 都能"限流"，本质差别是什么？
- Debounce 怎么决定"要不要保留之前的事件"？如果 event A 3 秒前到达，event B 1 秒前到达，最终处理的是哪个？
- 你的 Resend 邮件发送（假设有 1000/小时限额），应该配 throttle 还是 concurrency？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 19）把所有武器用上 —— 做一个完整的图片上传 → 缩略图 → OCR → 通知 pipeline
