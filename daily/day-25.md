# Day 25 · 2026-06-01（周一）

> Week 4 · Streaming + 错误处理
> 今天 2-2.5h

## 今天学什么

**主题**：错误不是抛了就完 —— 设计错误体系，让错误分流、上报、用户可读。

前 24 天你的错误处理大概是"throw + catch + console.log"。这在生产环境是**灾难**：用户看到乱码 error message、server 抛错没人知道、重要异常淹没在日志里。今天建立一套错误分层体系，M2-M6 每个项目都会用到。

## 核心概念

- **错误的分类意图**：你在 try/catch 里 catch 到的 error，需要判断：
  - 是**用户的错**吗（输入错、无权限、资源不存在）→ 返回用户可读信息，**不**上报
  - 是**你的错**吗（DB 挂了、外部 API 挂了、代码 bug）→ 用户看"出错了"，**上报 Sentry**
  - 是**第三方可恢复错**吗（rate limit、transient）→ 重试
- **AppError 基类**：所有自定义错误继承一个基类，带 `code` / `statusCode` / `isOperational`（是否上报）字段
- **Server Action 的 envelope 模式**：不直接 throw 给客户端，返回 `{ ok, data?, error? }`。客户端永远不用 try/catch Server Action，判断 `ok` 即可
- **Sentry 的最小配置**：Next.js wizard 一键，`SENTRY_DSN` 写好就能上报。配 `beforeSend` 过滤掉 UserError 不上报
- **结构化日志**：把 `console.log('blah', obj)` 换成 `logger.info({ kind: 'xxx', ...obj }, 'message')`。好处是未来导入 Datadog / Axiom 时能直接 query
- **错误消息的 i18n 边界**：`UserError` 里的 message 是对用户展示的文本，可能要翻译；`SystemError` 里的 message 是给工程师的，永远英文

## 参考资源

- **[Sentry for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/)** — 15 min，跟着 wizard 做
- **[pino 结构化日志](https://getpino.io/)** — 10 min（可选，轻量结构化 logger）
- **[Next.js: Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)** — 再读一遍
- **[Stripe 的错误设计](https://docs.stripe.com/api/errors)** — 10 min，业界顶尖错误 API 设计

## 动手练习

### Part 1 · AppError 基类（30 min）

`src/lib/errors.ts`：

```ts
export class AppError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly isOperational: boolean

  constructor(args: {
    code: string
    message: string
    statusCode?: number
    isOperational?: boolean
    cause?: unknown
  }) {
    super(args.message)
    this.name = 'AppError'
    this.code = args.code
    this.statusCode = args.statusCode ?? 500
    this.isOperational = args.isOperational ?? false
    if (args.cause) (this as any).cause = args.cause
  }
}

// 用户错误：期望的失败，不上报
export class UserError extends AppError {
  constructor(code: string, message: string, statusCode = 400) {
    super({ code, message, statusCode, isOperational: true })
    this.name = 'UserError'
  }
}

// 系统错误：不期望的失败，必须上报
export class SystemError extends AppError {
  constructor(code: string, message: string, cause?: unknown) {
    super({ code, message, statusCode: 500, isOperational: false, cause })
    this.name = 'SystemError'
  }
}

// 特化
export class AuthError extends UserError {
  constructor(message = '请先登录') { super('unauthorized', message, 401) }
}
export class ForbiddenError extends UserError {
  constructor(message = '没有权限') { super('forbidden', message, 403) }
}
export class NotFoundError extends UserError {
  constructor(resource = 'resource') { super('not_found', `${resource} 不存在`, 404) }
}
export class PaymentError extends UserError {
  constructor(message: string) { super('payment_failed', message, 402) }
}
export class RateLimitError extends UserError {
  constructor(message = '请求太频繁，稍后再试') { super('rate_limited', message, 429) }
}
```

### Part 2 · 统一 Server Action envelope（30 min）

写一个 helper：

```ts
// src/lib/action.ts
export async function wrapAction<T>(fn: () => Promise<T>): Promise<
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (err) {
    if (err instanceof UserError) {
      return { ok: false, error: { code: err.code, message: err.message } }
    }
    // 未知 / 系统错：上报 + 返回通用消息
    const systemErr = err instanceof AppError ? err : new SystemError('unknown', 'unexpected error', err)
    captureError(systemErr)
    return { ok: false, error: { code: 'internal_error', message: '服务器开小差了，请稍后再试' } }
  }
}
```

把所有现有 Server Action 改造用 wrapAction：

```ts
export async function createPost(input: PostInput) {
  return wrapAction(async () => {
    const user = await requireUser()  // 抛 AuthError 自动被捕获
    // ...
    return post
  })
}
```

### Part 3 · 接入 Sentry（30 min）

1. `npx @sentry/wizard@latest -i nextjs` 跑完整向导（Sentry 账号 → DSN → 配置文件）
2. 生成三个文件：`sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts`
3. 在三个 config 里加 `beforeSend`：
   ```ts
   Sentry.init({
     dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
     tracesSampleRate: 0.1,
     beforeSend(event, hint) {
       const err = hint.originalException
       if (err instanceof UserError) return null  // 不上报用户错
       return event
     },
   })
   ```
4. `src/lib/observability.ts`：
   ```ts
   export function captureError(err: unknown, context?: Record<string, unknown>) {
     Sentry.captureException(err, { extra: context })
     console.error('[error]', err, context)  // 本地 dev 也打印
   }
   ```
5. 在 `app/posts/page.tsx` 加一个触发 `throw new SystemError('test', 'test error')` 的按钮，部署到 Vercel
6. 触发一次 → Sentry dashboard 应该有 event

### Part 4 · 客户端友好显示（30 min）

客户端不 try/catch Server Action：

```tsx
'use client'
import { toast } from 'sonner'  // 或任何 toast 库

async function handleSubmit(formData: FormData) {
  const result = await createPost({ /* ... */ })
  if (!result.ok) {
    toast.error(result.error.message)
    return
  }
  toast.success('创建成功')
  router.push(`/posts/${result.data.id}`)
}
```

**原则**：客户端代码从不 `try { await action() } catch`。action 永远返回 envelope，成功失败都是正常路径。

### Part 5 · Retry helper（15 min）

`src/lib/retry.ts`：

```ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; initialDelay?: number } = {}
): Promise<T> {
  const { retries = 3, initialDelay = 500 } = opts
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (err instanceof UserError) throw err  // 用户错不重试
      if (i < retries) {
        await new Promise(r => setTimeout(r, initialDelay * 2 ** i))
      }
    }
  }
  throw lastErr
}
```

用它包装外部 API 调用（比如 Resend 发邮件）：
```ts
await withRetry(() => resend.emails.send({ /* ... */ }))
```

**注意**：Inngest function 内部**不要**用 withRetry，因为 Inngest 已经有自己的重试 —— 两套叠加会导致重试次数爆炸。Inngest function 外的普通代码（Server Action）才用。

## 今天结束能回答

- UserError / SystemError 的边界怎么画？下面这些分别是哪种：
  1. 用户提交的 email 格式不对
  2. Clerk webhook 签名验证失败（来自攻击者）
  3. DB 连接超时
  4. 用户想 delete 别人的 post
  5. Stripe API 返回 502
- Server Action 抛错不包 envelope 直接 throw，Next.js 会怎样展示？哪些场景这样反而合适？
- Sentry 的 `tracesSampleRate` 和 `errorSampleRate` 是什么关系？为什么 traces 一般采样而 errors 全采？
- 为什么 Inngest function 里不该用 withRetry？两套重试叠加最糟的情况是什么？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 26）加 idempotency key + Upstash ratelimit
