# Day 17 · 2026-05-24（周日）

> Week 3 · 队列与事件驱动（Inngest）
> 今天 3-4h（周末深度日）

## 今天学什么

**主题**：生产系统里失败是常态，不是异常 —— 如何设计"失败了也能自愈"的异步流程。

Day 16 的欢迎邮件是 happy path。今天故意制造失败，观察 Inngest 的重试、step 幂等、失败兜底机制。这些模式在 M2-M6 都会重现（LLM 调用失败重试、tool 执行失败兜底、agent 循环异常恢复）。

## 核心概念

- **错误的两类**：
  - **Retriable**：网络抖动、第三方 API 限流、数据库连接瞬断 —— 再试一次可能就过
  - **Non-retriable**：参数错误、用户被删、业务约束冲突 —— 再试多少次都一样
  - Inngest 默认所有 throw 都重试 3 次，指数退避。你用 `NonRetriableError` 明确标记"别试了"
- **`step.run` 的幂等保证**：
  - 每个 step 有个 **name**（第一个参数）
  - Inngest 把 step name + 结果持久化
  - 重试整个 function 时：**已成功的 step 直接读缓存，不重跑**
  - 这要求你的 step name 在 function 内唯一，而且不随调用次数变（别用随机串）
- **`onFailure` handler**：function 最终失败（所有重试都用完）后触发的兜底函数。典型用途：写 DB `alerts` 表、发 Slack 通知、降级方案
- **死信队列（DLQ）的思想**：最终失败的任务不该消失，要存起来供人工处理。`onFailure` + alerts 表就是你的 DLQ
- **batch function**：一次处理 100 条的任务不要写成一个大 step，拆成 10 个 step 每个处理 10 条 —— 中间失败时只重跑失败的那 10 条
- **`retries` 参数**：function 级别可以覆盖默认重试次数 / 策略 / 最大时长

## 参考资源

- **[Inngest: Errors and Retries](https://www.inngest.com/docs/guides/error-handling)** — 20 min
- **[Inngest: NonRetriableError](https://www.inngest.com/docs/reference/typescript/functions/errors)** — 5 min
- **[Inngest: `onFailure`](https://www.inngest.com/docs/reference/typescript/functions/handling-failures)** — 10 min
- **[Google SRE Book Ch.22 "Handling Overload"](https://sre.google/sre-book/handling-overload/)** — 可选 15 min，理解分布式系统里的失败

## 动手练习

### Part 1 · 制造可重试失败（40 min）

1. 加一个故意失败的 function `src/inngest/functions/flaky.ts`：
   ```ts
   export const flakyFn = inngest.createFunction(
     { id: 'flaky-demo', retries: 4 },
     { event: 'test/flaky' },
     async ({ event, step }) => {
       const result = await step.run('random-work', async () => {
         if (Math.random() < 0.7) throw new Error('random fail 70%')
         return { success: true }
       })
       return result
     }
   )
   ```
2. 触发几次 event，观察 Inngest UI：
   - 看到每次 run 的 retry 次数
   - 注意重试间隔（指数退避：~10s, 30s, 2m...）
   - 看 4 次后依然失败的 run 最终状态是 "Failed"

### Part 2 · 区分 retriable / non-retriable（30 min）

改 flakyFn：

```ts
import { NonRetriableError } from 'inngest'

const result = await step.run('validated-work', async () => {
  if (!event.data.userId) {
    throw new NonRetriableError('userId required')  // 立即放弃，不重试
  }
  if (Math.random() < 0.5) {
    throw new Error('transient fail')  // 会重试
  }
  return { success: true }
})
```

触发两种 event，对比：
- `{ userId: null }` → 立即失败，status 标记为 Failed，**没有**重试记录
- `{ userId: 'abc' }` → 50% 触发重试链

### Part 3 · 多 step 幂等验证（30 min）

```ts
export const multistepFn = inngest.createFunction(
  { id: 'multistep-demo' },
  { event: 'test/multistep' },
  async ({ event, step }) => {
    const a = await step.run('step-a', async () => {
      console.log('[A] running at', new Date().toISOString())
      return { randomNum: Math.random() }
    })

    const b = await step.run('step-b', async () => {
      console.log('[B] running at', new Date().toISOString())
      if (Math.random() < 0.7) throw new Error('b failed')
      return { computed: a.randomNum * 2 }
    })

    return { a, b }
  }
)
```

触发一次，在 console 观察：
- step A 打印一次（第一次 run）
- step B 打印多次（重试）
- 重试时**step A 不再打印** —— 证明结果被缓存
- **更重要**：每次重试时 `a.randomNum` 的值一样 —— Inngest 从持久化读回，不重新执行

这是 Inngest 的核心魔法。理解到位了，后面 agent 长任务的 checkpoint 你就不怕了。

### Part 4 · `onFailure` 兜底（45 min）

1. schema 加 `alerts` 表：
   ```ts
   export const alerts = pgTable('alerts', {
     id: uuid('id').primaryKey().defaultRandom(),
     kind: text('kind').notNull(),
     message: text('message').notNull(),
     runId: text('run_id'),
     payload: jsonb('payload'),
     createdAt: timestamp('created_at').notNull().defaultNow(),
   })
   ```
2. 给 flakyFn 加 `onFailure`：
   ```ts
   export const flakyFn = inngest.createFunction(
     {
       id: 'flaky-demo',
       retries: 4,
       onFailure: async ({ event, error, runId }) => {
         await db.insert(alerts).values({
           kind: 'function-failed',
           message: error.message,
           runId,
           payload: event,
         })
       },
     },
     // ...
   )
   ```
3. 触发失败 event，看 alerts 表有没有记录
4. 给 `/admin` 页加一个简单的 alerts 列表

### Part 5 · Batch function（30 min）

场景：你想每天清理一次 100 条过期 draft post。一个 step 处理 100 条 vs 10 个 step 每个处理 10 条，哪个更稳？

写一个简单版：
```ts
export const cleanupFn = inngest.createFunction(
  { id: 'cleanup-drafts' },
  { event: 'cron/cleanup-drafts' },
  async ({ step }) => {
    const drafts = await step.run('fetch-drafts', () =>
      db.select().from(posts).where(/* status='draft' AND createdAt < 30天前 */)
    )
    const batches = chunk(drafts, 10) // lodash / 自己写
    for (const [i, batch] of batches.entries()) {
      await step.run(`delete-batch-${i}`, async () => {
        await db.delete(posts).where(inArray(posts.id, batch.map(b => b.id)))
      })
    }
  }
)
```

试着让 `delete-batch-3` 故意失败，观察重试时前 3 个 batch 是否被重删（不会）。

## 今天结束能回答

- Inngest 的 step 幂等性是通过什么机制实现的？如果你在 step.run 里用了 `Math.random()`，重试时会是新随机数还是缓存值？为什么？
- 什么场景该 throw 普通 Error（让它重试），什么场景该 throw NonRetriableError？给 5 个具体例子。
- 一个长 function 跑到 step 5/10 时 Vercel 重新部署了，重启后会从头开始还是从 step 5 继续？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 18）上 flow control —— cron / concurrency / throttle / debounce / batch
