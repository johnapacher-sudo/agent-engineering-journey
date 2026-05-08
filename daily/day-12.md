# Day 12 · 2026-05-19（周二）

> Week 2 · Auth + Payment
> 今天 2-2.5h

## 今天学什么

**主题**：把订阅状态"变现"为产品能力边界 —— paywall 设计 + Stripe Customer Portal。

Day 11 webhook 把订阅同步到了 DB，但 DB 里有 status 不等于产品里有区分。今天做两件事：**`isPro(userId)` helper（付费判定的唯一入口）** 和 **Customer Portal（让用户自助管理订阅）**。后者是你作为产品方**不应该**自己写的东西 —— Stripe 提供托管 UI，你只要生成 session URL。

## 核心概念

- **"付费"不是一个布尔值**，它是一个复合判断：
  - 有 subscription 记录
  - status 是 `active` 或 `trialing`
  - `currentPeriodEnd > now()`（还没过期）
  - 这三个条件缺一不可，任何一个不满足都不算 Pro
- **Grace period（宽限期）**：用户 7 天前取消订阅（`cancel_at_period_end=true`），但 period end 还有 10 天 —— 这期间**依然是 Pro**。这是业界标准做法，体验好。
- **Paywall 的三种放法**：
  1. **Feature paywall**：某个按钮/页面直接不让非 Pro 看（"导出 PDF"）
  2. **Usage paywall**：免费额度（"每月 10 次 AI 调用"），超了才挡
  3. **Time paywall**：试用 7 天后挡（要结合 trial period 实现）
  - 三种不互斥，可以组合。Agent 产品常用 2（LLM 成本敏感）
- **Customer Portal 的意义**：让用户自助取消、换卡、换套餐、下载发票。你不写这些 UI —— Stripe 给你一个托管页，你调 `stripe.billingPortal.sessions.create({ customer })` 拿 URL，跳过去。
- **取消后的 UX**：永远让用户能用到 `currentPeriodEnd`，不要立刻撤销访问。这一条是**用户体验红线**。

## 参考资源

- **[Customer Portal](https://docs.stripe.com/customer-management)** — 15 min，理解配置
- **[`cancel_at_period_end` 语义](https://docs.stripe.com/api/subscriptions/cancel)** — 10 min
- **[Lenny Rachitsky: Paywall design](https://www.lennysnewsletter.com/p/paywall-design)** — 可选，产品侧视角

## 动手练习

1. **`isPro` helper** `lib/subscription.ts`：
   ```ts
   import { db } from '@/db'
   import { subscriptions } from '@/db/schema'
   import { and, eq, gt, inArray } from 'drizzle-orm'

   export async function isPro(userId: string): Promise<boolean> {
     const [sub] = await db
       .select()
       .from(subscriptions)
       .where(
         and(
           eq(subscriptions.userId, userId),
           inArray(subscriptions.status, ['active', 'trialing']),
           gt(subscriptions.currentPeriodEnd, new Date())
         )
       )
       .limit(1)
     return !!sub
   }
   ```
   **重要**：所有 paywall 判断都调这一个函数，别在业务代码里自己组合 status 条件。

2. **写简单的单测**：
   - 构造 3 条 subscriptions：active 未过期 / canceled 未到 period end / active 已过期
   - 各自 assert `isPro()` 的返回值
   - 不用测试框架也行，写个 `scripts/test-is-pro.ts` 手动跑

3. **Billing Portal Server Action**：
   ```ts
   'use server'
   export async function createBillingPortalSession() {
     const user = await requireUser()
     const [sub] = await db.select().from(subscriptions)
       .where(eq(subscriptions.userId, user.id)).limit(1)
     if (!sub) throw new Error('no subscription')
     const portal = await stripe.billingPortal.sessions.create({
       customer: sub.stripeCustomerId,
       return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
     })
     return { ok: true as const, url: portal.url }
   }
   ```

4. **`/account` 页**：
   - 显示订阅状态：`isPro ? 'Pro · 下次续费 YYYY-MM-DD' : 'Free'`
   - 如果 Pro：显示"管理订阅"按钮 → 跳 billing portal
   - 如果 Free：显示"升级"按钮 → 跳 `/pricing`

5. **三处 paywall 落地**：选三个现有功能加门槛：
   - **Feature**：`/posts/[id]/export-pdf` 路由 `requireUser()` 之后 `if (!await isPro(user.id)) redirect('/pricing')`
   - **Usage**：`createPost` 里加限制 —— 非 Pro 一天只能发 3 条（用 `sql` 查今天的 count）
   - **UI 提示**：list 页顶部，非 Pro 显示一个小 banner "升级 Pro 解锁无限发布"

6. **走一遍完整流程验证**：
   - 注册新账号（Free）→ 尝试 export-pdf → 跳 pricing
   - 订阅 Pro（测试卡）→ 等 webhook 同步 → 再试 export-pdf → 能用
   - 在 `/account` 点"管理订阅"→ Stripe 托管页取消 → 回来 → 此时 `isPro` 应该还是 true（因为 period 还没结束）
   - 手动改 DB 把 currentPeriodEnd 改成昨天 → `isPro` 变 false → export-pdf 被挡

**卡点思考**：
- 为什么 `isPro` 要查 DB，不能从 Clerk session 读？（提示：session 里的数据刷新频率低，订阅状态变更需要立刻生效）
- Billing portal 的 `return_url` 设错了会怎样？用户体验会多糟？
- 如果 `subscriptions` 表里有多条记录（历史订阅都留着），`isPro` 怎么保证不被历史记录污染？

## 今天结束能回答

- 画一个"用户取消订阅"的时间线：从点击到彻底失去访问权，中间经历了什么、多长时间？你的代码在哪几个时间点被触发？
- 三种 paywall 各自什么场景合适？同一个产品能用几种？冲突怎么调和？
- 为什么 Customer Portal 是你**不应该**自己写的东西？自己写有什么风险？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 13）是本周**阶段 2 精读日** —— Stripe / Clerk docs 系统过一遍，画状态机图
