# Day 22 · 2026-05-29（周五）

> Week 4 · Streaming + 错误处理
> 今天 2-2.5h

## 今天学什么

**主题**：手写 Server-Sent Events（SSE）—— 不用任何库，从字节层理解 LLM streaming 底层协议。

这是 M1 里最**重要的一天**之一。M2 Week 5 要手写 SSE parser 来解析 Anthropic Messages API 的流式响应，如果今天不把 SSE 的协议形状吃透，那时候会又要 debug 协议又要 debug 业务，双重困难。**今天我们在没有 LLM 的前提下，把纯 SSE 琢磨清楚**。

## 核心概念

- **SSE 是 HTTP over-the-top 的约定**：本质是一个永不结束的 HTTP response，content-type 是 `text/event-stream`，内容按约定格式（`data: xxx\n\n`）分块。
- **和 WebSocket 的本质差异**：
  - SSE：服务器 → 客户端单向，HTTP 基础设施全部能用（负载均衡 / CDN / 代理）
  - WebSocket：全双工，要升级协议，代理可能不友好
  - LLM streaming 天然单向（服务器往客户端推 token），**SSE 完胜**
- **EventSource API 的局限**：浏览器内置的 `new EventSource(url)` 用起来简单但是**只支持 GET 请求 + 不能自定义 header**。所有 LLM API 都要 POST + Authorization header → 必须用 `fetch` + `ReadableStream` 手动解析。
- **SSE 的协议字段**：
  - `data: xxx\n\n` —— 消息内容（\n\n 是消息边界）
  - `event: name\n` —— 事件类型（可选）
  - `id: 123\n` —— 消息 ID（供客户端断线重连 `Last-Event-ID` 用）
  - `retry: 5000\n` —— 客户端断线重连间隔（ms）
- **ReadableStream 的角色**：Response body 是一个 ReadableStream。服务器端用 `new ReadableStream({ start(controller) { controller.enqueue(...) } })` 制造；客户端用 `response.body.getReader()` 消费。
- **AbortSignal 的传递**：`request.signal` 在 Vercel / Next.js 能让 server 感知 client 关闭。你的 stream 生成逻辑要每次循环都 check `signal.aborted`，否则 client 关了 server 继续跑，白烧 CPU。

## 参考资源

- **[MDN: Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)** — 20 min
- **[MDN: Streams API concepts](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts)** — 15 min
- **[Web.dev: Streams—The definitive guide](https://web.dev/articles/streams)** — 20 min，实战向
- **[WHATWG SSE spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)** — 10 min 扫一遍，协议是 W3C 标准

## 动手练习

### Part 1 · 最小 SSE server（30 min）

`app/api/stream/route.ts`：

```ts
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i <= 100; i++) {
        if (request.signal.aborted) {
          console.log('[server] client disconnected, stopping')
          controller.close()
          return
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress: i })}\n\n`))
        await new Promise(r => setTimeout(r, 200))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
```

**关键细节**：
- `\n\n` 不能写错，写成 `\n` 客户端会等下一条
- `cache-control: no-cache` 避免代理缓存（否则响应不流式）
- `TextEncoder` 把字符串转成 Uint8Array

### Part 2 · 客户端手动消费（45 min）

**不用 `EventSource`**，用 `fetch` + reader：

`app/stream-demo/page.tsx`（client component）：

```tsx
'use client'
import { useState } from 'react'

export default function StreamDemo() {
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)

  async function start() {
    setRunning(true)
    setProgress(0)
    const controller = new AbortController()
    // 暴露 cancel 按钮
    ;(window as any)._cancel = () => controller.abort()

    try {
      const res = await fetch('/api/stream', { signal: controller.signal })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // 按 \n\n 分割消息
        const messages = buffer.split('\n\n')
        buffer = messages.pop() ?? ''  // 最后一段可能不完整，留到下次

        for (const msg of messages) {
          if (!msg.startsWith('data:')) continue
          const data = JSON.parse(msg.slice(5).trim())
          setProgress(data.progress)
        }
      }
    } catch (e) {
      console.log('stream error / aborted:', e)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <button onClick={start} disabled={running}>Start</button>
      <button onClick={() => (window as any)._cancel?.()}>Cancel</button>
      <progress value={progress} max={100} />
      <div>{progress}%</div>
    </div>
  )
}
```

**自己手 parse `\n\n` 的意义**：真实的 LLM SSE 流里，一个 `data:` 可能被分多个 chunk 传到客户端（网络抖动、TCP 分片）。你必须 buffer + split，不能假设"一个 chunk = 一条完整消息"。

### Part 3 · 断线感知验证（15 min）

1. 启动 dev，打开 `/stream-demo`，点 Start
2. 浏览器 devtools → Network → 看 `/api/stream` 请求，confirm 是 `text/event-stream` 并且在"流式加载"
3. 关闭浏览器 tab，看 server 端 console 有没有打印"client disconnected"
4. 点 Cancel 按钮，应该有相同效果

**如果看不到"client disconnected"**：
- 可能因为 dev server 的代理不透传 AbortSignal
- 或者浏览器底层合并了请求
- 这是真实存在的坑，生产环境也可能遇到 —— 不要完全依赖 `request.signal`，业务逻辑要有 max timeout 兜底

### Part 4 · 加入 SSE 其他字段（30 min）

改造 server 让每条消息都带 `event` 和 `id`：

```ts
controller.enqueue(encoder.encode(
  `event: progress\nid: ${i}\ndata: ${JSON.stringify({ progress: i })}\n\n`
))
```

客户端更新 parser：按 `event:` / `id:` / `data:` 三种前缀分别处理。

额外任务：
- 用 `EventSource`（浏览器内置）试一下能不能接同一个 endpoint？
- 对比 `EventSource` 自动重连机制 vs 手写 fetch 的行为差异

## 今天结束能回答

- SSE 和 WebSocket 的**选型判据**：给出 3 个场景，分别该选什么
- 为什么 LLM streaming 必须用 `fetch` + reader 而不是 `EventSource`？至少 2 个理由
- 你的 SSE 响应加 `cache-control: no-cache` 之前和之后，在 Vercel 上可能有什么行为差异？（提示：CDN 缓存流）
- 一条 `data:` 如果被网络分成 3 个 TCP 包送达客户端，你的 parser 怎么处理？如果 3 条消息挤在一个 TCP 包里呢？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 23）是 Next.js 原生 streaming —— Suspense + `loading.tsx` 和 SSE 是不同的机制，你要理解它俩的分工
