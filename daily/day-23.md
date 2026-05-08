# Day 23 · 2026-05-30（周六）

> Week 4 · Streaming + 错误处理
> 今天 3-4h（周末深度日）

## 今天学什么

**主题**：Next.js App Router 的"原生流式渲染"—— Suspense + `loading.tsx` 是另一套 streaming，和 SSE 并存但不重叠。

昨天上的 SSE 是"数据流式"—— 长任务进度、LLM 流式 token。今天学的是"**页面流式渲染**"—— 一个页面里部分内容慢，不挡快的部分显示。两者并不互斥，agent 应用里常常两者都用。

## 核心概念

- **"流式 HTML" 的工作原理**：Next.js Server Component 在服务端渲染时，遇到 `<Suspense fallback>` 包裹的 async 组件，先发出 fallback 的 HTML + JS 注水 placeholder，之后 async 组件 resolve 后通过 HTTP chunked transfer 续发剩余 HTML。浏览器边收边渲染。
- **和 SSE 的本质差异**：
  - SSE：JS 层消费 stream，自己拿数据再更新 UI
  - Suspense streaming：HTML 层原生 streaming，**浏览器不用 JS 就能渲染**
- **`loading.tsx` vs 显式 `<Suspense>`**：
  - `loading.tsx` = 路由段级 Suspense，整个页面级 fallback
  - 显式 `<Suspense>` = 组件级，局部 fallback
  - 一般两者都用：`loading.tsx` 做骨架屏，`<Suspense>` 做"慢的那块单独 fallback"
- **`useTransition` / `useOptimistic`**：
  - `useTransition`：把"慢的 state 更新"标记为低优先级，不阻塞 UI（通常用在 Server Action 调用时）
  - `useOptimistic`：乐观更新 —— 用户点"点赞"，UI 立刻 +1 显示，等 server 回应，失败了再回滚
  - 两者经常一起用
- **错误边界（`error.tsx`）**：Suspense 旁边的姐妹文件。async 组件抛错时 `error.tsx` 接管渲染。**客户端组件**，必须 `'use client'`。
- **Server Component 里 await 数据**：`async function Comments({ postId })` 里直接 `await db.select()`，不需要 useEffect、不需要 useSWR。这是 App Router 的核心姿势。

## 参考资源

- **[Next.js: Loading UI and Streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)** — 20 min，必读
- **[Next.js: Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)** — 15 min
- **[React docs: `useTransition`](https://react.dev/reference/react/useTransition)** — 15 min
- **[React docs: `useOptimistic`](https://react.dev/reference/react/useOptimistic)** — 10 min
- **[Sam Selikoff: Streaming UI explained](https://www.youtube.com/c/SamSelikoff)** — 可选，找一个 `<Suspense>` 主题的视频

## 动手练习

### Part 1 · 路由段级 loading（30 min）

1. `app/posts/[id]/page.tsx`：
   ```tsx
   export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
     const { id } = await params
     const post = await db.select().from(posts).where(eq(posts.id, id)).then(r => r[0])
     return (
       <article>
         <h1>{post.title}</h1>
         <Content content={post.content} />
         <Comments postId={post.id} />
       </article>
     )
   }
   ```
2. `app/posts/[id]/loading.tsx`：
   ```tsx
   export default function Loading() {
     return <div className="skeleton">加载中...</div>
   }
   ```
3. 访问 `/posts/xxx`，devtools 看 Network：第一次访问 HTML 流下来之前显示 loading.tsx 内容

### Part 2 · 组件级 Suspense（45 min）

把 `<Comments>` 改成 async + 慢：

```tsx
async function Comments({ postId }: { postId: string }) {
  // 模拟慢查询
  await new Promise(r => setTimeout(r, 2000))
  const comments = await db.select().from(commentsTable).where(eq(commentsTable.postId, postId))
  return <ul>{comments.map(c => <li key={c.id}>{c.body}</li>)}</ul>
}
```

在 page 里包 Suspense：

```tsx
<Suspense fallback={<div>加载评论...</div>}>
  <Comments postId={post.id} />
</Suspense>
```

访问时观察：
- post 标题和 content 立刻出现
- "加载评论..." 立刻占位
- 2 秒后评论区被替换
- **关键**：这整个过程没发第二次 HTTP 请求，是同一次响应里流式续传 HTML

### Part 3 · error.tsx 错误边界（20 min）

1. `app/posts/[id]/error.tsx`：
   ```tsx
   'use client'
   export default function Error({ error, reset }: { error: Error; reset: () => void }) {
     return (
       <div>
         <h2>出错了</h2>
         <pre>{error.message}</pre>
         <button onClick={() => reset()}>重试</button>
       </div>
     )
   }
   ```
2. 让 `Comments` 组件 `throw new Error('boom')`
3. 刷新 → 看到 error.tsx 内容
4. 点 reset → 组件重新挂载

### Part 4 · 多个 Suspense 嵌套（30 min）

同一页面放 3 个 Suspense：

```tsx
<Suspense fallback={<Skel1 />}>
  <Section1 />
</Suspense>
<Suspense fallback={<Skel2 />}>
  <Section2 />
</Suspense>
<Suspense fallback={<Skel3 />}>
  <Section3 />
</Suspense>
```

让三个 Section 分别 sleep 1s / 3s / 2s，观察 HTML 流式到达顺序 —— 先 resolve 的先出现，不按代码顺序。

### Part 5 · useOptimistic + useTransition（45 min）

做"点赞"按钮的乐观更新：

```tsx
'use client'
import { useOptimistic, useTransition } from 'react'

export function LikeButton({ postId, initialLikes }: { postId: string; initialLikes: number }) {
  const [isPending, startTransition] = useTransition()
  const [optimisticLikes, setOptimisticLikes] = useOptimistic(initialLikes, (state) => state + 1)

  return (
    <button
      onClick={() => {
        setOptimisticLikes(null)  // 立刻 +1
        startTransition(async () => {
          const result = await likePostAction(postId)
          if (!result.ok) {
            // 失败时 React 会自动回滚 optimistic state
            alert('点赞失败')
          }
        })
      }}
    >
      ❤️ {optimisticLikes} {isPending && '…'}
    </button>
  )
}
```

测试：
- 正常情况：点一下 UI 立刻 +1
- 断网 → 点一下 → UI 先 +1 → 请求失败 → UI 回到原值
- 这种 UX 就是 "网快如飞" 的错觉来源

## 今天结束能回答

- `loading.tsx` 和显式 `<Suspense>` 什么时候用哪个？两者能共存吗？
- Server Component 的流式渲染和 SSE 都是"服务器往客户端推"—— 它们的**协议层差异**是什么？（提示：都是 chunked HTTP，但 content-type 不同、解析方不同）
- `useOptimistic` 的回滚是怎么实现的？它要求 Server Action 失败时做什么？
- 一个页面同时用了 3 个 Suspense，network 面板你会看到几个请求？HTML 是怎么到达浏览器的？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 24）把取消打通全栈 —— 浏览器 AbortController 一路传到 Inngest function
