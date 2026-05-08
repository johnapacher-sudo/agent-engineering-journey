# Day 16 · 2026-05-23（周六）

> Week 3 · 队列与事件驱动（Inngest）
> 今天 3-4h（周末深度日）

## 今天学什么

**主题**：第一个真实的 event-driven 工作流 —— 用户注册触发"欢迎邮件 + 5 分钟后 tips 邮件"。

昨天只是 hello world，今天做一个**跨系统、跨时间**的流程：Clerk webhook → Inngest event → 多 step function（含 sleep）→ Resend 发邮件。这个形状是 M3-M6 的所有 agent 工作流的雏形（上传文件 → 嵌入 → 索引 → 通知）。

## 核心概念

- **Webhook → Event 的转换**：收到 Clerk webhook 不要直接在 webhook handler 里做业务（发邮件等），应该**立刻 `inngest.send()` 发个 event 就返回**。为什么：webhook handler 要快（Clerk 有超时），重试策略归 Inngest 管，业务逻辑和网络 IO 解耦。
- **`step.sleep` 的魔法**：`await step.sleep('wait', '5m')` —— function 看起来在睡 5 分钟，其实 Inngest 在云端 suspend 了这个 function，5 分钟后再 resume。**你的 Vercel function 不占一秒资源**。传统 `setTimeout` 做不到这件事（setTimeout 需要常驻进程）。
- **Step 持久化的意义**：欢迎邮件已经发了，5 分钟后的 tips 邮件发送失败 —— Inngest 重试时**不会重发欢迎邮件**，它知道 step 1 已成功。这是 `step.run` 的核心价值。
- **Email 模板的组件化**：React Email / `@react-email/components` 让你用 JSX 写邮件模板，预览方便、样式兼容性好。和你写 Next.js 组件是一个心智。
- **延迟邮件的产品语义**：
  - 立即发送 "欢迎"：确认账号已创建
  - 5 分钟后发 "tips"：用户可能还在用产品，这封邮件在用户注意力还在时到达
  - 24 小时后发 "你好像没怎么用"：挽回沉默用户
  - 这套叫 **drip campaign**，每一滴都是 `step.sleep` + `step.run`

## 参考资源

