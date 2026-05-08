# Day 27 · 2026-06-03（周三）

> Week 4 · Streaming + 错误处理
> 今天 2-2.5h · **阶段 2 精读日**

## 今天学什么

**主题**：把 streaming / abort / 错误的 Web 标准通读一遍，建立完整心智模型。

过去 5 天你跑通了 SSE、Suspense、AbortController、AppError、ratelimit。但很多点是"照抄就能跑"。今天系统读 Web 标准和 Next.js 官方文档，把"碎片知识"拼成"完整地图"。**这是 M2 Week 5 手写 Anthropic SSE parser 之前最后一次系统打底**。

## 核心概念

今天要建立的 6 个稳固知识点：

1. **SSE 协议完整字段**：`data` / `event` / `id` / `retry` / `:`（注释）各自的语义和浏览器行为
2. **Streams API 三种 stream 的关系**：ReadableStream / WritableStream / TransformStream
3. **`pipeThrough` 和 `pipeTo` 的语义**：流的组合姿势
4. **AbortController 的传播语义**：signal 能传给哪些 API（fetch、setTimeout、自定义）
5. **Next.js 缓存体系的 4 层**（今天只需建立"有这 4 层"的认知，M5 Week 19 深入）：Request Memoization / Data Cache / Full Route Cache / Router Cache
6. **Error boundary 的边界**：哪些错误 `error.tsx` 能抓、哪些抓不住

## 参考资源

**Streaming（1h 精读）**
- **[MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)** — 完整通读
- **[MDN: Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)** — 重点看 Concepts 页
- **[WHATWG SSE spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)** — 扫一遍协议字段定义

**AbortController（30 min）**
- **[MDN: AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)** — 完整读
- **[MDN: AbortSignal.any()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static)** + [`.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
- **[Node.js AbortSignal in fetch](https://nodejs.org/api/globals.html#class-abortcontroller)** — 看 Node 侧的支持情况

**Next.js（30 min）**
- **[Next.js: Loading UI and Streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)** — 再读一遍
- **[Next.js: Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)** — 再读一遍
- **[Next.js Caching overview](https://nextjs.org/docs/app/building-your-application/caching)** — 通读一遍，理解 4 层缓存（M5 Week 19 再深入）

## 动手练习

今天不写业务代码，输出是**两张图 + 一份笔记**。

### Part 1 · 画数据流图：SSE 完整生命（30 min）

在 `notes/sse-lifecycle.md` 里画：

```
[Browser: fetch('/api/stream', { signal }) ]
         |
         | HTTP GET
         v
[Next.js: Route Handler ]
         |
         | returns new Response(readableStream)
         v
[Node.js: HTTP server ]
         |
         | Transfer-Encoding: chunked
         | Content-Type: text/event-stream
         v
[Network: TCP chunks ]  (chunk 边界 ≠ message 边界)
         |
         v
[Browser: response.body (ReadableStream) ]
         |
         | getReader() → read() → Uint8Array
         v
[TextDecoder: bytes → string (可能半截) ]
         |
         v
[Parser: buffer + split('\n\n') + parse data: ]
         |
         v
[setState: 更新 UI ]
```

每条边标注**可能失败 / 被打断的点**：
- `fetch` 前：client 未发起
- HTTP handshake 期间：network error
- Stream 中途：连接断、浏览器关 tab、AbortController.abort()
- Parser：buffer 有半截数据但 TCP 断了 → 需要丢弃 / 重试
- setState：组件已 unmount 就不能 set 了

### Part 2 · 画信号传播图：AbortSignal（30 min）

在 `notes/abort-signal-propagation.md` 画：

```
[Button click]
     |
     | controller.abort()
     v
[AbortController.signal → aborted=true]
     |
     +--------+--------+--------+
     |        |        |        |
     v        v        v        v
[fetch]  [setTimeout]  [stream reader]  [custom async]
     |        |              |              |
     v        v              v              v
 AbortError  cleared     reader.cancel()   check signal.aborted
     |
     v
[server 端 request.signal aborted? ]   ← 不一定接收到！

[业务 function ] → 传 signal 给 downstream:
  - stripe.checkout.sessions.create({ ..., signal })  ✓
  - anthropic.messages.stream({ ..., signal })        ✓ (M2 Week 5)
  - db.select().from()                                ✗ (Drizzle 不支持)
  - inngest.send()                                    ✗ (事件已入队，用 cancelOn 代替)
```

关键：**哪些下游 API 支持 signal**？哪些不支持？不支持的要怎么补救（timeout / cancel event）？

### Part 3 · Next.js 缓存 4 层速记（20 min）

在 `notes/nextjs-cache-layers.md` 记录：

| 层 | 作用域 | 谁管 | 失效方式 |
|---|---|---|---|
| Request Memoization | 单次请求内 | React | 请求结束自动清 |
| Data Cache | 跨请求、跨用户 | Next.js（`fetch` 缓存） | `revalidateTag` / `revalidatePath` / TTL |
| Full Route Cache | 构建时 / RSC 输出 | Next.js | 重新部署 / 数据变更触发 |
| Router Cache | 浏览器端 | Next.js client | 客户端导航 / 路由刷新 |

**今天只建立"有这 4 层"的认知**，不用深挖。M5 Week 19 会做"缓存策略 + 数据一致性"的完整深度。

### Part 4 · 错误边界覆盖范围（20 min）

在 `notes/error-boundary-coverage.md` 测试**哪些错误会被 `error.tsx` 捕获**：

- ✅ Server Component 里 async function 抛错
- ✅ Client Component 渲染时抛错
- ❌ Server Action 里抛错（不会触发 error.tsx，会抛回客户端的 promise）
- ❌ `useEffect` 里 async 错误（要自己 try/catch）
- ❌ Event handler 里的错误（例如 onClick 里 throw）
- ❌ 全局 JavaScript 错误（比如 `window.addEventListener`）

真的写 6 段代码跑一遍验证，哪些触发 error.tsx、哪些不触发。

## 今天结束能回答

- SSE 协议里 `id:` 字段的作用？浏览器 EventSource 重连时会带上什么 header？
- `TransformStream` 和 `pipeThrough` 可以用来做什么？（想出 2 个 agent 场景用法）
- Anthropic SDK 的 `messages.stream({ signal })` 如果你不传 signal，client 取消了请求，Anthropic 后端会继续生成吗？你会被收费吗？
- Next.js 的 `revalidateTag` 会让 CDN 边缘节点立刻失效吗？（M5 Week 19 的预习）
- Server Action 里 `throw new UserError(...)`，客户端 `await action()` 会拿到什么？error.tsx 会被触发吗？

## 晚上 10 min

- `journal.md`：**今天最打动你的一个概念**
- commit 四份 notes（sse-lifecycle / abort-signal-propagation / nextjs-cache-layers / error-boundary-coverage）
- 明天（Day 28）Week 4 收官复盘
