# Day 26 · 2026-06-02（周二）

> Week 4 · Streaming + 错误处理
> 今天 2-2.5h

## 今天学什么

**主题**：防滥用的两样基础武器 —— idempotency key + rate limit。

你的产品被人用起来后，两个现实问题会立刻出现：
1. **双重提交**：用户在 checkout 页连点两次按钮 —— 被收两次钱，你的后台也出两条订阅
2. **滥用 / DoS**：有人写脚本调你 API 一秒 100 次 —— 账单爆炸 / 服务挂掉

前者靠幂等（idempotency key），后者靠限流（rate limit）。这是**所有**面向公网的服务必须做的事。

## 核心概念

- **Idempotency 的定义**：同一操作执行 N 次和执行 1 次的效果一样。HTTP 里 GET / PUT / DELETE 天然幂等，POST / PATCH 不是。
- **Idempotency key 的工作流**：
  - 客户端生成 UUID（每次"逻辑操作"一个），随请求发给 server
  - Server 先查 `idempotency_keys` 表有没有这个 key
  - 有 → 直接返回上次的结果
  - 没 → 执行 + 把结果存进去 + 返回
- **为什么要存结果**：如果只存"这个 key 处理过"而不存结果，第二次请求你返回什么？返 200 还是重算一次？答案都不对 —— 要返回和第一次**完全一样**的 response
- **TTL 的考虑**：key 存永远会吃光 DB。一般 24-48 小时够用（用户不会一天后还重发同一操作）
- **Rate limit 三种算法**：
  - **Fixed window**：每分钟前 N 次允许。简单但边界不均匀（一分钟结束前 N 次 + 下一分钟开头 N 次 = 2N 次短时间内）
  - **Sliding window**：滑动窗口，精确但实现贵
  - **Token bucket**：令牌桶，允许突发但限制平均速率。最常用
- **Upstash Ratelimit 的实现**：背后是 Redis，支持 token bucket / sliding window / fixed window。一行 API 就能用
- **多层限流**：per-IP（防匿名攻击）+ per-user（防合法用户滥用）+ per-feature（某个贵的功能单独限）。同一个请求可能被多层限制

## 参考资源