- **[Inngest: Sending Events](https://www.inngest.com/docs/events/sending-events)** — 10 min
- **[Inngest: `step.sleep`](https://www.inngest.com/docs/reference/functions/step-sleep)** — 10 min
- **[Resend Next.js Guide](https://resend.com/docs/send-with-nextjs)** — 10 min
- **[React Email](https://react.email/docs/introduction)** — 15 min，组件速查

## 动手练习

### Part 1 · 接入 Resend（30 min）

1. 注册 Resend → 验证一个域名（或用 `onboarding@resend.dev` 测试地址）
2. `pnpm add resend react-email @react-email/components`
3. `.env.local`：`RESEND_API_KEY=re_xxx`
4. `emails/welcome.tsx`：
   ```tsx
   import { Html, Body, Heading, Text, Button } from '@react-email/components'
   export default function WelcomeEmail({ name }: { name: string }) {
     return (
       <Html>
         <Body>
           <Heading>欢迎 {name} 加入 Agent Journey</Heading>
           <Text>感谢注册。开始探索你的第一个 agent 产品。</Text>
           <Button href="https://your-app.com/posts">开始使用</Button>
         </Body>
       </Html>
     )
   }
   ```
5. 类似写 `emails/tips.tsx`（介绍 3 个主要功能）
6. `pnpm dlx react-email dev` 本地预览邮件

### Part 2 · Clerk webhook 改造成 event producer（30 min）

改造 `app/api/webhooks/clerk/route.ts`：
```ts
case 'user.created':
  const clerkUser = evt.data
  // 1. 立即同步到 DB（必须，否则后续查 user 会失败）
  await db.insert(users).values({
    clerkId: clerkUser.id,
    email: clerkUser.email_addresses[0].email_address,
    name: clerkUser.first_name ?? 'friend',
  }).onConflictDoNothing()
  // 2. 发 Inngest event
  await inngest.send({
    name: 'user/created',
    data: {
      clerkId: clerkUser.id,
      email: clerkUser.email_addresses[0].email_address,
      name: clerkUser.first_name ?? 'friend',
    },
  })
  break
```

**关键点**：DB 同步必须在 webhook handler 里做（因为后续 function 要查 user）；发邮件放到 Inngest function。

### Part 3 · 欢迎邮件 function（60 min）

`src/inngest/functions/send-welcome.ts`：

```ts
import { Resend } from 'resend'
import { render } from '@react-email/render'
import WelcomeEmail from '@/emails/welcome'
import TipsEmail from '@/emails/tips'

const resend = new Resend(process.env.RESEND_API_KEY!)

export const sendWelcomeFn = inngest.createFunction(
  { id: 'send-welcome-drip' },
  { event: 'user/created' },
  async ({ event, step }) => {
    const { email, name } = event.data

    await step.run('send-welcome', async () => {
      const html = await render(WelcomeEmail({ name }))
      await resend.emails.send({
        from: 'welcome@yourdomain.com',
        to: email,
        subject: `欢迎 ${name}`,
        html,
      })
    })

    // 本地测试用 30 秒，生产改回 '5m'
    await step.sleep('wait-before-tips', process.env.NODE_ENV === 'production' ? '5m' : '30s')

    await step.run('send-tips', async () => {
      const html = await render(TipsEmail({ name }))
      await resend.emails.send({
        from: 'tips@yourdomain.com',
        to: email,
        subject: '几个你可能想试的功能',
        html,
      })
    })
  }
)
```

记得在 `app/api/inngest/route.ts` 注册这个 function。

### Part 4 · 跑一遍验证（30 min）

1. 启动三个进程：
   - `pnpm dev`（Next.js）
   - `pnpm dlx inngest-cli@latest dev`（Inngest dev）
   - `cloudflared tunnel --url http://localhost:3000`（Clerk webhook 转发）
2. 真做一次 sign up（用你自己没用过的邮箱）
3. 观察三个面板：
   - Clerk dashboard → Webhook Logs：看 `user.created` 发出了
   - Inngest dev UI → Runs：看 `send-welcome-drip` function 被触发，`wait-before-tips` step 处于 sleeping 状态
   - 你的邮箱：立即收到欢迎邮件，30 秒后收到 tips
4. 检查 Inngest UI 里每个 step 的**执行时间戳** —— 能看到 step 1 成功后 step 2 在 30 秒后才开始

### Part 5 · 破坏性测试

- 故意让 send-tips 里 `throw new Error('fail')`：观察 Inngest 会不会重试、欢迎邮件会不会被重发
- 改 `step.sleep` 时间为 '1h'：看 Inngest UI 里的 "sleeping until..." 时间戳

**卡点思考**：
- 为什么 `step.run` 的回调里用 `await resend.emails.send()` 而不是 `.then()`？Inngest 怎么知道这个 step 成功了？
- 如果用户注册后立刻删号（`user.deleted` webhook 到达），正在 sleep 的 tips 邮件还会发吗？怎么阻止？
- `step.sleep('wait', '5m')` 和 `await new Promise(r => setTimeout(r, 5*60*1000))` 在 Vercel 环境里有什么根本差异？

## 今天结束能回答

- `step.sleep` 的原理是什么？为什么不占 Vercel function 资源？
- 为什么 Clerk webhook handler 不应该直接发邮件？解耦后 fault tolerance 有什么提升？
- 如果欢迎邮件发送成功但 sleep 之后的 tips 发送失败，Inngest 的重试会不会导致用户收到两封欢迎邮件？为什么？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 17）深入失败和重试 —— Inngest 的 `retries` / `onFailure` / `NonRetriableError`
