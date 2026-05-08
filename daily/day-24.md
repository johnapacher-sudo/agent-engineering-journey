# Day 24 · 2026-05-31（周日）

> Week 4 · Streaming + 错误处理
> 今天 3-4h（周末深度日）

## 今天学什么

**主题**：全栈取消 —— AbortSignal 从浏览器按钮传到 SSE server，再传到 Inngest function。

"用户点取消按钮"看起来简单，真做起来要穿透 3-4 层：UI → fetch → server route → downstream API / queue。任何一层断了，取消就是假的（用户以为停了，后台还在烧钱调 LLM）。今天把这条链路彻底打通，agent 应用里这是**核心安全机制**。

## 核心概念

- **AbortController 的生命周期**：
  - `new AbortController()` 得到 controller + controller.signal
  - 多个 `fetch` / `setTimeout` / 自定义长任务共享同一个 signal
  - 调用 `controller.abort()` → 所有监听这个 signal 的 promise reject `AbortError`
- **Server 端感知**：Next.js 的 `Request.signal` 在客户端关闭时会触发 abort（理论上）。但在 Vercel / dev / CDN 环境下这个信号可能被"吃掉"，不能完全依赖。**所以生产代码要有双保险**：signal 检查 + 最大超时兜底。
- **跨 HTTP 的信号传递**：signal 不能自动"穿过 HTTP"。client 的 AbortController 只能取消 client 的 fetch；server 端要接收到 abort 后，自己再创建一个新的 AbortController 传给 downstream。
- **Inngest 的"取消"哲学**：Inngest function 不能被外部 abort signal 中断 —— 它在云端跑。正确姿势是**发一个 cancel event**，让 function 用 `cancelOn` 监听这个 event。
- **LLM SDK 的取消能力**：
  - Anthropic / OpenAI SDK 的 `messages.stream()` 都接受 `signal` 参数
  - 你必须把自己的 AbortSignal 传进去，否则即使你 reject 了客户端 stream，Anthropic 仍然在生成 tokens —— 你照样被计费
  - 这点到 M2 Week 5 写 CLI chat 时再次验证

## 参考资源

- **[MDN: AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)** — 15 min
- **[MDN: AbortSignal.any()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static)** — 5 min
- **[Anthropic SDK cancellation](https://github.com/anthropics/anthropic-sdk-typescript#aborting-requests)** — 5 min（今天先读知道有这东西）
- **[Inngest: Cancel running functions](https://www.inngest.com/docs/guides/cancel-running-functions)** — 20 min

## 动手练习

### Part 1 · 改造 SSE route 严格 check signal（30 min）

升级 Day 22 的 `/api/stream` route：

```ts
export async function GET(request: Request) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const abortListener = () => {
        console.log('[server] abort signal received')
        controller.close()
      }
      request.signal.addEventListener('abort', abortListener)

      try {
        for (let i = 0; i <= 100; i++) {
          if (request.signal.aborted) break

          // 模拟慢工作：拆 10 次 20ms，每次都 check
          for (let j = 0; j < 10; j++) {
            if (request.signal.aborted) return
            await new Promise(r => setTimeout(r, 20))
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress: i })}\n\n`))
        }
        controller.close()
      } finally {
        request.signal.removeEventListener('abort', abortListener)
      }
    },
  })
  return new Response(stream, { /* headers */ })
}
```

**关键**：两种方式监听 signal ——
1. `addEventListener('abort', ...)` 主动监听
2. 循环里每次 check `signal.aborted`

单一机制可能漏掉某些边界情况。

### Part 2 · Client 取消按钮（30 min）

重构 Day 22 的 `stream-demo` 页：

```tsx
'use client'
export default function StreamDemo() {
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  async function start() {
    setRunning(true)
    setProgress(0)
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const res = await fetch('/api/stream', { signal: controller.signal })
      // 消费 stream（沿用 Day 22 代码）
    } catch (e: any) {
      if (e.name === 'AbortError') console.log('canceled by user')
      else console.error(e)
    } finally {
      setRunning(false)
      controllerRef.current = null
    }
  }

  function cancel() {
    controllerRef.current?.abort()
  }

  return (
    <>
      <button onClick={start} disabled={running}>Start</button>
      <button onClick={cancel} disabled={!running}>Cancel</button>
    </>
  )
}
```

### Part 3 · 加超时兜底（15 min）

即使 client signal 失效，server 也有最长 30 秒限制：

```ts
const timeoutSignal = AbortSignal.timeout(30_000)
const combinedSignal = AbortSignal.any([request.signal, timeoutSignal])
// 用 combinedSignal 替代 request.signal
```

Node 20+ 支持 `AbortSignal.any()` 和 `AbortSignal.timeout()`。

### Part 4 · Inngest cancel by event（60 min）

场景：Day 19 的图片处理 pipeline。用户想取消正在处理的 upload。

1. 改 `processImageFn` 配置加 `cancelOn`：
   ```ts
   export const processImageFn = inngest.createFunction(
     {
       id: 'process-image',
       cancelOn: [
         {
           event: 'image/cancel',
           if: 'event.data.uploadId == async.data.uploadId',
         },
       ],
       // ...其他配置
     },
     { event: 'image/uploaded' },
     async ({ event, step }) => { /* ... */ }
   )
   ```
2. 为方便测试，把 OCR step 改成 sleep 30 秒
3. UI 在 `/uploads` 页，对每条 `status === 'processing'` 的记录加"取消"按钮
4. 按钮调 Server Action → `inngest.send({ name: 'image/cancel', data: { uploadId } })`
5. 触发 pipeline → 处理中点取消 → 观察：
   - Inngest UI 里 run 的状态变 "Cancelled"
   - 后续 step 不执行
   - `uploads.status` 停在中间状态（因为我们没有 onCancel handler）
6. 改进：在 `onFailure` 或 Inngest 的 cancel event 里把 status 标记为 canceled

### Part 5 · 组合一把（30 min）

把 SSE + Inngest 两者关联做真实 UX：

- `/uploads/[id]` 页用 SSE 实时推送 upload 的进度（server 端 poll DB 每秒推一次）
- 页面上"取消"按钮 → 同时 abort SSE + 发 Inngest cancel event
- 验证两边都停下来

## 今天结束能回答

- AbortSignal 从浏览器到 Inngest function 的完整传递链，列出每一跳**可能断链**的点
- 为什么 Inngest 不能用 AbortSignal 取消？它的取消机制背后是什么？
- Anthropic SDK 的 streaming，如果你 reject 客户端 stream 但不传 signal 给 SDK，会发生什么？（M2 Week 5 再验证一次）
- `request.signal` 在 Vercel edge 和 node runtime 行为有差异吗？怎么验证？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 25）建立错误体系 —— AppError 分层 + Sentry 接入