- **[Stripe 的 idempotency 设计](https://docs.stripe.com/api/idempotent_requests)** — 10 min，业界金标准
- **[Upstash Ratelimit docs](https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted)** — 15 min
- **[Cloudflare: Rate limiting algorithms](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/)** — 可选 15 min，原理深度
- **[What every developer must know about idempotency](https://shopify.engineering/building-resilient-payment-systems)** — Shopify 工程博客，20 min

## 动手练习

### Part 1 · Idempotency key 表 + helper（40 min）

1. schema：
   ```ts
   export const idempotencyKeys = pgTable('idempotency_keys', {
     key: text('key').primaryKey(),
     userId: uuid('user_id'),
     operation: text('operation').notNull(),  // 用于区分不同动作
     result: jsonb('result'),  // 存上次的 response
     createdAt: timestamp('created_at').notNull().defaultNow(),
   })
   ```
   migrate。
2. `lib/idempotency.ts`：
   ```ts
   export async function withIdempotency<T>(
     key: string,
     operation: string,
     fn: () => Promise<T>,
     userId?: string
   ): Promise<T> {
     // 查是否已处理
     const [existing] = await db.select().from(idempotencyKeys)
       .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.operation, operation)))
       .limit(1)
     if (existing) return existing.result as T

     // 执行业务
     const result = await fn()

     // 存结果
     await db.insert(idempotencyKeys).values({ key, operation, result, userId })
       .onConflictDoNothing()  // 防并发重复提交

     return result
   }
   ```
3. 改 `createCheckoutSession`：
   ```ts
   export async function createCheckoutSession(idempotencyKey: string) {
     return wrapAction(() => withIdempotency(
       idempotencyKey,
       'stripe.checkout.create',
       async () => {
         const user = await requireUser()
         const session = await stripe.checkout.sessions.create({ /* ... */ })
         return { url: session.url! }
       },
       (await requireUser()).id
     ))
   }
   ```
4. 客户端生成 key 并传：
   ```tsx
   const [idempotencyKey] = useState(() => crypto.randomUUID())
   // 点击按钮时
   const result = await createCheckoutSession(idempotencyKey)
   ```
   **关键**：key 在 `useState` 里一次性生成，同一次 mount 期间复用 —— 所以双击按钮是同一个 key

### Part 2 · 清理过期 key 的 cron（15 min）

```ts
export const cleanupIdempotencyKeysFn = inngest.createFunction(
  { id: 'cleanup-idempotency-keys' },
  { cron: '0 3 * * *' },  // 每天凌晨 3 点
  async ({ step }) => {
    await step.run('delete-old', async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
      await db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, sevenDaysAgo))
    })
  }
)
```

### Part 3 · Upstash Ratelimit 接入（30 min）

1. 注册 Upstash → 创建 Redis db（免费 tier）
2. 配 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
3. `pnpm add @upstash/ratelimit @upstash/redis`
4. `lib/ratelimit.ts`：
   ```ts
   import { Ratelimit } from '@upstash/ratelimit'
   import { Redis } from '@upstash/redis'

   const redis = Redis.fromEnv()

   export const perUserLimit = new Ratelimit({
     redis,
     limiter: Ratelimit.slidingWindow(10, '1 m'),  // 每用户每分钟 10 次
     prefix: 'rl:per-user',
   })

   export const perIpLimit = new Ratelimit({
     redis,
     limiter: Ratelimit.slidingWindow(30, '1 m'),  // 每 IP 每分钟 30 次
     prefix: 'rl:per-ip',
   })

   export const costlyLimit = new Ratelimit({
     redis,
     limiter: Ratelimit.tokenBucket(5, '1 h', 10),  // 5/h + 突发 10（贵的功能）
     prefix: 'rl:costly',
   })
   ```

### Part 4 · 在 action / route 里用（30 min）

1. 写一个 helper：
   ```ts
   // lib/limits.ts
   export async function checkUserLimit(userId: string) {
     const { success, remaining, reset } = await perUserLimit.limit(userId)
     if (!success) throw new RateLimitError(`请稍后再试，${Math.ceil((reset - Date.now()) / 1000)}s 后可重试`)
   }
   ```
2. 在敏感 action 里调：
   - `createPost` → 每用户 10/min
   - `createCheckoutSession` → 每用户 3/min（防恶意创建 session）
   - `triggerHeavyJob` → 用 costlyLimit
3. 在 `/api/webhooks/stripe` 不加 rate limit（Stripe 自己控制）
4. 在所有公开 API（不需要 auth 的）加 per-IP
   ```ts
   const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'
   await checkIpLimit(ip)
   ```

### Part 5 · 测试（15 min）

- 快速重发同一个 idempotency key → 确认 Stripe dashboard 没出现两条 session
- 在 Postman / curl 一秒内发 15 次某 action → 看到 11 次开始返回 RateLimitError
- 看 Upstash dashboard 的 request chart

## 今天结束能回答

- 如果 `withIdempotency` 内部 `fn()` 执行到一半出错，key 记录应该写入吗？如果写入，下次重试就读到 null result，有什么问题？（提示：错误处理很微妙，Stripe 是怎么处理的？）
- Token bucket / sliding window / fixed window 三种算法，各自适合什么业务？
- 如果你的 rate limit 是 `per-user 10/min`，用户同一时刻连发 10 次 → 第 11 次被拒。但这 10 次到 server 是几乎并发的，Redis 能保证计数准确吗？（提示：原子操作 INCR + EXPIRE）
- 匿名用户（未登录）怎么做 rate limit？per-IP 之外还能怎么识别？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 27）Week 4 阶段 2 精读 —— SSE / Streams API / AbortSignal 规范通读
