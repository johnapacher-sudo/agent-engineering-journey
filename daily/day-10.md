# Day 10 · 2026-05-17（周日）

> Week 2 · Auth + Payment
> 今天 3-4h（周末深度日）

## 今天学什么

**主题**：支付不是"加个按钮 OK"—— 它是你的第一个**跨系统、异步、状态机**场景。

Stripe 不是发一次请求就拿到结果的 API。它背后是一个完整的订阅生命周期系统，你这边只能通过 **"发起 session + 监听 webhook"** 两条通道和它对话。今天上的是 Checkout（用户侧），明天 Day 11 上 webhook（同步状态）—— 两天合起来才是一个完整的支付闭环。

## 核心概念

- **Stripe 的三种模式**：
  - **Checkout** ⭐ 今天用：托管页面，用户跳过去付完跳回来。代码最少，PCI 合规 Stripe 帮你扛
  - **Payment Intent**：自己写付款 UI（用 Stripe Elements），控制力强但复杂
  - **Subscription**：订阅的业务概念，通常用 Checkout 的 `mode: 'subscription'` 发起
- **Test mode vs Live mode**：Stripe 的所有动作默认在 test mode，密钥以 `sk_test_` 开头。测试卡 `4242 4242 4242 4242` 永远成功。真实环境要切 live，key 会变。**今天只用 test mode**。
- **Price vs Product**：Stripe 里 Product 是商品定义（"Pro 订阅"），Price 是这个商品的具体价格（"$5/月"、"$50/年"是两个 Price 同一个 Product）。你代码里传的是 `priceId`，不是 `productId`。
- **`metadata` 字段**：Stripe 的 session / subscription / customer 都允许你带任意 `metadata`。强烈建议带你自己的 `userId` 和 `clerkId` —— 这样 webhook 回来你能立刻关联到你 DB 的用户。**不要带密码 / 敏感 PII**。
- **成功页的幻觉**：Checkout 付完跳 `success_url` 时，你**不能**在 success 页面立刻假设用户是 Pro —— subscription 状态要等 webhook 同步完才靠谱。success 页只能显示"付款已收到，处理中"。**真正的"你是 Pro" 状态变更在 Day 11 webhook**。

## 参考资源

- **[Stripe Checkout Docs](https://docs.stripe.com/payments/checkout)** — Integration Quickstart，15 min
- **[Stripe Subscriptions 概念](https://docs.stripe.com/billing/subscriptions/overview)** — 20 min
- **[Testing cards](https://docs.stripe.com/testing)** — 扫一眼知道有哪些测试场景

## 动手练习

1. **Stripe dashboard 准备**（test mode）：
   - Products → Create → "Agent Journey Pro"
   - 加一个 recurring price：$5 USD / month
   - 复制 Price ID（`price_xxx`）

2. **env 配置**：
   ```
   STRIPE_SECRET_KEY=sk_test_xxx
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   STRIPE_PRO_PRICE_ID=price_xxx
   ```

3. **`lib/stripe.ts`**：
   ```ts
   import Stripe from 'stripe'
   export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
     apiVersion: '2024-12-18.acacia',
   })
   ```

4. **Server Action** `actions/billing.ts`：
   ```ts
   'use server'
   export async function createCheckoutSession() {
     const user = await requireUser()
     const session = await stripe.checkout.sessions.create({
       mode: 'subscription',
       line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
       customer_email: user.email,
       metadata: { userId: user.id, clerkId: user.clerkId },
       success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
       cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
     })
     return { ok: true as const, url: session.url! }
   }
   ```

5. **`app/pricing/page.tsx`**：一个按钮，点击后 `const { url } = await createCheckoutSession(); window.location.href = url`

6. **`app/billing/success/page.tsx`**：简单显示"处理中...你将在 1 分钟内获得 Pro 权限"，**不要**在这里读 DB 或改 subscriptions 表

7. **`app/billing/cancel/page.tsx`**：显示"你取消了结账"

8. **跑一遍完整流程**：
   - 登录 → `/pricing` 点按钮 → 跳 Stripe 页面
   - 填测试卡 `4242 4242 4242 4242` / 任意未来日期 / 任意 CVC
   - 付款成功 → 跳你的 success 页
   - 打开 Stripe dashboard → Customers → 应该能看到一条测试订阅

**卡点思考**：
- 如果 `metadata` 里 userId 传错了（比如拿了别人的 id），你的系统会出什么问题？防御方案？
- 用户在 Stripe 页面付到一半关闭浏览器，Stripe 会发什么 event？你的 DB 会怎么样？
- `success_url` 里带 `{CHECKOUT_SESSION_ID}` 占位符，Stripe 会替换成什么？客户端能直接用这个 id 查状态吗？

## 今天结束能回答

- Checkout / Payment Intent / Subscription 三种 Stripe 模式，什么场景选哪个？给三个具体例子。
- 为什么"付款完跳回 success 页"时你不能直接把 user 标为 Pro？如果一定要立刻显示"你是 Pro"，正确姿势是什么？
- `metadata` 字段大小限制是多少？存什么合适，存什么会后悔？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 11）才是重头戏 —— webhook 把 Stripe 的状态同步回你 DB，让"你是 Pro"这个事实真正落地
