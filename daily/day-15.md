# Day 15 · 2026-05-22（周五）

> Week 3 · 队列与事件驱动（Inngest）
> 今天 2-2.5h

## 今天学什么

**主题**：为什么 serverless 应用需要"队列"这个东西，以及 Inngest 和传统队列（BullMQ / RabbitMQ）的根本差异。

作为前端，你接触过"消息队列"这个词但大概没用过。今天要搞懂的是：**长任务、延时任务、事件驱动的工作流不能住在 HTTP request 里**，它们需要一个能"存起来、重试、到时间执行"的基础设施 —— 这就是队列。Inngest 给了一个 serverless-native 的答案，这是 agent 工程师必须的基础设施。

## 核心概念

- **为什么需要队列**：
  - HTTP 有超时（Vercel 默认 10s，Pro 60s，最长 5min）
  - 用户关页面你的服务不该停（比如"处理中的邮件"）
  - 有些任务要延时（"5 分钟后发 tips 邮件"）
  - 有些任务要定时（"每天凌晨清理过期数据"）
  - 有些任务要重试（外部 API 挂了，1 分钟后再试）
- **传统队列的问题**：BullMQ / RabbitMQ 需要你**常驻一个 worker 进程**消费。Vercel serverless 没有常驻进程 → 不适用。
- **Inngest 的创新**：你写 function 放在 `/api/inngest` 这个 HTTP endpoint 下，Inngest 云端当"调度器" —— 有 event 时来 POST 你的 endpoint 触发 function，不占你自己进程。**本质是：Inngest 在云端帮你维护队列和调度，你本地只管写 function**。
- **Event-driven vs RPC**：
  - RPC：`await processImage(imageId)` —— 同步调用，必须等结果
  - Event-driven：`inngest.send({ name: 'image/uploaded', data: { imageId } })` —— 发个事件就返回，谁消费、怎么处理都不管
  - Event 解耦生产者和消费者：一个 event 可以触发多个 function（用户注册 → 发欢迎邮件 + 创建默认设置 + 通知管理员）
- **`step.run` 的作用**：把一个 function 拆成多个 step，每个 step 独立重试 + 独立持久化。如果 step 2 失败，重试时 step 1 不会重跑。**这是 Inngest 和普通 queue 的杀手级差异**。

## 参考资源

- **[Inngest Concepts: Functions](https://www.inngest.com/docs/functions)** — 15 min
- **[Inngest Concepts: Events](https://www.inngest.com/docs/events)** — 10 min
- **[Inngest Concepts: Steps](https://www.inngest.com/docs/features/inngest-functions/steps-workflows)** — 20 min，核心
- **[How Inngest works](https://www.inngest.com/docs/learn/how-functions-are-executed)** — 20 min，理解云端调度模型

## 动手练习

在 Week 2 项目上接入 Inngest：

1. **注册 Inngest account**（有免费额度）
2. **`pnpm add inngest`**
3. **`src/inngest/client.ts`**：
   ```ts
   import { Inngest } from 'inngest'
   export const inngest = new Inngest({ id: 'agent-journey-m1' })
   ```

4. **第一个 function** `src/inngest/functions/hello.ts`：
   ```ts
   import { inngest } from '../client'
   export const helloFn = inngest.createFunction(
     { id: 'hello' },
     { event: 'test/hello' },
     async ({ event, step }) => {
       const result = await step.run('greet', async () => {
         console.log('hello', event.data.name)
         return { greeting: `Hello, ${event.data.name}!` }
       })
       return result
     }
   )
   ```

5. **注册 route** `app/api/inngest/route.ts`：
   ```ts
   import { serve } from 'inngest/next'
   import { inngest } from '@/inngest/client'
   import { helloFn } from '@/inngest/functions/hello'
   export const { GET, POST, PUT } = serve({ client: inngest, functions: [helloFn] })
   ```

6. **本地跑 Inngest dev server**：
   ```bash
   pnpm dlx inngest-cli@latest dev
   ```
   它会启动 http://localhost:8288，自动发现你 Next.js 的 /api/inngest 上的 functions

7. **触发 event**（两种方式都试）：
   - 方式 A：Inngest dev UI → Events → Send event → `test/hello` + `{"name":"world"}`
   - 方式 B：在 Server Action 里 `await inngest.send({ name: 'test/hello', data: { name: 'world' } })`，UI 加按钮触发
   - 观察 Inngest dev UI 的 Runs 面板：function 被执行、step 被记录

8. **故意弄错看反应**：
   - 改 function 让它 `throw new Error('fail')`，看 Inngest UI 里 run 的状态
   - 去掉 `step.run`，直接 console.log，看运行结果 —— 会发现"没有 step"的 function 依然能跑（但失去了 step 级持久化的好处）

**卡点思考**：
- `inngest.send()` 是同步还是异步？它返回后 function 已经开始执行了吗？（答案：返回只代表 event 进了 Inngest 的队列，function 什么时候跑不保证）
- Inngest dev 模式下 event 存在哪？重启后还在吗？
- `step.run('greet', ...)` 里第一个参数 `'greet'` 是什么作用？改成 `'greet-2'` 会怎样？（提示：step name 是持久化 key）

## 今天结束能回答

- 为什么 "常驻 worker 消费队列" 这种传统架构在 Vercel 上行不通？Inngest 用什么模式绕过了这个问题？
- 一个 event 能触发几个 function？反过来，一个 function 能响应几种 event？
- Inngest 的 "serverless queue" 和 SQS / RabbitMQ 最大区别是什么？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 16）把 Clerk webhook + Inngest 串起来做"欢迎邮件流" —— 第一次感受 event-driven 的威力
