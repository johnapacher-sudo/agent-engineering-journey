# Day 11 · 2026-05-18（周一）

> Week 2 · Auth + Payment
> 今天 2-2.5h

## 今天学什么

**主题**：Webhook 是支付系统的"真相源头"—— 以及 DB 状态机如何忠实反映外部系统。

Day 10 上了 Checkout，用户侧闭环了。但你 DB 里还没有 "这个 user 是 Pro" 的记录 —— 因为你根本不应该在 success 页面写 DB（那里不可靠）。**所有订阅状态变更只能由 Stripe webhook 触发**。今天把这个通道打通。

## 核心概念

- **为什么 webhook 才是真相**：Stripe 那边状态变化（付款成功、卡过期、用户取消、自动续费）不是"用户点按钮触发"，是**时间触发 / 外部事件触发**。你必须订阅这些事件，否则状态会漂移。
- **4 个核心订阅事件**：
  - `customer.subscription.created` — 新订阅成立
  - `customer.subscription.updated` — status / 周期 / 定价变化
  - `customer.subscription.deleted` — 订阅结束（到期 / 立即取消）
  - `invoice.paid` — 成功续费（月度、年度扣款成功）
  - 还有其他几十种事件，但这 4 个是订阅业务的核心
- **Status 状态机**：
  - `incomplete` → 首次付款失败，宽限期
  - `trialing` → 试用中（如果你设了 trial）
  - `active` → 正常付费中 ✓ isPro = true
  - `past_due` → 续费失败但还在尝试（通常 3-7 天）
  - `canceled` → 已取消（可能立刻失效，也可能到 period end）
  - `unpaid` → 多次续费失败，已停止
  - `paused` → 手动暂停（少见）
- **Signature verification**：和 Clerk 一样，Stripe 也签名。用 `stripe.webhooks.constructEvent(rawBody, signature, secret)`。**一定要用 raw body**，不是 parsed JSON —— 签名是基于原始字节算的。
- **幂等是必需品**：Stripe 保证 "at-least-once delivery"，同一个 event 可能重发。你的代码必须 `event.id` 去重，或者"写操作设计成幂等"（多次执行结果一样）。
- **`cancel_at_period_end` vs 立即取消**：默认取消是"周期末失效"（用户还能用到月底），体验好；立即取消要主动调 API 且退款。**取消后 status 还是 `active` 直到周期末**，这点很多人踩坑。

## 参考资源

- **[Stripe Webhooks 官方指南](https://docs.stripe.com/webhooks)** — 20 min，重点看 signature 和 retry
- **[Subscription lifecycle](https://docs.stripe.com/billing/subscriptions/overview#subscription-lifecycle)** — 状态机图，打印贴墙上
- **[Stripe CLI](https://docs.stripe.com/stripe-cli)** — 安装它，`stripe listen --forward-to` 是本地测 webhook 的神器

## 动手练习

1. **schema 加 subscriptions 表**：
   ```ts
   export const subscriptions = pgTable('subscriptions', {
     id: uuid('id').primaryKey().defaultRandom(),
     userId: uuid('user_id').notNull().references(() => users.id),
     stripeCustomerId: text('stripe_customer_id').notNull(),
     stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
     priceId: text('price_id').notNull(),
     status: text('status').notNull(),
     currentPeriodStart: timestamp('current_period_start').notNull(),
     currentPeriodEnd: timestamp('current_period_end').notNull(),
     cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
     createdAt: timestamp('created_at').notNull().defaultNow(),
     updatedAt: timestamp('updated_at').notNull().defaultNow(),
   })
   ```
   migrate。

2. **处理事件 helper** `lib/stripe-handlers.ts`：
   ```ts
   export async function upsertSubscriptionFromStripe(stripeSub: Stripe.Subscription) {
     const userId = stripeSub.metadata.userId // 关联你 DB 的 userId
     await db.insert(subscriptions).values({
       userId, stripeSubscriptionId: stripeSub.id, /* ... */
     }).onConflictDoUpdate({
       target: subscriptions.stripeSubscriptionId,
       set: { status: stripeSub.status, /* ... */ updatedAt: new Date() },
     })
   }
   ```
   upsert 就是 Day 6 学的 `ON CONFLICT DO UPDATE` —— 天然幂等。

3. **Webhook route** `app/api/webhooks/stripe/route.ts`：
   ```ts
   export async function POST(req: Request) {
     const body = await req.text() // 必须 text()，不是 json()
     const sig = req.headers.get('stripe-signature')!
     let event: Stripe.Event
     try {
       event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
     } catch (err) {
       return new Response('invalid signature', { status: 400 })
     }
     switch (event.type) {
       case 'customer.subscription.created':
       case 'customer.subscription.updated':
       case 'customer.subscription.deleted':
         await upsertSubscriptionFromStripe(event.data.object)
         break
       case 'invoice.paid':
         // 续费成功，更新 currentPeriodEnd
         break
     }
     return new Response('ok')
   }
   ```

4. **本地跑 Stripe CLI**（不用 ngrok 了，Stripe 自己有转发）：
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   CLI 会输出 `whsec_xxx` —— 这是本地 webhook secret，写到 `.env.local` 的 `STRIPE_WEBHOOK_SECRET`

5. **触发每种 event 验证**：
   - 真跑一次 Checkout → 应该触发 `subscription.created`
   - Stripe dashboard → Subscriptions → 取消一个 → 触发 `subscription.updated`（cancel_at_period_end=true）
   - 也可以用 `stripe trigger customer.subscription.deleted` 强触发
   - 每种都看 DB subscriptions 表的变化是不是对

6. **生产部署**：Stripe dashboard → Developers → Webhooks → Add endpoint `https://yourdomain.com/api/webhooks/stripe` → 勾上 4 个事件 → 复制生产 webhook secret 到 Vercel env

**卡点思考**：
- 如果 `event.data.object.metadata.userId` 是空的（比如 Checkout 时你忘了传），webhook handler 怎么救？
- 你返回 500 时 Stripe 会重试，重试到第几次放弃？（提示：官方文档有答案，3 天）
- 同时处理 10 个 webhook，同一个 userId 的 `subscription.updated` 和 `invoice.paid` 并发到达，会产生什么竞态？

## 今天结束能回答

- 画一次订阅的完整生命周期状态机：从用户点 Checkout 按钮到订阅到期，经历了哪些 status 和 event？
- 为什么 webhook handler 必须幂等？不幂等会在什么场景出现问题？
- 如果你部署了但忘配 production webhook，会出什么症状？用户付了钱但应用里不认？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 12）用 subscriptions 表做 `isPro(userId)` + paywall，把"付费用户专属"落地
